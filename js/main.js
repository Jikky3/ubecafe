import { $ } from './util.js';
import { loadUserData, state } from './state.js';
import { AccountUI } from './ui/account.js';
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
  init() {
    ThemeUI.init();
    AccountUI.init();
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

document.addEventListener('DOMContentLoaded', () => App.init());
