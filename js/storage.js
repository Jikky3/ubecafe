/**
 * localStorage wrapper. User data keys are namespaced per signed-in account
 * ("ubecafe.user:<email>.plan"); guests use the bare keys. Device-wide keys
 * (theme, account registry, session) are never namespaced.
 */
export const Storage = {
  KEYS: {
    profile: 'ubecafe.profile',
    recipes: 'ubecafe.recipes',
    plan: 'ubecafe.plan',
    supplements: 'ubecafe.supplements',
    grocery: 'ubecafe.grocery',
    theme: 'ubecafe.theme',
    accounts: 'ubecafe.accounts',
    session: 'ubecafe.session',
  },
  GLOBAL_KEYS: new Set(['ubecafe.theme', 'ubecafe.accounts', 'ubecafe.session']),
  scope: null,

  resolve(key) {
    return this.scope && !this.GLOBAL_KEYS.has(key) ? key.replace('ubecafe.', `ubecafe.user:${this.scope}.`) : key;
  },
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(this.resolve(key));
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(this.resolve(key), JSON.stringify(value));
    } catch {
      /* Storage blocked (private mode / quota): the app keeps working in memory. */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(this.resolve(key));
    } catch {
      /* Nothing to remove when storage is unavailable. */
    }
  },
  /** Deletes every key belonging to one account. */
  removeScope(scope) {
    try {
      const prefix = `ubecafe.user:${scope}.`;
      Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* Nothing to remove when storage is unavailable. */
    }
  },
};

