import { Storage } from '../storage.js';


export class AuthManager {
  static ITERATIONS = 210000; // OWASP 2023 recommendation for PBKDF2-HMAC-SHA256

  static normalize(email) {
    return email.trim().toLowerCase();
  }

  static registry() {
    return Storage.load(Storage.KEYS.accounts, {});
  }

  static account(email) {
    return this.registry()[email] ?? null;
  }

  static toBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  static fromBase64(text) {
    return Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
  }

  static async derive(password, salt, iterations) {
    if (!globalThis.crypto?.subtle) throw new Error('unsupported');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
    return this.toBase64(bits);
  }

  /** @throws {Error} 'exists' | 'unsupported' */
  static async register(fullName, rawEmail, password) {
    const email = this.normalize(rawEmail);
    const accounts = this.registry();
    if (accounts[email]) throw new Error('exists');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    accounts[email] = {
      fullName: fullName.trim(),
      salt: this.toBase64(salt),
      hash: await this.derive(password, salt, this.ITERATIONS),
      iterations: this.ITERATIONS,
      createdAt: new Date().toISOString(),
    };
    Storage.save(Storage.KEYS.accounts, accounts);
    Storage.save(Storage.KEYS.session, email);
    return email;
  }

  /** @throws {Error} 'invalid' | 'unsupported' (one message for unknown email or wrong password) */
  static async signIn(rawEmail, password) {
    const email = this.normalize(rawEmail);
    const existing = this.account(email);
    if (!existing) throw new Error('invalid');
    const hash = await this.derive(password, this.fromBase64(existing.salt), existing.iterations);
    if (hash !== existing.hash) throw new Error('invalid');
    Storage.save(Storage.KEYS.session, email);
    return email;
  }

  static restoreSession() {
    const email = Storage.load(Storage.KEYS.session, null);
    return email && this.account(email) ? email : null;
  }

  static signOut() {
    Storage.remove(Storage.KEYS.session);
  }

  static deleteAccount(email) {
    const accounts = this.registry();
    delete accounts[email];
    Storage.save(Storage.KEYS.accounts, accounts);
    Storage.removeScope(email);
    this.signOut();
  }
}
