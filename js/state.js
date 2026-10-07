import { MEAL_SLOTS } from './data/constants.js';
import { DEFAULT_GROCERY, DEFAULT_PROFILE, DEFAULT_SUPPLEMENTS, DEFAULT_UI, SEED_PLAN, SEED_RECIPES } from './data/seeds.js';
import { NutritionEngine } from './engines/nutrition.js';
import { SubstitutionEngine } from './engines/substitution.js';
import { Storage } from './storage.js';
import { emptyNutrients, todayKey } from './util.js';


export const state = {
  account: null,
  profile: { ...DEFAULT_PROFILE },
  recipes: [],
  plan: {},
  supplements: DEFAULT_SUPPLEMENTS,
  grocery: DEFAULT_GROCERY,
  ui: DEFAULT_UI,
  viewDay: todayKey(),
};

/** Reads the signed-in account's data, falling back to defaults and the sample library. */
export const loadUserData = () => ({
  profile: { ...DEFAULT_PROFILE, ...Storage.load(Storage.KEYS.profile, {}) },
  recipes: Storage.load(Storage.KEYS.recipes, SEED_RECIPES),
  plan: Storage.load(Storage.KEYS.plan, SEED_PLAN),
  supplements: Storage.load(Storage.KEYS.supplements, DEFAULT_SUPPLEMENTS),
  grocery: Storage.load(Storage.KEYS.grocery, DEFAULT_GROCERY),
  ui: Storage.load(Storage.KEYS.ui, DEFAULT_UI),
});

export const USER_DATA_KEYS = ['profile', 'recipes', 'plan', 'supplements', 'grocery', 'ui'];

/** Everything the signed-in user has, as exported in a backup: stored keys plus the live (possibly seeded) state. */
export const exportUserData = () => ({
  ...Storage.scopeData(),
  ...Object.fromEntries(USER_DATA_KEYS.map((key) => [key, structuredClone(state[key])])),
});

export const recipesById = () => new Map(state.recipes.map((r) => [r.id, r]));

export const currentTargets = () => NutritionEngine.calculate(state.profile);

export const analyzeForUser = (recipe) => SubstitutionEngine.screen(recipe, state.profile);

export const firstName = () => state.account.fullName.split(/\s+/)[0];

/**
 * Each slot's planned recipe and per-serving nutrients for a day. Recipes that
 * cannot be made safe are marked `blocked` and contribute nothing.
 */
export const mealsForDay = (day) => {
  const byId = recipesById();
  return Object.fromEntries(MEAL_SLOTS.map((slot) => {
    const recipe = byId.get(state.plan[day]?.[slot.id]);
    if (!recipe) return [slot.id, null];
    const analysis = analyzeForUser(recipe);
    return [slot.id, {
      recipe,
      blocked: !analysis.isSafe,
      flagged: analysis.flagged,
      nutrients: analysis.isSafe ? analysis.perServing : emptyNutrients(),
    }];
  }));
};

/** Restriction ids that have no safe substitute in a screened recipe. */
export const blockedHits = (flagged) => [...new Set(flagged.filter((f) => !f.substitute).flatMap((f) => f.hits))];
