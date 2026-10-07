import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/local-storage.js';
import { Storage } from '../js/storage.js';

// Scoping rules for guest vs account data, run against the localStorage backend.
let store;
beforeEach(async () => {
  store = installLocalStorage();
  await Storage.init({ indexedDB: null, localStorage: store });
  Storage.scope = null;
});

const userKeys = () => Object.keys(store).filter((k) => !k.endsWith('.schemaVersion')).sort();

describe('Storage scoping', () => {
  it('uses bare keys for guests', () => {
    assert.equal(Storage.resolve(Storage.KEYS.plan), 'ubecafe.plan');
  });

  it('namespaces user data keys per account', () => {
    Storage.scope = 'ana@example.com';
    assert.equal(Storage.resolve(Storage.KEYS.plan), 'ubecafe.user:ana@example.com.plan');
    assert.equal(Storage.resolve(Storage.KEYS.recipes), 'ubecafe.user:ana@example.com.recipes');
  });

  it('never namespaces device-wide keys', () => {
    Storage.scope = 'ana@example.com';
    ['theme', 'accounts', 'session'].forEach((name) => {
      assert.equal(Storage.resolve(Storage.KEYS[name]), Storage.KEYS[name]);
    });
  });

  it('keeps guest and account data apart', () => {
    Storage.save(Storage.KEYS.profile, { age: 30 });
    Storage.scope = 'ana@example.com';
    assert.equal(Storage.load(Storage.KEYS.profile, null), null);
    Storage.save(Storage.KEYS.profile, { age: 40 });
    assert.deepEqual(Storage.load(Storage.KEYS.profile, null), { age: 40 });
    Storage.scope = null;
    assert.deepEqual(Storage.load(Storage.KEYS.profile, null), { age: 30 });
  });

  it('removeScope deletes only that account\'s keys', async () => {
    Storage.save(Storage.KEYS.plan, 'guest');
    Storage.save(Storage.KEYS.theme, 'dark');
    Storage.scope = 'ana@example.com';
    Storage.save(Storage.KEYS.plan, 'ana');
    Storage.save(Storage.KEYS.grocery, 'ana');
    Storage.scope = 'bo@example.com';
    Storage.save(Storage.KEYS.plan, 'bo');

    Storage.removeScope('ana@example.com');
    await Storage.flush();
    assert.deepEqual(userKeys(), ['ubecafe.plan', 'ubecafe.theme', 'ubecafe.user:bo@example.com.plan']);
  });

  it('round-trips JSON values through the backend', async () => {
    const value = { list: [1, 2, 3], nested: { ok: true } };
    Storage.save(Storage.KEYS.recipes, value);
    await Storage.flush();
    assert.equal(store.getItem('ubecafe.recipes'), JSON.stringify(value));
    assert.deepEqual(Storage.load(Storage.KEYS.recipes, null), value);
  });
});
