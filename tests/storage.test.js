import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS, MigrationError, runMigrations, validateSteps } from '../js/migrations.js';
import { Storage } from '../js/storage.js';

/** Minimal synchronous localStorage stand-in. */
const createLocalStorage = (entries = {}) => {
  const map = new Map(Object.entries(entries));
  return {
    map,
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
};

const unversionedPlan = { monday: { breakfast: 'seed-oats', lunch: 5 }, funday: { breakfast: 'x' } };

describe('migrations', () => {
  test('current schema version is the last step', () => {
    assert.equal(CURRENT_SCHEMA_VERSION, MIGRATIONS[MIGRATIONS.length - 1].version);
    assert.equal(CURRENT_SCHEMA_VERSION, 2);
  });

  test('v1 normalizes unversioned data to the shapes the UI expects', () => {
    const input = {
      profile: { age: 40 },
      recipes: [{ id: 'a', title: 'A', servings: '2', ingredientsText: '1 egg' }, { title: 'no id' }, 'junk'],
      plan: unversionedPlan,
      supplements: { selected: ['iron', 3], coffeeAtBreakfast: 0 },
      grocery: { household: 40, checked: ['eggs', null] },
      customFoods: [{ id: 'cf-1', name: 'Tempeh' }],
    };
    const { data, version, applied } = runMigrations(input, 0, MIGRATIONS.slice(0, 1));
    assert.equal(version, 1);
    assert.deepEqual(applied, [1]);
    assert.deepEqual(data.recipes, [{ id: 'a', title: 'A', servings: 2, ingredientsText: '1 egg', instructions: '' }]);
    assert.deepEqual(Object.keys(data.plan), ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
    assert.deepEqual(data.plan.monday, { breakfast: 'seed-oats', lunch: '', snack: '', dinner: '' });
    assert.deepEqual(data.supplements, { selected: ['iron'], coffeeAtBreakfast: false });
    assert.deepEqual(data.grocery, { household: 12, checked: ['eggs'] });
    assert.deepEqual(data.customFoods, input.customFoods, 'unknown keys pass through');
    assert.equal(input.plan.monday.lunch, 5, 'input is not mutated');
  });

  test('v1 drops values of the wrong type so seeds are used instead', () => {
    const { data } = runMigrations({ profile: [], recipes: {}, plan: 'x', supplements: null, grocery: 3 }, 0);
    assert.deepEqual(data, {});
  });

  test('already-current data is returned unchanged', () => {
    const data = { recipes: [{ id: 'a', title: 'A' }] };
    const result = runMigrations(data, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(result.applied, []);
    assert.deepEqual(result.data, data);
    assert.notEqual(result.data, data, 'a copy is returned');
  });

  test('steps run in order from the stored version only', () => {
    const calls = [];
    const steps = [
      { version: 1, migrate: (d) => { calls.push(1); return { ...d, a: 1 }; } },
      { version: 2, migrate: (d) => { calls.push(2); return { ...d, b: d.a + 1 }; } },
      { version: 3, migrate: (d) => { calls.push(3); return { ...d, c: d.b + 1 }; } },
    ];
    assert.deepEqual(runMigrations({}, 0, steps), { data: { a: 1, b: 2, c: 3 }, version: 3, applied: [1, 2, 3] });
    calls.length = 0;
    assert.deepEqual(runMigrations({ a: 1, b: 2 }, 2, steps).data, { a: 1, b: 2, c: 3 });
    assert.deepEqual(calls, [3]);
  });

  test('example: a future step can reshape the plan to several items per slot', () => {
    const future = {
      version: CURRENT_SCHEMA_VERSION + 1,
      migrate: (d) => (d.plan ? {
        ...d,
        plan: Object.fromEntries(Object.entries(d.plan).map(([day, slots]) => [day, Object.fromEntries(
          Object.entries(slots).map(([slot, id]) => [slot, id ? [{ recipeId: id, portion: 1 }] : []]),
        )])),
      } : d),
    };
    const { data } = runMigrations({ plan: unversionedPlan }, 0, [...MIGRATIONS, future]);
    assert.deepEqual(data.plan.monday.breakfast, [{ recipeId: 'seed-oats', portion: 1 }]);
    assert.deepEqual(data.plan.sunday.dinner, []);
  });

  test('v2 renames the profile `gender` field to `sex`', () => {
    const input = { profile: { age: 40, gender: 'female', weightKg: 60 }, recipes: [] };
    const { data, version, applied } = runMigrations(input, 1);
    assert.equal(version, 2);
    assert.deepEqual(applied, [2]);
    assert.deepEqual(data.profile, { age: 40, weightKg: 60, sex: 'female' });
    assert.ok(!('gender' in data.profile));
    assert.deepEqual(data.recipes, [], 'other keys pass through');
    assert.equal(input.profile.gender, 'female', 'input is not mutated');
  });

  test('v2 keeps an existing `sex` and drops the stale `gender`', () => {
    const { data } = runMigrations({ profile: { sex: 'male', gender: 'female' } }, 1);
    assert.deepEqual(data.profile, { sex: 'male' });
  });

  test('v2 is a no-op without a profile or without `gender`', () => {
    assert.deepEqual(runMigrations({ plan: {} }, 1).data, { plan: {} });
    assert.deepEqual(runMigrations({ profile: { sex: 'other', age: 30 } }, 1).data, { profile: { sex: 'other', age: 30 } });
    assert.deepEqual(runMigrations({}, 1).data, {});
  });

  test('unversioned profiles run v1 then v2', () => {
    const { data, applied } = runMigrations({ profile: { gender: 'male' } }, 0);
    assert.deepEqual(applied, [1, 2]);
    assert.deepEqual(data.profile, { sex: 'male' });
  });

  test('rejects newer, invalid and malformed inputs', () => {
    assert.throws(() => runMigrations({}, CURRENT_SCHEMA_VERSION + 1), (e) => e instanceof MigrationError && e.code === 'newer-version');
    assert.throws(() => runMigrations({}, -1), { code: 'invalid-version' });
    assert.throws(() => runMigrations({}, '1'), { code: 'invalid-version' });
    assert.throws(() => runMigrations([], 0), { code: 'invalid-data' });
    assert.throws(() => runMigrations({}, 0, [{ version: 1, migrate: () => null }]), { code: 'invalid-data' });
    assert.throws(() => validateSteps([{ version: 2, migrate() {} }, { version: 1, migrate() {} }]), { code: 'invalid-steps' });
    assert.throws(() => validateSteps([{ version: 1 }]), { code: 'invalid-steps' });
  });
});

describe('Storage', () => {
  beforeEach(() => { Storage.scope = null; });

  test('falls back to localStorage when IndexedDB is unavailable, and migrates every scope', async () => {
    const ls = createLocalStorage({
      'ubecafe.plan': JSON.stringify(unversionedPlan),
      'ubecafe.theme': JSON.stringify('dark'),
      'ubecafe.accounts': JSON.stringify({ 'a.b@x.org': { hash: 'h' } }),
      'ubecafe.user:a.b@x.org.recipes': JSON.stringify([{ id: 'r1', title: 'Soup', servings: 0 }]),
      'other.app': 'untouched',
    });
    assert.equal(await Storage.init({ indexedDB: null, localStorage: ls }), 'localStorage');

    assert.deepEqual(Storage.scopes().sort(), [null, 'a.b@x.org'].sort());
    assert.equal(ls.getItem('ubecafe.schemaVersion'), String(CURRENT_SCHEMA_VERSION));
    assert.equal(ls.getItem('ubecafe.user:a.b@x.org.schemaVersion'), String(CURRENT_SCHEMA_VERSION));
    assert.equal(Storage.load(Storage.KEYS.plan, null).monday.lunch, '');
    assert.equal(Storage.load(Storage.KEYS.theme, null), 'dark');
    assert.equal(ls.getItem('other.app'), 'untouched');
    assert.equal(ls.getItem('ubecafe.theme'), '"dark"', 'global keys are not migrated or rescoped');

    Storage.scope = 'a.b@x.org';
    assert.deepEqual(Storage.load(Storage.KEYS.recipes, []), [{ id: 'r1', title: 'Soup', servings: 1, ingredientsText: '', instructions: '' }]);
    assert.equal(Storage.load(Storage.KEYS.theme, null), 'dark', 'global keys ignore the scope');
  });

  test('init migrates a stored v1 profile from `gender` to `sex`', async () => {
    const ls = createLocalStorage({
      'ubecafe.schemaVersion': '1',
      'ubecafe.profile': JSON.stringify({ age: 33, gender: 'female' }),
    });
    await Storage.init({ indexedDB: null, localStorage: ls });
    assert.deepEqual(Storage.load(Storage.KEYS.profile, null), { age: 33, sex: 'female' });
    await Storage.flush();
    assert.equal(ls.getItem('ubecafe.schemaVersion'), String(CURRENT_SCHEMA_VERSION));
    assert.deepEqual(JSON.parse(ls.getItem('ubecafe.profile')), { age: 33, sex: 'female' });
  });

  test('saves write through to the backend and stamp the schema version', async () => {
    const ls = createLocalStorage();
    await Storage.init({ indexedDB: null, localStorage: ls });
    Storage.scope = 'me@x.org';
    Storage.save(Storage.KEYS.grocery, { household: 2, checked: [] });
    Storage.save(Storage.KEYS.session, 'me@x.org');
    await Storage.flush();
    assert.equal(ls.getItem('ubecafe.user:me@x.org.grocery'), '{"household":2,"checked":[]}');
    assert.equal(ls.getItem('ubecafe.user:me@x.org.schemaVersion'), String(CURRENT_SCHEMA_VERSION));
    assert.equal(ls.getItem('ubecafe.session'), '"me@x.org"');
    assert.equal(ls.getItem('ubecafe.schemaVersion'), null, 'global keys do not create a guest version');

    const loaded = Storage.load(Storage.KEYS.grocery, null);
    loaded.household = 9;
    assert.equal(Storage.load(Storage.KEYS.grocery, null).household, 2, 'loads return fresh copies');

    Storage.remove(Storage.KEYS.grocery);
    assert.equal(Storage.load(Storage.KEYS.grocery, 'fallback'), 'fallback');
    Storage.removeScope('me@x.org');
    await Storage.flush();
    assert.deepEqual([...ls.map.keys()], ['ubecafe.session']);
  });

  test('uses IndexedDB failures as a cue to fall back', async () => {
    const ls = createLocalStorage({ 'ubecafe.profile': '{"age":50}' });
    const brokenIDB = { open() { throw new Error('SecurityError'); } };
    assert.equal(await Storage.init({ indexedDB: brokenIDB, localStorage: ls }), 'localStorage');
    assert.equal(Storage.load(Storage.KEYS.profile, {}).age, 50);
  });

  test('keeps working in memory when all storage is blocked', async () => {
    assert.equal(await Storage.init({ indexedDB: null, localStorage: null }), 'memory');
    Storage.save(Storage.KEYS.recipes, [{ id: 'x', title: 'X' }]);
    assert.equal(Storage.load(Storage.KEYS.recipes, []).length, 1);
    assert.equal(Storage.load(Storage.KEYS.plan, 'seed'), 'seed');
  });

  test('reads stay synchronous while an async backend writes in the background', async () => {
    const written = new Map();
    const backend = {
      name: 'fake',
      async readAll() { return new Map([['ubecafe.schemaVersion', String(CURRENT_SCHEMA_VERSION)], ['ubecafe.plan', '{"monday":{}}']]); },
      write: (key, value) => new Promise((resolve) => setTimeout(() => { written.set(key, value); resolve(); }, 5)),
    };
    assert.equal(await Storage.init({ backend, indexedDB: null, localStorage: null }), 'fake');
    Storage.save(Storage.KEYS.profile, { age: 30 });
    assert.equal(Storage.load(Storage.KEYS.profile, null).age, 30);
    assert.equal(written.size, 0);
    await Storage.flush();
    assert.equal(written.get('ubecafe.profile'), '{"age":30}');
  });

  test('a failing backend write is recorded without breaking the cache', async () => {
    const backend = { name: 'full', async readAll() { return new Map(); }, write: async () => { throw new Error('QuotaExceededError'); } };
    await Storage.init({ backend, indexedDB: null, localStorage: null });
    Storage.save(Storage.KEYS.profile, { age: 30 });
    await Storage.flush();
    assert.equal(Storage.lastError.message, 'QuotaExceededError');
    assert.equal(Storage.load(Storage.KEYS.profile, null).age, 30);
  });

  test('data from a newer app version is left untouched', async () => {
    const ls = createLocalStorage({ 'ubecafe.schemaVersion': '99', 'ubecafe.plan': '"future"' });
    await Storage.init({ indexedDB: null, localStorage: ls });
    assert.deepEqual(Storage.migrationIssues, [{ scope: null, version: 99, code: 'newer-version' }]);
    assert.equal(ls.getItem('ubecafe.plan'), '"future"');
  });

  test('replaceScopeData swaps one scope and cannot escape it', async () => {
    const ls = createLocalStorage({
      'ubecafe.schemaVersion': '1',
      'ubecafe.recipes': '[]',
      'ubecafe.grocery': '{"household":1,"checked":[]}',
      'ubecafe.accounts': '{}',
      'ubecafe.user:x@y.z.schemaVersion': '1',
      'ubecafe.user:x@y.z.plan': '{}',
    });
    await Storage.init({ indexedDB: null, localStorage: ls });
    Storage.replaceScopeData(null, {
      recipes: [{ id: 'n', title: 'New' }],
      customFoods: [],
      accounts: { evil: true },
      'user:x@y.z.plan': 'evil',
      '../theme': 'evil',
    });
    await Storage.flush();
    assert.deepEqual(Storage.scopeData(null), { recipes: [{ id: 'n', title: 'New' }], customFoods: [] });
    assert.equal(ls.getItem('ubecafe.grocery'), null, 'keys missing from the import are removed');
    assert.equal(ls.getItem('ubecafe.accounts'), '{}');
    assert.equal(ls.getItem('ubecafe.user:x@y.z.plan'), '{}');
    assert.equal(Storage.schemaVersionOf(null), CURRENT_SCHEMA_VERSION);
    assert.equal(Storage.schemaVersionOf('nobody@x.org'), null);
  });
});
