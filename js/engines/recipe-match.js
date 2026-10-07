import { NUTRIENTS, NUTRIENT_BY_KEY } from '../data/nutrients.js';
import { RecipeManager } from './recipe-manager.js';

/**
 * Links nutrient gaps to concrete meals: how far a day is from a target,
 * which planned meals drive a nutrient, and which library recipes would help.
 * Pure functions; no DOM.
 */
export class RecipeMatcher {
  /** Share of the daily target a serving must reach to count as a "good source" (FDA uses 10–19 % / 20 %+). */
  static GOOD_SOURCE = 0.2;

  /**
   * Describes intake against target for one nutrient.
   * @returns {{key, intake, target, pct, remaining, over, direction: 'increase'|'decrease'}}
   */
  static gap(key, intake, targets) {
    const meta = NUTRIENT_BY_KEY[key];
    const value = intake[key] ?? 0;
    const target = targets[key] ?? 0;
    const pct = target > 0 ? Math.round((value / target) * 100) : 0;
    const over = Math.max(0, value - target);
    const direction = meta.isLimit || value > target ? 'decrease' : 'increase';
    return { key, intake: value, target, pct, remaining: Math.max(0, target - value), over, direction };
  }

  /**
   * Planned meals for a day ordered by how much of a nutrient they contribute.
   * @param {Object<string, {recipe, nutrients}|null>} meals – keyed by slot id
   * @returns {{slotId, recipe, amount, share}[]}
   */
  static contributors(meals, key, limit = 2) {
    const entries = Object.entries(meals).filter(([, meal]) => meal && meal.nutrients[key] > 0);
    const total = entries.reduce((sum, [, meal]) => sum + meal.nutrients[key], 0);
    return entries
      .map(([slotId, meal]) => ({ slotId, recipe: meal.recipe, amount: meal.nutrients[key], share: total ? meal.nutrients[key] / total : 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  /**
   * Ranks library recipes for a nutrient gap.
   * "increase" favours the most of the nutrient per serving (ties: fewer calories);
   * "decrease" favours the least, ignoring tiny snacks that could never replace a meal.
   * Recipes already planned for the day are listed last so suggestions add variety.
   * `analyze` lets callers apply the user's allergy and diet swaps; recipes it marks
   * unsafe (`isSafe === false`) are never suggested.
   * @returns {{recipe, amount, pctOfTarget, calories}[]}
   */
  static rankRecipes(recipes, key, { direction, target, excludeIds = [], limit = 2, analyze = (r) => RecipeManager.analyze(r) }) {
    const excluded = new Set(excludeIds);
    const scored = recipes.flatMap((recipe) => {
      const { perServing, isSafe } = analyze(recipe);
      if (isSafe === false) return [];
      return [{ recipe, amount: perServing[key], calories: perServing.calories, pctOfTarget: target > 0 ? Math.round((perServing[key] / target) * 100) : 0 }];
    });
    const pool = direction === 'increase'
      ? scored.filter((s) => s.amount > 0)
      : scored.filter((s) => s.calories >= 150 || key === 'calories');
    const sign = direction === 'increase' ? -1 : 1;
    return pool
      .sort((a, b) => (excluded.has(a.recipe.id) - excluded.has(b.recipe.id))
        || sign * (a.amount - b.amount)
        || a.calories - b.calories)
      .slice(0, limit);
  }

  /**
   * Nutrients a single serving supplies generously (≥ 20 % of the daily target).
   * Only micronutrients and protein: being "high in carbs" or sugar is not a selling point.
   * @returns {{key, label, amount, unit, pct}[]}
   */
  static highlights(perServing, targets) {
    return NUTRIENTS
      .filter((meta) => (meta.group === 'micro' || meta.key === 'protein') && !meta.isLimit && targets[meta.key] > 0)
      .map((meta) => ({ key: meta.key, label: meta.label, unit: meta.unit, amount: perServing[meta.key], pct: Math.round((perServing[meta.key] / targets[meta.key]) * 100) }))
      .filter((h) => h.pct >= this.GOOD_SOURCE * 100)
      .sort((a, b) => b.pct - a.pct);
  }
}
