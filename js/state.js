import { MEAL_SLOTS } from './data/constants.js';
import { DEFAULT_GROCERY, DEFAULT_PROFILE, DEFAULT_SUPPLEMENTS, SEED_PLAN, SEED_RECIPES } from './data/seeds.js';
import { BiometricsEngine } from './engines/biometrics.js';
import { RecipeParser } from './engines/recipe-parser.js';
import { Storage } from './storage.js';
import { todayKey } from './util.js';

/**
 * Reads the active scope's (guest or account) data, falling back to seeds.
 * Storage is filled asynchronously by Storage.init(), so `state` starts with
 * seeds and App.init() re-reads it once storage is ready.
 */
export const loadUserData = () => ({
  profile: { ...DEFAULT_PROFILE, ...Storage.load(Storage.KEYS.profile, {}) },
  recipes: Storage.load(Storage.KEYS.recipes, SEED_RECIPES),
  plan: Storage.load(Storage.KEYS.plan, SEED_PLAN),
  supplements: Storage.load(Storage.KEYS.supplements, DEFAULT_SUPPLEMENTS),
  grocery: Storage.load(Storage.KEYS.grocery, DEFAULT_GROCERY),
});

/** User data held in `state`; Storage may hold more keys (e.g. customFoods) for the same scope. */
export const USER_DATA_KEYS = ['profile', 'recipes', 'plan', 'supplements', 'grocery'];

/** Writes all user data to the active scope (used when a new account adopts guest data). */
export const saveUserData = () => {
  USER_DATA_KEYS.forEach((key) => Storage.save(Storage.KEYS[key], state[key]));
};

/** Everything the active user has, as exported in a backup: stored keys plus the live (possibly seeded) state. */
export const exportUserData = () => ({
  ...Storage.scopeData(),
  ...Object.fromEntries(USER_DATA_KEYS.map((key) => [key, structuredClone(state[key])])),
});

export const state = {
  ...loadUserData(),
  viewDay: todayKey(),
  editingId: null,
};

export const recipesById = () => new Map(state.recipes.map((r) => [r.id, r]));
export const currentTargets = () => BiometricsEngine.calculate(state.profile);

/** Returns each slot's planned recipe and per-serving nutrients for a day. */
export const mealsForDay = (day) => {
  const byId = recipesById();
  return Object.fromEntries(MEAL_SLOTS.map((slot) => {
    const recipe = byId.get(state.plan[day]?.[slot.id]);
    return [slot.id, recipe ? { recipe, nutrients: RecipeParser.analyze(recipe).perServing } : null];
  }));
};
