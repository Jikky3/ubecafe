import { CURRENT_SCHEMA_VERSION, runMigrations } from './migrations.js';

/**
 * Key-value storage with a synchronous in-memory cache.
 *
 * Values are kept as JSON strings in a Map so `load` and `save` stay synchronous
 * for the UI. `Storage.init()` (awaited once before the app starts) fills the
 * cache from the best available backend and runs schema migrations:
 *
 *   1. IndexedDB ("ubecafe" database, "kv" store; one record per key). On first
 *      run the existing localStorage data is copied in, inside the upgrade
 *      transaction, and then removed from localStorage.
 *   2. localStorage, when IndexedDB is missing or fails to open (private mode,
 *      old browsers).
 *   3. Memory only, when both are blocked: the app works but forgets on reload.
 *
 * Saves update the cache immediately and are written through to the backend in
 * the background; `Storage.flush()` resolves when every pending write has landed.
 *
 * User data keys are namespaced per signed-in account ("ubecafe.user:<email>.plan");
 * guests use the bare keys. Device-wide keys (theme, account registry, session)
 * are never namespaced. Each scope stores its own `schemaVersion` (see migrations.js).
 */

const PREFIX = 'ubecafe.';
const USER_PREFIX = 'ubecafe.user:';
const DB_NAME = 'ubecafe';
const DB_VERSION = 1;
const STORE = 'kv';
const OPEN_TIMEOUT_MS = 4000;
/** Data names must be plain identifiers so an imported file can never write outside its scope. */
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

const requestToPromise = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const transactionDone = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
});

const ownKeys = (ls) => {
  const keys = [];
  for (let i = 0; i < ls.length; i += 1) {
    const key = ls.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
};

/** localStorage, or null when access throws (blocked cookies, sandboxed frames). */
const safeLocalStorage = () => {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    ls.getItem(`${PREFIX}probe`);
    return ls;
  } catch {
    return null;
  }
};

/** Backend that reads and writes localStorage directly. */
export const createLocalStorageBackend = (ls) => ({
  name: 'localStorage',
  async readAll() {
    return new Map(ownKeys(ls).map((key) => [key, ls.getItem(key)]));
  },
  async write(key, value) {
    if (value === null) ls.removeItem(key);
    else ls.setItem(key, value);
  },
});

/** Backend that keeps nothing beyond this page load. */
export const createMemoryBackend = () => ({
  name: 'memory',
  async readAll() { return new Map(); },
  async write() {},
});

/**
 * Opens the IndexedDB backend. When the database is created for the first time,
 * every "ubecafe.*" localStorage entry is copied into it within the same
 * transaction; once that has committed the copies are removed from localStorage.
 */
export const openIndexedDBBackend = (idb, ls) => new Promise((resolve, reject) => {
  let migratedKeys = [];
  let upgraded = false;
  let settled = false;
  const request = idb.open(DB_NAME, DB_VERSION); // throws in some sandboxed contexts: rejects the promise
  const timer = setTimeout(() => {
    settled = true;
    reject(new Error('IndexedDB open timed out'));
  }, OPEN_TIMEOUT_MS);
  request.onupgradeneeded = (event) => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    upgraded = event.oldVersion === 0;
    if (upgraded && ls) {
      const store = request.transaction.objectStore(STORE);
      migratedKeys = ownKeys(ls);
      migratedKeys.forEach((key) => store.put(ls.getItem(key), key));
    }
  };
  request.onblocked = () => { /* another tab holds an old version open; wait for it or the timeout */ };
  request.onerror = () => {
    clearTimeout(timer);
    if (!settled) reject(request.error);
    settled = true;
  };
  request.onsuccess = () => {
    clearTimeout(timer);
    const db = request.result;
    if (settled) {
      // Opened after the timeout, so this session already fell back to localStorage.
      // Drop a freshly created database so the next run copies the newer localStorage data again.
      db.close();
      if (upgraded) idb.deleteDatabase(DB_NAME);
      return;
    }
    settled = true;
    db.onversionchange = () => db.close();
    resolve({
      name: 'indexedDB',
      migratedFromLocalStorage: migratedKeys.length,
      /** Called once the cache is filled: the localStorage copies are no longer needed. */
      afterLoad() {
        migratedKeys.forEach((key) => {
          try { ls.removeItem(key); } catch { /* harmless leftover; IndexedDB is the source of truth */ }
        });
      },
      async readAll() {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const [keys, values] = await Promise.all([requestToPromise(store.getAllKeys()), requestToPromise(store.getAll())]);
        return new Map(keys.map((key, i) => [String(key), values[i]]));
      },
      write(key, value) {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        if (value === null) store.delete(key);
        else store.put(value, key);
        return transactionDone(tx);
      },
    });
  };
});

export const Storage = {
  KEYS: {
    profile: 'ubecafe.profile',
    recipes: 'ubecafe.recipes',
    plan: 'ubecafe.plan',
    supplements: 'ubecafe.supplements',
    grocery: 'ubecafe.grocery',
    customFoods: 'ubecafe.customFoods',
    schemaVersion: 'ubecafe.schemaVersion',
    theme: 'ubecafe.theme',
    accounts: 'ubecafe.accounts',
    session: 'ubecafe.session',
  },
  GLOBAL_KEYS: new Set(['ubecafe.theme', 'ubecafe.accounts', 'ubecafe.session']),
  scope: null,

  /** 'indexedDB' | 'localStorage' | 'memory' once init() has run. */
  backendName: 'memory',
  cache: new Map(),
  backend: createMemoryBackend(),
  pending: new Set(),
  /** Scopes whose data is newer than this app understands; left untouched. */
  migrationIssues: [],
  /** Last background write error, if any (quota exceeded, storage cleared mid-session). */
  lastError: null,

  /**
   * Loads every stored key into the cache and migrates each scope. Never rejects.
   * @param {{indexedDB?: IDBFactory|null, localStorage?: Storage|null, backend?: object}} [options]
   *   Overrides for tests; by default the browser globals are used.
   */
  async init(options = {}) {
    const ls = 'localStorage' in options ? options.localStorage : safeLocalStorage();
    const idb = 'indexedDB' in options ? options.indexedDB : globalThis.indexedDB;
    this.cache = new Map();
    this.pending = new Set();
    this.migrationIssues = [];
    this.lastError = null;

    const candidates = [];
    if (options.backend) candidates.push(async () => options.backend);
    if (idb) candidates.push(() => openIndexedDBBackend(idb, ls));
    if (ls) candidates.push(async () => createLocalStorageBackend(ls));
    candidates.push(async () => createMemoryBackend());

    for (const open of candidates) {
      try {
        const backend = await open();
        this.cache = await backend.readAll();
        this.backend = backend;
        backend.afterLoad?.();
        break;
      } catch (error) {
        this.lastError = error;
      }
    }
    this.backendName = this.backend.name;
    this.migrateAll();
    await this.flush();
    return this.backendName;
  },

  resolve(key) {
    return this.resolveIn(key, this.scope);
  },
  resolveIn(key, scope) {
    return scope && !this.GLOBAL_KEYS.has(key) ? key.replace(PREFIX, `${USER_PREFIX}${scope}.`) : key;
  },

  /** Raw write-through: updates the cache now and the backend in the background. */
  write(resolvedKey, raw) {
    if (raw === null) this.cache.delete(resolvedKey);
    else this.cache.set(resolvedKey, raw);
    let job;
    try {
      job = Promise.resolve(this.backend.write(resolvedKey, raw));
    } catch (error) {
      job = Promise.reject(error);
    }
    const tracked = job.catch((error) => { this.lastError = error; }).finally(() => this.pending.delete(tracked));
    this.pending.add(tracked);
  },

  /** Resolves once every write issued so far has reached the backend (or failed). */
  async flush() {
    while (this.pending.size) await Promise.all([...this.pending]);
  },

  load(key, fallback) {
    const raw = this.cache.get(this.resolve(key));
    if (raw === undefined || raw === null || raw === '') return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  save(key, value) {
    const raw = JSON.stringify(value);
    if (raw === undefined) {
      this.remove(key);
      return;
    }
    if (!this.GLOBAL_KEYS.has(key) && key !== this.KEYS.schemaVersion) this.stampVersion(this.scope);
    this.write(this.resolve(key), raw);
  },
  remove(key) {
    const resolved = this.resolve(key);
    if (this.cache.has(resolved)) this.write(resolved, null);
  },

  /** Records the current schema version for a scope the first time current-shaped data is written to it. */
  stampVersion(scope) {
    const versionKey = this.resolveIn(this.KEYS.schemaVersion, scope);
    if (!this.cache.has(versionKey)) this.write(versionKey, JSON.stringify(CURRENT_SCHEMA_VERSION));
  },

  /** Resolved keys holding one scope's data (null = guest), including its schemaVersion. */
  keysOf(scope) {
    const keys = [...this.cache.keys()];
    if (scope) return keys.filter((k) => k.startsWith(`${USER_PREFIX}${scope}.`));
    return keys.filter((k) => k.startsWith(PREFIX) && !k.startsWith(USER_PREFIX) && !this.GLOBAL_KEYS.has(k));
  },

  /** Every scope with stored data: null for the guest plus each account email. */
  scopes() {
    const found = new Set(this.keysOf(null).length ? [null] : []);
    this.cache.forEach((_, key) => {
      if (!key.startsWith(USER_PREFIX)) return;
      const rest = key.slice(USER_PREFIX.length);
      found.add(rest.slice(0, rest.lastIndexOf('.')));
    });
    return [...found];
  },

  isDataName(name) {
    return NAME_PATTERN.test(name) && name !== 'schemaVersion' && !this.GLOBAL_KEYS.has(`${PREFIX}${name}`);
  },

  /** One scope's stored version: 0 for data saved before versioning, null when it has no data. */
  schemaVersionOf(scope = this.scope) {
    const raw = this.cache.get(this.resolveIn(this.KEYS.schemaVersion, scope));
    if (raw !== undefined) {
      try { return JSON.parse(raw); } catch { return 0; }
    }
    return Object.keys(this.scopeData(scope)).length ? 0 : null;
  },

  /** All stored user data of one scope as { profile, recipes, … } (short names, parsed). */
  scopeData(scope = this.scope) {
    const prefix = scope ? `${USER_PREFIX}${scope}.` : PREFIX;
    const data = {};
    this.keysOf(scope).forEach((key) => {
      const name = key.slice(prefix.length);
      if (!this.isDataName(name)) return;
      try { data[name] = JSON.parse(this.cache.get(key)); } catch { /* unreadable values are dropped */ }
    });
    return data;
  },

  /** Replaces all of one scope's data with `data` (short names) at the current schema version. */
  replaceScopeData(scope, data) {
    const names = Object.keys(data).filter((name) => this.isDataName(name));
    const keep = new Set(names.map((name) => this.resolveIn(`${PREFIX}${name}`, scope)));
    this.keysOf(scope).filter((key) => !keep.has(key)).forEach((key) => this.write(key, null));
    names.forEach((name) => {
      const raw = JSON.stringify(data[name]);
      if (raw !== undefined) this.write(this.resolveIn(`${PREFIX}${name}`, scope), raw);
    });
    this.write(this.resolveIn(this.KEYS.schemaVersion, scope), JSON.stringify(CURRENT_SCHEMA_VERSION));
  },

  /** Runs pending migrations for every scope. Scopes from a newer app version are left as they are. */
  migrateAll() {
    this.scopes().forEach((scope) => {
      const version = this.schemaVersionOf(scope);
      if (version === null || version === CURRENT_SCHEMA_VERSION) return;
      try {
        const result = runMigrations(this.scopeData(scope), version);
        this.replaceScopeData(scope, result.data);
      } catch (error) {
        this.migrationIssues.push({ scope, version, code: error.code ?? 'error' });
      }
    });
  },

  /** Deletes every key belonging to one account. */
  removeScope(scope) {
    if (!scope) return;
    this.keysOf(scope).forEach((key) => this.write(key, null));
  },
};
