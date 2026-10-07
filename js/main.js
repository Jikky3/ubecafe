import { DIETS } from './data/restrictions.js';
import { AuthManager } from './engines/auth.js';
import { NutritionEngine } from './engines/nutrition.js';
import { currentTargets, firstName, loadUserData, state } from './state.js';
import { Storage } from './storage.js';
import { AuthView } from './ui/auth-view.js';
import { DashboardUI, TargetsUI } from './ui/dashboard.js';
import { GroceryUI } from './ui/grocery.js';
import { RecipeLibrary } from './ui/library.js';
import { OnboardingWizard } from './ui/onboarding.js';
import { PlannerUI } from './ui/planner.js';
import { ProfileDrawer } from './ui/profile-drawer.js';
import { RecipeImporter } from './ui/recipe-importer.js';
import { RecommendationsUI } from './ui/recommendations.js';
import { ScheduleUI } from './ui/schedule.js';
import { Tabs } from './ui/tabs.js';
import { ThemeUI } from './ui/theme.js';
import { $, announce, fmt } from './util.js';


export const App = {
  importer: null,
  tabs: null,
  VIEWS: {
    auth: { el: '#auth-view', heading: '#auth-title', title: 'Ube Café Nutrition Planner: Meal Plans, Macro Targets & Grocery Lists' },
    onboarding: { el: '#onboarding-view', heading: '#wizard-title', title: 'Set up your profile · Ube Café' },
    app: { el: '#app-view', heading: '#app-title', title: 'Your meal plan · Ube Café' },
  },

  init() {
    ThemeUI.init();
    AuthView.init();
    OnboardingWizard.init();
    ProfileDrawer.init();
    DashboardUI.init();
    RecipeLibrary.init();
    PlannerUI.init();
    ScheduleUI.init();
    GroceryUI.init();
    this.importer = new RecipeImporter($('#library-importer'), {
      prefix: 'lib',
      onSaved: (recipe, isUpdate) => {
        this.renderAll();
        announce(`${isUpdate ? 'Updated' : 'Saved'} “${recipe.title}”. It is now available in the weekly planner.`);
      },
    });
    this.tabs = new Tabs($('#app-tablist'), {
      onChange: (id) => {
        state.ui = { ...state.ui, tab: id };
        if (state.account) Storage.save(Storage.KEYS.ui, state.ui);
      },
    });
    $('#year').textContent = String(new Date().getFullYear());

    const email = AuthManager.restoreSession();
    if (email) this.enter(email, { focus: false });
    else this.showView('auth', { focus: false });
  },

  /** Loads a signed-in account and routes to onboarding or the dashboard. */
  enter(email, { focus = true } = {}) {
    Storage.scope = email;
    state.account = { email, ...AuthManager.account(email) };
    Object.assign(state, loadUserData());
    if (!Storage.load(Storage.KEYS.recipes, null)) {
      // First sign-in: persist the sample library and plan for this account.
      Storage.save(Storage.KEYS.recipes, state.recipes);
      Storage.save(Storage.KEYS.plan, state.plan);
    }
    if (state.profile.onboarded) this.showApp({ focus });
    else OnboardingWizard.start('onboarding');
  },

  showView(name, { focus = true } = {}) {
    Object.entries(this.VIEWS).forEach(([key, view]) => { $(view.el).hidden = key !== name; });
    $('#profile-button').hidden = name !== 'app';
    document.title = this.VIEWS[name].title;
    window.scrollTo(0, 0);
    if (focus) $(this.VIEWS[name].heading).focus();
  },

  showApp({ focus = true } = {}) {
    ScheduleUI.syncForm();
    GroceryUI.syncForm();
    this.importer.reset();
    $('#app-name').textContent = firstName();
    this.renderAll();
    this.showView('app', { focus });
    this.tabs.select(state.ui.tab);
  },

  setViewDay(day) {
    state.viewDay = day;
    document.querySelectorAll('[data-day-select]').forEach((select) => { select.value = day; });
    this.renderNutrition();
  },

  /** Re-renders every recipe-dependent view. */
  renderAll() {
    RecipeLibrary.render();
    PlannerUI.render();
    this.renderNutrition();
    GroceryUI.render();
  },

  /** Re-renders everything derived from targets and the viewed day. */
  renderNutrition() {
    document.querySelectorAll('[data-day-select]').forEach((select) => { select.value = state.viewDay; });
    TargetsUI.render();
    const day = DashboardUI.render();
    RecommendationsUI.render(day);
    ScheduleUI.render(day.meals);
    ProfileDrawer.renderButton();
    const { profile } = state;
    $('#app-summary').textContent = `${NutritionEngine.GOALS[profile.goal].label} · ${DIETS[profile.diet].label} · ${fmt(currentTargets().targets.calories)} kcal a day`;
  },

  signOut(message) {
    const dialog = $('#profile-drawer');
    if (dialog.open) dialog.close();
    const name = state.account ? firstName() : '';
    AuthManager.signOut();
    Storage.scope = null;
    state.account = null;
    // Clear the previous user's rendered data from the hidden app view.
    ['#macro-list', '#micro-list', '#recommendation-list', '#targets-output', '#recipe-library', '#planner-grid', '#timeline', '#grocery-list']
      .forEach((sel) => { $(sel).innerHTML = ''; });
    AuthView.reset();
    this.showView('auth');
    announce(message ?? `Signed out${name ? `. See you soon, ${name}` : ''}.`);
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
