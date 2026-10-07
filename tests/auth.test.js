import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/local-storage.js';
import { AuthManager } from '../js/engines/auth.js';
import { Storage } from '../js/storage.js';

// PBKDF2 at the production cost is slow; new test accounts use a low count.
// Verification always uses the count stored with the account.
const PRODUCTION_ITERATIONS = AuthManager.ITERATIONS;
AuthManager.ITERATIONS = 1000;
after(() => { AuthManager.ITERATIONS = PRODUCTION_ITERATIONS; });

let store;
beforeEach(async () => {
  store = installLocalStorage();
  await Storage.init({ indexedDB: null, localStorage: store }); // fresh cache per test
  Storage.scope = null;
});

const session = () => Storage.load(Storage.KEYS.session, null);

describe('AuthManager.register', () => {
  it('uses at least the OWASP 2023 PBKDF2 iteration count in production', () => {
    assert.ok(PRODUCTION_ITERATIONS >= 210000);
  });

  it('creates an account storing only a salted hash', async () => {
    const email = await AuthManager.register('  Ana Silva ', 'ana@example.com', 'correct horse');
    assert.equal(email, 'ana@example.com');

    const record = AuthManager.account('ana@example.com');
    assert.equal(record.fullName, 'Ana Silva');
    assert.equal(record.iterations, 1000);
    assert.equal(AuthManager.fromBase64(record.salt).length, 16);
    assert.equal(AuthManager.fromBase64(record.hash).length, 32);
    assert.ok(!JSON.stringify(record).includes('correct horse'), 'the password is never stored');
    assert.ok(!Number.isNaN(Date.parse(record.createdAt)));
  });

  it('saves the session for the new account', async () => {
    await AuthManager.register('Ana', 'ana@example.com', 'pw');
    assert.equal(session(), 'ana@example.com');
    assert.equal(AuthManager.restoreSession(), 'ana@example.com');
  });

  it('uses a fresh salt per account', async () => {
    await AuthManager.register('Ana', 'ana@example.com', 'same password');
    await AuthManager.register('Bo', 'bo@example.com', 'same password');
    const { 'ana@example.com': ana, 'bo@example.com': bo } = AuthManager.registry();
    assert.notEqual(ana.salt, bo.salt);
    assert.notEqual(ana.hash, bo.hash);
  });

  it('normalizes the email address', async () => {
    assert.equal(await AuthManager.register('Ana', '  Ana@Example.COM ', 'pw'), 'ana@example.com');
    assert.deepEqual(Object.keys(AuthManager.registry()), ['ana@example.com']);
  });

  it('rejects an email that already has an account, without changing it', async () => {
    await AuthManager.register('Ana', 'ana@example.com', 'correct horse');
    const before = AuthManager.registry();
    await assert.rejects(AuthManager.register('Impostor', 'ANA@example.com', 'other'), { message: 'exists' });
    assert.deepEqual(AuthManager.registry(), before);
  });

  it('reports "unsupported" without Web Crypto', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
    try {
      await assert.rejects(AuthManager.register('Ana', 'ana@example.com', 'pw'));
      await assert.rejects(AuthManager.derive('pw', new Uint8Array(16), 1000), { message: 'unsupported' });
    } finally {
      Object.defineProperty(globalThis, 'crypto', descriptor);
    }
    assert.equal(AuthManager.account('ana@example.com'), null);
  });
});

describe('AuthManager.signIn', () => {
  it('signs in to an existing account with the right password and saves the session', async () => {
    await AuthManager.register('Ana', 'ana@example.com', 'correct horse');
    AuthManager.signOut();
    assert.equal(session(), null);
    assert.equal(await AuthManager.signIn(' ANA@example.com', 'correct horse'), 'ana@example.com');
    assert.equal(session(), 'ana@example.com');
  });

  it('rejects a wrong password or an unknown email with the same message', async () => {
    await AuthManager.register('Ana', 'ana@example.com', 'correct horse');
    AuthManager.signOut();
    const before = AuthManager.registry();
    await assert.rejects(AuthManager.signIn('ana@example.com', 'battery staple'), { message: 'invalid' });
    await assert.rejects(AuthManager.signIn('ghost@example.com', 'correct horse'), { message: 'invalid' });
    assert.deepEqual(AuthManager.registry(), before);
    assert.equal(session(), null, 'a failed sign-in does not start a session');
  });

  it('verifies with the iteration count stored on the account', async () => {
    await AuthManager.register('Ana', 'ana@example.com', 'pw');
    AuthManager.ITERATIONS = 2000;
    try {
      assert.equal(await AuthManager.signIn('ana@example.com', 'pw'), 'ana@example.com');
    } finally {
      AuthManager.ITERATIONS = 1000;
    }
  });
});

describe('AuthManager sessions and deletion', () => {
  it('account() returns null for unknown emails', () => {
    assert.equal(AuthManager.account('nobody@example.com'), null);
  });

  it('restores a session only for a registered account', async () => {
    assert.equal(AuthManager.restoreSession(), null);
    Storage.save(Storage.KEYS.session, 'ghost@example.com');
    assert.equal(AuthManager.restoreSession(), null);
    await AuthManager.register('Ana', 'ana@example.com', 'pw');
    assert.equal(AuthManager.restoreSession(), 'ana@example.com');
  });

  it('signOut clears the session but keeps the account', async () => {
    await AuthManager.register('Ana', 'ana@example.com', 'pw');
    AuthManager.signOut();
    assert.equal(AuthManager.restoreSession(), null);
    assert.ok(AuthManager.account('ana@example.com'));
  });

  it('deletes an account and its data, leaving other accounts and guest data', async () => {
    await AuthManager.register('Ana', 'ana@example.com', 'pw');
    await AuthManager.register('Bo', 'bo@example.com', 'pw');
    Storage.save(Storage.KEYS.plan, 'guest plan');
    Storage.scope = 'ana@example.com';
    Storage.save(Storage.KEYS.plan, 'ana plan');
    Storage.scope = 'bo@example.com';
    Storage.save(Storage.KEYS.plan, 'bo plan');
    Storage.scope = null;

    AuthManager.deleteAccount('ana@example.com');

    assert.deepEqual(Object.keys(AuthManager.registry()), ['bo@example.com']);
    assert.equal(session(), null, 'deleting an account signs out');
    assert.equal(Storage.load(Storage.KEYS.plan, null), 'guest plan');
    Storage.scope = 'ana@example.com';
    assert.equal(Storage.load(Storage.KEYS.plan, null), null);
    Storage.scope = 'bo@example.com';
    assert.equal(Storage.load(Storage.KEYS.plan, null), 'bo plan');
  });

  it('lets a deleted email register again as a new account', async () => {
    await AuthManager.register('Ana', 'ana@example.com', 'old');
    AuthManager.deleteAccount('ana@example.com');
    await AuthManager.register('Ana', 'ana@example.com', 'new');
    AuthManager.signOut();
    assert.equal(await AuthManager.signIn('ana@example.com', 'new'), 'ana@example.com');
    await assert.rejects(AuthManager.signIn('ana@example.com', 'old'), { message: 'invalid' });
  });
});
