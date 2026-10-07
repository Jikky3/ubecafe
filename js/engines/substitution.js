import { FOOD_DB } from '../data/foods.js';
import { DIETS, RESTRICTIONS, RESTRICTION_PATTERNS, SUBSTITUTES } from '../data/restrictions.js';
import { RecipeManager } from './recipe-manager.js';
import { addNutrients, emptyNutrients, scaleNutrients } from '../util.js';


export class SubstitutionEngine {
  static #cache = new WeakMap();

  /** Active restriction ids for a profile: chosen allergies plus the diet's exclusions. */
  static restrictionsFor(profile) {
    return [...new Set([...profile.allergies, ...DIETS[profile.diet].excludes])];
  }

  /** Restrictions an ingredient violates: dictionary tags, else keyword scan. */
  static detect(ingredient) {
    if (ingredient.foodId) return FOOD_DB[ingredient.foodId].tags;
    const name = ` ${ingredient.name.toLowerCase().replace(/[^a-z\s]/g, ' ')} `;
    return Object.keys(RESTRICTION_PATTERNS).filter((id) => RESTRICTION_PATTERNS[id].test(name));
  }

  /** A substitute free of every active restriction, preferring food-specific options. */
  static pickSubstitute(restriction, foodId, active) {
    const options = SUBSTITUTES[restriction] ?? [];
    const isSafe = (option) => option.foodId === null || !FOOD_DB[option.foodId].tags.some((t) => active.includes(t));
    return options.find((o) => o.replaces?.includes(foodId) && isSafe(o))
      ?? options.find((o) => !o.replaces && isSafe(o))
      ?? null;
  }

  /**
   * Screens a recipe for a profile. Every violating ingredient is swapped for a safe
   * substitute (or omitted). `isSafe` is false when an allergen has no safe option;
   * such recipes are excluded from the planner, dashboard and grocery list.
   */
  static screen(recipe, profile) {
    const analysis = RecipeManager.analyze(recipe);
    const active = this.restrictionsFor(profile);
    if (!active.length) return { ...analysis, isSafe: true, flagged: [] };

    const key = [...active].sort().join('|');
    const byKey = this.#cache.get(recipe) ?? new Map();
    this.#cache.set(recipe, byKey);
    if (byKey.has(key)) return byKey.get(key);

    const flagged = [];
    const ingredients = analysis.ingredients.map((ing) => {
      const hits = this.detect(ing).filter((t) => active.includes(t));
      if (!hits.length) return ing;
      const original = ing.foodId ? FOOD_DB[ing.foodId].name : ing.name;
      const sub = hits.map((t) => this.pickSubstitute(t, ing.foodId, active)).find(Boolean) ?? null;
      flagged.push({
        raw: ing.raw,
        original,
        hits,
        isAllergy: hits.some((t) => profile.allergies.includes(t)),
        substitute: sub && {
          name: sub.foodId ? FOOD_DB[sub.foodId].name : 'Omit',
          ratio: sub.ratio,
          note: sub.note,
        },
      });
      if (!sub) return { ...ing, blocked: true, nutrients: emptyNutrients() };
      if (sub.foodId === null) return { ...ing, omitted: true, grams: 0, nutrients: emptyNutrients(), swappedFrom: original };
      const grams = ing.grams * sub.gramRatio;
      return {
        ...ing,
        foodId: sub.foodId,
        grams,
        nutrients: scaleNutrients(FOOD_DB[sub.foodId].nutrients, grams / 100),
        swappedFrom: original,
      };
    });

    const totals = ingredients.reduce((sum, ing) => addNutrients(sum, ing.nutrients), emptyNutrients());
    const result = {
      ingredients,
      totals,
      perServing: scaleNutrients(totals, 1 / Math.max(1, Number(recipe.servings) || 1)),
      unmatched: analysis.unmatched,
      isSafe: flagged.every((f) => f.substitute),
      flagged,
    };
    byKey.set(key, result);
    return result;
  }

  /** Accessible restriction badge: icon + text + screen-reader prefix, never color alone. */
  static badge(hits, { isAllergy = true, blocked = false } = {}) {
    const labels = hits.map((t) => RESTRICTIONS[t].label).join(', ');
    const level = blocked ? 'danger' : 'warn';
    return `<span class="badge badge--${level}"><span aria-hidden="true">${blocked ? '✕' : '!'}</span><span class="sr-only">${isAllergy ? 'Allergen warning:' : 'Diet conflict:'}</span> ${labels}</span>`;
  }
}
