import { $ } from './util.js';
import { loadUserData, state } from './state.js';
import { Storage } from './storage.js';
import { AccountUI } from './ui/account.js';
import { BackupUI } from './ui/backup.js';
import { DashboardUI } from './ui/dashboard.js';
import { GroceryUI } from './ui/grocery.js';
import { PlannerUI } from './ui/planner.js';
import { ProfileUI } from './ui/profile.js';
import { RecipeView } from './ui/recipe-view.js';
import { RecipeUI } from './ui/recipes.js';
import { RecommendationsUI } from './ui/recommendations.js';
import { ScheduleUI } from './ui/schedule.js';
import { ThemeUI } from './ui/theme.js';

export const App = {
  /** Runs after `await Storage.init()`, so every Storage.load below is served from the filled cache. */
  init() {
    Object.assign(state, loadUserData());
    ThemeUI.init();
    AccountUI.init();
    BackupUI.init();
    ProfileUI.init();
    DashboardUI.init();
    ScheduleUI.init();
    RecipeUI.init();
    PlannerUI.init();
    GroceryUI.init();
    RecipeView.init();
    $('#year').textContent = String(new Date().getFullYear());
    this.renderRecipesChanged();
    RecipeView.openFromHash();
  },

  /** Swaps in the active scope's data (after sign-in / sign-out) and refreshes every view. */
  reloadUserData() {
    Object.assign(state, loadUserData(), { editingId: null });
    RecipeUI.resetForm();
    ProfileUI.fill(state.profile);
    ScheduleUI.syncForm();
    GroceryUI.syncForm();
    this.renderRecipesChanged();
  },

  /** Re-renders everything derived from profile targets and the viewed day. */
  renderNutrition() {
    ProfileUI.renderTargets();
    const day = DashboardUI.render();
    RecommendationsUI.render(day);
    ScheduleUI.render(day.meals);
  },

  /** Re-renders views that list recipes, then everything downstream. */
  renderRecipesChanged() {
    RecipeUI.renderLibrary();
    PlannerUI.render();
    this.renderNutrition();
    GroceryUI.render();
  },
};

/**
 * Offline support. The service worker serves cached files first, which would hide
 * edits during development, so it registers only on https origins (GitHub Pages,
 * any real deployment). To try it locally, open http://localhost:8080/?sw=1;
 * unregister it from DevTools > Application when done.
 */
const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const optIn = new URLSearchParams(location.search).has('sw');
  if (!(location.protocol === 'https:' && !local) && !(local && optIn)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
};

document.addEventListener('DOMContentLoaded', async () => {
  await Storage.init();
  App.init();
  registerServiceWorker();
});
