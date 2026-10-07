/**
 * Minimal in-memory Web Storage shim for Node tests.
 *
 * Items are stored as own enumerable properties (like a real Storage object),
 * so `Object.keys(localStorage)` lists the stored keys; the methods live on the
 * prototype and are not enumerated.
 */
export class MemoryStorage {
  get length() {
    return Object.keys(this).length;
  }

  key(index) {
    return Object.keys(this)[index] ?? null;
  }

  getItem(key) {
    return Object.hasOwn(this, key) ? this[key] : null;
  }

  setItem(key, value) {
    this[key] = String(value);
  }

  removeItem(key) {
    delete this[key];
  }

  clear() {
    Object.keys(this).forEach((key) => delete this[key]);
  }
}

/**
 * Installs a fresh MemoryStorage as globalThis.localStorage and returns it.
 * Call it again (e.g. in beforeEach) to start from an empty store.
 * @returns {MemoryStorage}
 */
export const installLocalStorage = () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  return storage;
};

/** Replaces globalThis.localStorage with a getter that throws, like a browser with storage blocked. */
export const blockLocalStorage = () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError: storage is blocked');
    },
  });
};
