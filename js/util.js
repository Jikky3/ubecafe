import { NUTRIENT_KEYS } from './data/nutrients.js';
import { DAYS } from './data/constants.js';

/** Shared helpers. */
export const $ = (selector, root = document) => root.querySelector(selector);

export const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

/** Formats numbers with sensible precision for display. */
export const fmt = (value) => {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 1 : 2;
  return Number(value.toFixed(digits)).toLocaleString('en-US');
};

export const emptyNutrients = () => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0]));
export const addNutrients = (a, b) => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, a[k] + b[k]]));
export const scaleNutrients = (n, factor) => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, n[k] * factor]));

export const createId = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const todayKey = () => DAYS[(new Date().getDay() + 6) % 7];

/** Sends a short message to the global polite live region for screen readers. */
export const announce = (message) => {
  const region = $('#app-status');
  region.textContent = '';
  window.setTimeout(() => { region.textContent = message; }, 50);
};
