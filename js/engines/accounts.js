import { Storage } from '../storage.js';

/**
 * Local, per-device user accounts.
 *
 * Accounts let several people share one browser with separate profiles,
 * recipes and plans. Credentials never leave the device: each password is
 * salted and stretched with PBKDF2-SHA-256 (Web Crypto) and only the hash is
 * stored. This is privacy separation, not server-grade security: anyone with
 * access to the browser's storage can read the (unencrypted) nutrition data.
 */

export class AccountManager {
  static ITERATIONS = 210000; // OWASP 2023 recommendation for PBKDF2-HMAC-SHA256

  static normalize(email) {
    return email.trim().toLowerCase();
  }

  static registry() {
    return Storage.load(Storage.KEYS.accounts, {});
  }

  static toBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  static fromBase64(text) {
    return Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
  }

  static async derive(password, salt, iterations) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
    return this.toBase64(bits);
  }

  /**
   * Signs in to an existing account (verifying the password) or creates a new one.
   * @returns {Promise<{email: string, created: boolean}>}
   * @throws {Error} message 'unsupported' | 'wrong-password'
   */
  static async signInOrCreate(rawEmail, password) {
    if (!window.crypto?.subtle) throw new Error('unsupported');
    const email = this.normalize(rawEmail);
    const accounts = this.registry();
    const existing = accounts[email];

    if (existing) {
      const hash = await this.derive(password, this.fromBase64(existing.salt), existing.iterations);
      if (hash !== existing.hash) throw new Error('wrong-password');
      return { email, created: false };
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    accounts[email] = {
      salt: this.toBase64(salt),
      hash: await this.derive(password, salt, this.ITERATIONS),
      iterations: this.ITERATIONS,
      createdAt: new Date().toISOString(),
    };
    Storage.save(Storage.KEYS.accounts, accounts);
    return { email, created: true };
  }

  static restoreSession() {
    const email = Storage.load(Storage.KEYS.session, null);
    return email && this.registry()[email] ? email : null;
  }

  static deleteAccount(email) {
    const accounts = this.registry();
    delete accounts[email];
    Storage.save(Storage.KEYS.accounts, accounts);
    Storage.removeScope(email);
  }
}
