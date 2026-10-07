import { CURRENT_SCHEMA_VERSION, runMigrations } from '../migrations.js';

/**
 * Backup files: build, validate, encrypt and decrypt them. No DOM or storage
 * access, so it runs unchanged in Node tests.
 *
 * Plain file:
 *   { app: 'ubecafe', format: 'ubecafe-backup', formatVersion: 1, schemaVersion,
 *     exportedAt, account, data: { profile, recipes, plan, … } }
 *
 * Encrypted file (the plain file, as JSON, sealed with AES-GCM-256):
 *   { app, format: 'ubecafe-backup-encrypted', formatVersion: 1, schemaVersion, exportedAt,
 *     kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt },
 *     cipher: { name: 'AES-GCM', iv }, check, ciphertext }
 * PBKDF2 derives 512 bits from the passphrase: the first 256 are the AES key, the
 * last 256 are stored as `check`, so a wrong passphrase can be told apart from a
 * damaged file. The visible header fields are bound to the ciphertext as AES-GCM
 * additional data, so editing them also counts as damage.
 */

export const BACKUP_APP = 'ubecafe';
export const PLAIN_FORMAT = 'ubecafe-backup';
export const ENCRYPTED_FORMAT = 'ubecafe-backup-encrypted';
export const FORMAT_VERSION = 1;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const MIN_ITERATIONS = 100000;
const MAX_ITERATIONS = 10000000;
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const RESERVED_NAMES = new Set(['schemaVersion', 'theme', 'accounts', 'session']);

export class BackupError extends Error {
  /**
   * @param {'too-large'|'not-json'|'not-backup'|'newer-version'|'invalid-data'|'wrong-passphrase'|'corrupted'|'unsupported'} code
   */
  constructor(code, message) {
    super(message ?? code);
    this.name = 'BackupError';
    this.code = code;
  }
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Base64 without spreading large arrays into String.fromCharCode (which overflows the stack). */
export const toBase64 = (bytes) => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
};

export const fromBase64 = (text) => {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new BackupError('corrupted');
  return Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
};

const subtle = () => {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new BackupError('unsupported', 'Encryption needs a secure (https) page and a modern browser.');
  return api;
};

/** The header fields an encrypted file exposes, in a fixed order, as AES-GCM additional data. */
const headerBytes = (envelope) => new TextEncoder().encode(JSON.stringify([
  envelope.app, envelope.format, envelope.formatVersion, envelope.schemaVersion, envelope.exportedAt,
  envelope.kdf.iterations, envelope.kdf.salt, envelope.cipher.iv,
]));

const deriveKeyAndCheck = async (passphrase, salt, iterations) => {
  const api = subtle();
  const base = await api.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await api.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 512));
  const key = await api.importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return { key, check: toBase64(bits.slice(32)) };
};

/** Constant-time string comparison for the passphrase check. */
const sameText = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/** Checks the plain backup structure (not the data shapes; migrations normalize those). */
const validatePlain = (backup) => {
  if (!isPlainObject(backup) || backup.app !== BACKUP_APP || backup.format !== PLAIN_FORMAT) {
    throw new BackupError('not-backup', 'This file is not an Ube Café backup.');
  }
  if (!Number.isInteger(backup.schemaVersion) || backup.schemaVersion < 0) {
    throw new BackupError('invalid-data', 'The backup has no valid schema version.');
  }
  if (backup.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new BackupError('newer-version', 'This backup was made by a newer version of Ube Café. Update the app, then try again.');
  }
  if (!isPlainObject(backup.data)) throw new BackupError('invalid-data', 'The backup contains no user data.');
  return backup;
};

export const BackupEngine = {
  ITERATIONS: 210000, // OWASP 2023 recommendation for PBKDF2-HMAC-SHA256

  /** Builds a plain backup object from one scope's data. */
  create({ data, account = null, schemaVersion = CURRENT_SCHEMA_VERSION, now = new Date() }) {
    const clean = Object.fromEntries(Object.entries(data).filter(([name]) => NAME_PATTERN.test(name) && !RESERVED_NAMES.has(name)));
    return {
      app: BACKUP_APP,
      format: PLAIN_FORMAT,
      formatVersion: FORMAT_VERSION,
      schemaVersion,
      exportedAt: now.toISOString(),
      account,
      data: structuredClone(clean),
    };
  },

  serialize(file) {
    return `${JSON.stringify(file, null, 2)}\n`;
  },

  /** Suggested download name, e.g. "ubecafe-backup-2026-10-07.encrypted.json". */
  fileName(file) {
    const date = String(file.exportedAt ?? new Date().toISOString()).slice(0, 10);
    return `ubecafe-backup-${date}${file.format === ENCRYPTED_FORMAT ? '.encrypted' : ''}.json`;
  },

  /**
   * Parses file text into a validated backup envelope (plain or still encrypted).
   * @throws {BackupError} 'too-large' | 'not-json' | 'not-backup' | 'newer-version' | 'invalid-data' | 'corrupted'
   */
  parse(text) {
    if (typeof text !== 'string') throw new BackupError('not-json');
    if (text.length > MAX_BACKUP_BYTES) throw new BackupError('too-large', 'This file is too large to be an Ube Café backup.');
    let file;
    try {
      file = JSON.parse(text);
    } catch {
      throw new BackupError('not-json', 'This file is not valid JSON. Choose the .json file Ube Café downloaded.');
    }
    if (isPlainObject(file) && file.app === BACKUP_APP && file.format === ENCRYPTED_FORMAT) {
      const ok = isPlainObject(file.kdf) && file.kdf.name === 'PBKDF2' && file.kdf.hash === 'SHA-256'
        && Number.isInteger(file.kdf.iterations) && typeof file.kdf.salt === 'string'
        && isPlainObject(file.cipher) && file.cipher.name === 'AES-GCM' && typeof file.cipher.iv === 'string'
        && typeof file.check === 'string' && typeof file.ciphertext === 'string';
      if (!ok) throw new BackupError('corrupted', 'This encrypted backup is damaged or incomplete.');
      if (Number.isInteger(file.schemaVersion) && file.schemaVersion > CURRENT_SCHEMA_VERSION) {
        throw new BackupError('newer-version', 'This backup was made by a newer version of Ube Café. Update the app, then try again.');
      }
      return file;
    }
    return validatePlain(file);
  },

  isEncrypted(file) {
    return file?.format === ENCRYPTED_FORMAT;
  },

  /** Seals a plain backup with a passphrase. */
  async encrypt(backup, passphrase, { iterations = this.ITERATIONS } = {}) {
    validatePlain(backup);
    if (typeof passphrase !== 'string' || passphrase === '') throw new BackupError('wrong-passphrase', 'Enter a passphrase.');
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const { key, check } = await deriveKeyAndCheck(passphrase, salt, iterations);
    const envelope = {
      app: BACKUP_APP,
      format: ENCRYPTED_FORMAT,
      formatVersion: FORMAT_VERSION,
      schemaVersion: backup.schemaVersion,
      exportedAt: backup.exportedAt,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
      cipher: { name: 'AES-GCM', iv: toBase64(iv) },
      check,
      ciphertext: '',
    };
    const plaintext = new TextEncoder().encode(JSON.stringify(backup));
    const sealed = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: headerBytes(envelope) }, key, plaintext);
    envelope.ciphertext = toBase64(sealed);
    return envelope;
  },

  /**
   * Opens an encrypted envelope.
   * @throws {BackupError} 'wrong-passphrase' | 'corrupted' | 'unsupported' | plain-backup validation codes
   */
  async decrypt(envelope, passphrase) {
    const { iterations } = envelope.kdf;
    if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
      throw new BackupError('corrupted', 'This encrypted backup has unexpected settings and may be damaged.');
    }
    const salt = fromBase64(envelope.kdf.salt);
    const iv = fromBase64(envelope.cipher.iv);
    const sealed = fromBase64(envelope.ciphertext);
    if (salt.length < 16 || iv.length !== 12 || sealed.length < 16) throw new BackupError('corrupted', 'This encrypted backup is damaged or incomplete.');

    const { key, check } = await deriveKeyAndCheck(passphrase, salt, iterations);
    if (!sameText(check, envelope.check)) {
      throw new BackupError('wrong-passphrase', 'That passphrase does not open this backup. Check it and try again.');
    }
    let backup;
    try {
      const plain = await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: headerBytes(envelope) }, key, sealed);
      backup = JSON.parse(new TextDecoder().decode(plain));
    } catch {
      throw new BackupError('corrupted', 'The passphrase is right, but the file has been changed or damaged and cannot be opened.');
    }
    return validatePlain(backup);
  },

  /**
   * Validates a plain backup and migrates its data to the current schema.
   * @returns {{data: object, version: number, applied: number[], summary: object}}
   */
  prepareImport(backup) {
    validatePlain(backup);
    const data = Object.fromEntries(Object.entries(backup.data).filter(([name]) => NAME_PATTERN.test(name) && !RESERVED_NAMES.has(name)));
    let result;
    try {
      result = runMigrations(data, backup.schemaVersion);
    } catch (error) {
      throw new BackupError(error.code === 'newer-version' ? 'newer-version' : 'invalid-data', error.message);
    }
    return { ...result, summary: this.summarize(result.data, backup) };
  },

  /** Counts what a backup holds, for the confirmation step. */
  summarize(data, backup = {}) {
    const plannedMeals = isPlainObject(data.plan)
      ? Object.values(data.plan).reduce((sum, day) => sum + (isPlainObject(day) ? Object.values(day).filter(Boolean).length : 0), 0)
      : 0;
    return {
      exportedAt: backup.exportedAt ?? null,
      account: backup.account ?? null,
      hasProfile: isPlainObject(data.profile),
      recipes: Array.isArray(data.recipes) ? data.recipes.length : 0,
      plannedMeals,
      supplements: Array.isArray(data.supplements?.selected) ? data.supplements.selected.length : 0,
      groceryChecked: Array.isArray(data.grocery?.checked) ? data.grocery.checked.length : 0,
      customFoods: Array.isArray(data.customFoods) ? data.customFoods.length
        : isPlainObject(data.customFoods) ? Object.keys(data.customFoods).length : 0,
      otherKeys: Object.keys(data).filter((k) => !['profile', 'recipes', 'plan', 'supplements', 'grocery', 'customFoods'].includes(k)),
    };
  },
};
