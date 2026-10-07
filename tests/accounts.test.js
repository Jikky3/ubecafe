import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/local-storage.js';
import { AccountManager } from '../js/engines/accounts.js';
import { Storage } from '../js/storage.js';

// PBKDF2 at the production cost is slow; new test accounts use a low count.
// Verification always uses the count stored with the account.
const PRODUCTION_ITERATIONS = AccountManager.ITERATIONS;
AccountManager.ITERATIONS = 1000;
after(() => { AccountManager.ITERATIONS = PRODUCTION_ITERATIONS; });

beforeEach(() => {
  installLocalStorage();
  Storage.scope = null;
});

describe('AccountManager', () => {
  it('uses at least the OWASP 2023 PBKDF2 iteration count in production', () => {
    assert.ok(PRODUCTION_ITERATIONS >= 210000);
  });

  it('creates an account storing only a salted hash', async () => {
    const result = await AccountManager.signInOrCreate('ana@example.com', 'correct horse');
    assert.deepEqual(result, { email: 'ana@example.com', created: true });

    const record = AccountManager.registry()['ana@example.com'];
    assert.equal(record.iterations, 1000);
    assert.equal(AccountManager.fromBase64(record.salt).length, 16);
    assert.equal(AccountManager.fromBase64(record.hash).length, 32);
    assert.ok(!JSON.stringify(record).includes('correct horse'), 'the password is never stored');
    assert.ok(!Number.isNaN(Date.parse(record.createdAt)));
  });

  it('uses a fresh salt per account', async () => {
    await AccountManager.signInOrCreate('ana@example.com', 'same password');
    await AccountManager.signInOrCreate('bo@example.com', 'same password');
    const { 'ana@example.com': ana, 'bo@example.com': bo } = AccountManager.registry();
    assert.notEqual(ana.salt, bo.salt);
    assert.notEqual(ana.hash, bo.hash);
  });

  it('signs in to an existing account with the right password', async () => {
    await AccountManager.signInOrCreate('ana@example.com', 'correct horse');
    const result = await AccountManager.signInOrCreate('ana@example.com', 'correct horse');
    assert.deepEqual(result, { email: 'ana@example.com', created: false });
  });

  it('normalizes the email address', async () => {
    await AccountManager.signInOrCreate('  Ana@Example.COM ', 'pw');
    const result = await AccountManager.signInOrCreate('ana@example.com', 'pw');
    assert.equal(result.created, false);
    assert.deepEqual(Object.keys(AccountManager.registry()), ['ana@example.com']);
  });

  it('rejects a wrong password without changing the account', async () => {
    await AccountManager.signInOrCreate('ana@example.com', 'correct horse');
    const before = AccountManager.registry();
    await assert.rejects(AccountManager.signInOrCreate('ana@example.com', 'battery staple'), { message: 'wrong-password' });
    assert.deepEqual(AccountManager.registry(), before);
  });

  it('verifies with the iteration count stored on the account', async () => {
    await AccountManager.signInOrCreate('ana@example.com', 'pw');
    AccountManager.ITERATIONS = 2000;
    try {
      assert.equal((await AccountManager.signInOrCreate('ana@example.com', 'pw')).created, false);
    } finally {
      AccountManager.ITERATIONS = 1000;
    }
  });

  it('reports "unsupported" without Web Crypto', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
    try {
      await assert.rejects(AccountManager.signInOrCreate('ana@example.com', 'pw'), { message: 'unsupported' });
    } finally {
      Object.defineProperty(globalThis, 'crypto', descriptor);
    }
  });

  it('restores a session only for a registered account', async () => {
    assert.equal(AccountManager.restoreSession(), null);
    Storage.save(Storage.KEYS.session, 'ghost@example.com');
    assert.equal(AccountManager.restoreSession(), null);
    await AccountManager.signInOrCreate('ana@example.com', 'pw');
    Storage.save(Storage.KEYS.session, 'ana@example.com');
    assert.equal(AccountManager.restoreSession(), 'ana@example.com');
  });

  it('deletes an account and its data, leaving other accounts and guest data', async () => {
    await AccountManager.signInOrCreate('ana@example.com', 'pw');
    await AccountManager.signInOrCreate('bo@example.com', 'pw');
    Storage.save(Storage.KEYS.plan, 'guest plan');
    Storage.scope = 'ana@example.com';
    Storage.save(Storage.KEYS.plan, 'ana plan');
    Storage.scope = 'bo@example.com';
    Storage.save(Storage.KEYS.plan, 'bo plan');
    Storage.scope = null;

    AccountManager.deleteAccount('ana@example.com');

    assert.deepEqual(Object.keys(AccountManager.registry()), ['bo@example.com']);
    assert.equal(Storage.load(Storage.KEYS.plan, null), 'guest plan');
    Storage.scope = 'ana@example.com';
    assert.equal(Storage.load(Storage.KEYS.plan, null), null);
    Storage.scope = 'bo@example.com';
    assert.equal(Storage.load(Storage.KEYS.plan, null), 'bo plan');
  });

  it('lets a deleted email register again as a new account', async () => {
    await AccountManager.signInOrCreate('ana@example.com', 'old');
    AccountManager.deleteAccount('ana@example.com');
    const result = await AccountManager.signInOrCreate('ana@example.com', 'new');
    assert.equal(result.created, true);
  });
});
