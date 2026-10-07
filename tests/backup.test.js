import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BackupEngine, BackupError, ENCRYPTED_FORMAT, fromBase64, toBase64 } from '../js/engines/backup.js';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from '../js/migrations.js';

const root = path.resolve(import.meta.dirname, '..');
const FAST = { iterations: 100000 }; // the minimum accepted; keeps the suite quick

const sampleData = () => ({
  profile: { units: 'metric', age: 41, sex: 'male', heightCm: 180, weightKg: 80 },
  recipes: [
    { id: 'r1', title: 'Café Soup', servings: 2, ingredientsText: '1 cup lentils', instructions: 'Simmer.' },
    { id: 'r2', title: 'Toast', servings: 1, ingredientsText: '1 slice bread', instructions: '' },
  ],
  plan: {
    monday: { breakfast: 'r2', lunch: 'r1', snack: '', dinner: 'r1' },
    tuesday: { breakfast: '', lunch: '', snack: '', dinner: '' },
    wednesday: { breakfast: '', lunch: '', snack: '', dinner: '' },
    thursday: { breakfast: '', lunch: '', snack: '', dinner: '' },
    friday: { breakfast: '', lunch: '', snack: '', dinner: '' },
    saturday: { breakfast: '', lunch: '', snack: '', dinner: '' },
    sunday: { breakfast: '', lunch: '', snack: '', dinner: '' },
  },
  supplements: { selected: ['iron', 'vitaminD3'], coffeeAtBreakfast: false },
  grocery: { household: 2, checked: ['bread'] },
  customFoods: [{ id: 'cf-1', name: 'Ube jam' }],
});

const expectCode = (code) => (error) => error instanceof BackupError && error.code === code;

describe('plain backups', () => {
  test('export → file text → import round trip', () => {
    const now = new Date('2026-10-07T08:30:00Z');
    const file = BackupEngine.create({ data: sampleData(), account: 'me@x.org', now });
    assert.equal(file.app, 'ubecafe');
    assert.equal(file.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(file.exportedAt, '2026-10-07T08:30:00.000Z');
    assert.equal(BackupEngine.fileName(file), 'ubecafe-backup-2026-10-07.json');

    const parsed = BackupEngine.parse(BackupEngine.serialize(file));
    assert.equal(BackupEngine.isEncrypted(parsed), false);
    const { data, version, summary } = BackupEngine.prepareImport(parsed);
    assert.equal(version, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(data, sampleData());
    assert.deepEqual(summary, {
      exportedAt: '2026-10-07T08:30:00.000Z', account: 'me@x.org', hasProfile: true, recipes: 2,
      plannedMeals: 3, supplements: 2, groceryChecked: 1, customFoods: 1, hasUiState: false, otherKeys: [],
    });
  });

  test('summary reports saved UI state separately from other keys', () => {
    const summary = BackupEngine.summarize({ ...sampleData(), ui: { tab: 'tab-grocery' }, extra: 1 });
    assert.equal(summary.hasUiState, true);
    assert.deepEqual(summary.otherKeys, ['extra']);
  });

  test('device-wide and unsafe keys never enter a backup or an import', () => {
    const file = BackupEngine.create({ data: { ...sampleData(), accounts: { a: 1 }, schemaVersion: 1, 'user:x.plan': 1 } });
    assert.deepEqual(Object.keys(file.data).sort(), Object.keys(sampleData()).sort());
    file.data.session = 'someone';
    file.data['../evil'] = 1;
    const { data } = BackupEngine.prepareImport(file);
    assert.equal('session' in data, false);
    assert.equal('../evil' in data, false);
  });

  test('unversioned (v0) backups are migrated on import', () => {
    const legacy = { app: 'ubecafe', format: 'ubecafe-backup', schemaVersion: 0, exportedAt: null, data: { plan: { monday: { lunch: 'r1' } } } };
    const { data, applied } = BackupEngine.prepareImport(BackupEngine.parse(JSON.stringify(legacy)));
    assert.deepEqual(applied, MIGRATIONS.map((m) => m.version));
    assert.deepEqual(data.plan.monday, { breakfast: '', lunch: 'r1', snack: '', dinner: '' });
  });

  test('v1 backups with a legacy `gender` profile are imported with `sex`', () => {
    const legacy = { app: 'ubecafe', format: 'ubecafe-backup', schemaVersion: 1, exportedAt: null, data: { profile: { age: 41, gender: 'male' } } };
    const { data, applied } = BackupEngine.prepareImport(BackupEngine.parse(JSON.stringify(legacy)));
    assert.deepEqual(applied, [2]);
    assert.deepEqual(data.profile, { age: 41, sex: 'male' });
  });

  test('rejects files that are not usable backups', () => {
    assert.throws(() => BackupEngine.parse('not json'), expectCode('not-json'));
    assert.throws(() => BackupEngine.parse('{"hello":"world"}'), expectCode('not-backup'));
    assert.throws(() => BackupEngine.parse('[]'), expectCode('not-backup'));
    const base = { app: 'ubecafe', format: 'ubecafe-backup', schemaVersion: 1, data: {} };
    assert.throws(() => BackupEngine.parse(JSON.stringify({ ...base, schemaVersion: 99 })), expectCode('newer-version'));
    assert.throws(() => BackupEngine.parse(JSON.stringify({ ...base, schemaVersion: '1' })), expectCode('invalid-data'));
    assert.throws(() => BackupEngine.parse(JSON.stringify({ ...base, data: [] })), expectCode('invalid-data'));
    assert.throws(() => BackupEngine.parse('x'.repeat(21 * 1024 * 1024)), expectCode('too-large'));
  });
});

describe('encrypted backups', () => {
  const plain = () => BackupEngine.create({ data: sampleData(), account: null, now: new Date('2026-10-07T00:00:00Z') });

  test('encrypt → file text → decrypt round trip with the default 210k iterations', async () => {
    const envelope = await BackupEngine.encrypt(plain(), 'correct horse battery');
    assert.equal(envelope.format, ENCRYPTED_FORMAT);
    assert.equal(envelope.kdf.iterations, 210000);
    assert.ok(BackupEngine.ITERATIONS >= 210000);
    assert.equal(fromBase64(envelope.kdf.salt).length, 16);
    assert.equal(fromBase64(envelope.cipher.iv).length, 12);
    assert.equal(envelope.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(BackupEngine.fileName(envelope), 'ubecafe-backup-2026-10-07.encrypted.json');
    const text = BackupEngine.serialize(envelope);
    assert.equal(text.includes('Café Soup'), false, 'no plaintext in the file');

    const parsed = BackupEngine.parse(text);
    assert.equal(BackupEngine.isEncrypted(parsed), true);
    const opened = await BackupEngine.decrypt(parsed, 'correct horse battery');
    assert.deepEqual(BackupEngine.prepareImport(opened).data, sampleData());
  });

  test('each encryption uses a fresh salt and IV', async () => {
    const [a, b] = await Promise.all([BackupEngine.encrypt(plain(), 'passphrase', FAST), BackupEngine.encrypt(plain(), 'passphrase', FAST)]);
    assert.notEqual(a.kdf.salt, b.kdf.salt);
    assert.notEqual(a.cipher.iv, b.cipher.iv);
    assert.notEqual(a.ciphertext, b.ciphertext);
  });

  test('a wrong passphrase is reported as such', async () => {
    const envelope = await BackupEngine.encrypt(plain(), 'right passphrase', FAST);
    await assert.rejects(BackupEngine.decrypt(envelope, 'wrong passphrase'), expectCode('wrong-passphrase'));
  });

  test('damaged or edited files are reported as corrupted', async () => {
    const envelope = await BackupEngine.encrypt(plain(), 'passphrase', FAST);
    const bytes = fromBase64(envelope.ciphertext);
    bytes[5] ^= 0xff;
    await assert.rejects(BackupEngine.decrypt({ ...envelope, ciphertext: toBase64(bytes) }, 'passphrase'), expectCode('corrupted'));
    await assert.rejects(BackupEngine.decrypt({ ...envelope, exportedAt: '2020-01-01T00:00:00.000Z' }, 'passphrase'), expectCode('corrupted'));
    await assert.rejects(BackupEngine.decrypt({ ...envelope, cipher: { name: 'AES-GCM', iv: 'AAAA' } }, 'passphrase'), expectCode('corrupted'));
    await assert.rejects(BackupEngine.decrypt({ ...envelope, ciphertext: '***' }, 'passphrase'), expectCode('corrupted'));
    await assert.rejects(BackupEngine.decrypt({ ...envelope, kdf: { ...envelope.kdf, iterations: 10 } }, 'passphrase'), expectCode('corrupted'));
    const { check, ...noCheck } = envelope;
    assert.ok(check);
    assert.throws(() => BackupEngine.parse(JSON.stringify(noCheck)), expectCode('corrupted'));
  });

  test('base64 helpers handle large payloads', () => {
    const big = new Uint8Array(300000).map((_, i) => i % 256);
    assert.deepEqual(fromBase64(toBase64(big)), big);
  });
});

describe('service worker precache', () => {
  test('lists every JS module, icon and shell file, and each exists', async () => {
    const source = await fs.readFile(path.join(root, 'sw.js'), 'utf8');
    const shell = [...source.match(/const APP_SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const modules = (await fs.readdir(path.join(root, 'js'), { recursive: true }))
      .filter((f) => f.endsWith('.js')).map((f) => `js/${f.split(path.sep).join('/')}`);
    const icons = (await fs.readdir(path.join(root, 'icons'))).map((f) => `icons/${f}`);
    for (const file of [...modules, ...icons, 'index.html', 'styles.css', 'manifest.webmanifest']) {
      assert.ok(shell.includes(file), `${file} is missing from APP_SHELL in sw.js`);
    }
    for (const file of shell.filter((f) => f !== './')) {
      await assert.doesNotReject(fs.access(path.join(root, file)), `${file} is listed in sw.js but does not exist`);
    }
  });

  test('manifest icons exist and include maskable 192/512 PNGs', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.display, 'standalone');
    for (const size of ['192x192', '512x512']) {
      assert.ok(manifest.icons.some((i) => i.sizes === size && i.purpose === 'any'));
      assert.ok(manifest.icons.some((i) => i.sizes === size && i.purpose === 'maskable'));
    }
    for (const icon of manifest.icons) await fs.access(path.join(root, icon.src));
  });
});
