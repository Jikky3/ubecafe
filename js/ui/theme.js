import { $, announce } from '../util.js';
import { Storage } from '../storage.js';

export const ThemeUI = {
  init() {
    const button = $('#theme-toggle');
    const stored = Storage.load(Storage.KEYS.theme, null);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    if (stored) document.documentElement.dataset.theme = stored;
    const isDark = () => (document.documentElement.dataset.theme ?? (media.matches ? 'dark' : 'light')) === 'dark';
    const sync = () => button.setAttribute('aria-pressed', String(isDark()));
    sync();
    media.addEventListener('change', sync);
    button.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      Storage.save(Storage.KEYS.theme, next);
      sync();
      announce(`${next === 'dark' ? 'Dark' : 'Light'} theme on.`);
    });
  },
};
