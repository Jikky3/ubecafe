import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blockLocalStorage, installLocalStorage } from './helpers/local-storage.js';
import { Storage } from '../js/storage.js';

let store;
beforeEach(() => {
  store = installLocalStorage();
  Storage.scope = null;
});

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

  it('removes one key in the active scope', () => {
    Storage.scope = 'ana@example.com';
    Storage.save(Storage.KEYS.plan, { monday: {} });
    Storage.remove(Storage.KEYS.plan);
    assert.equal(Storage.load(Storage.KEYS.plan, 'gone'), 'gone');
  });

  it('removeScope deletes only that account\'s keys', () => {
    Storage.save(Storage.KEYS.plan, 'guest');
    Storage.save(Storage.KEYS.theme, 'dark');
    Storage.scope = 'ana@example.com';
    Storage.save(Storage.KEYS.plan, 'ana');
    Storage.save(Storage.KEYS.grocery, 'ana');
    Storage.scope = 'bo@example.com';
    Storage.save(Storage.KEYS.plan, 'bo');

    Storage.removeScope('ana@example.com');
    assert.deepEqual(Object.keys(store).sort(), ['ubecafe.plan', 'ubecafe.theme', 'ubecafe.user:bo@example.com.plan']);
  });
});

describe('Storage load / save', () => {
  it('round-trips JSON values', () => {
    const value = { list: [1, 2, 3], nested: { ok: true } };
    Storage.save(Storage.KEYS.recipes, value);
    assert.equal(store.getItem('ubecafe.recipes'), JSON.stringify(value));
    assert.deepEqual(Storage.load(Storage.KEYS.recipes, null), value);
  });

  it('returns the fallback for missing or corrupt values', () => {
    assert.equal(Storage.load(Storage.KEYS.plan, 'fallback'), 'fallback');
    store.setItem('ubecafe.plan', '{not json');
    assert.equal(Storage.load(Storage.KEYS.plan, 'fallback'), 'fallback');
  });

  it('keeps working when storage is blocked', () => {
    blockLocalStorage();
    assert.equal(Storage.load(Storage.KEYS.plan, 'fallback'), 'fallback');
    assert.doesNotThrow(() => Storage.save(Storage.KEYS.plan, {}));
    assert.doesNotThrow(() => Storage.remove(Storage.KEYS.plan));
    assert.doesNotThrow(() => Storage.removeScope('ana@example.com'));
  });

  it('keeps working when the quota is exceeded', () => {
    store.setItem = () => { throw new Error('QuotaExceededError'); };
    assert.doesNotThrow(() => Storage.save(Storage.KEYS.plan, {}));
  });
});
