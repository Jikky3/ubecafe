import { normalizeText } from '../data/foods.js';
import { DIETS, MENTION_RESTRICTIONS, RESTRICTIONS, RESTRICTION_PATTERNS, SUBSTITUTES } from '../data/restrictions.js';
import { RecipeManager } from './recipe-manager.js';
import { addNutrients, emptyNutrients, scaleNutrients } from '../util.js';


export class SubstitutionEngine {
  static #cache = new WeakMap();

  /** Active restriction ids for a profile: chosen allergies plus the diet's exclusions. */
  static restrictionsFor(profile) {
    return [...new Set([...profile.allergies, ...DIETS[profile.diet].excludes])];
  }

  /** Restriction ids whose fallback keywords appear in a piece of text. */
  static scanKeywords(text) {
    const normalized = ` ${normalizeText(text)} `;
    return Object.keys(RESTRICTION_PATTERNS).filter((id) => RESTRICTION_PATTERNS[id].test(normalized));
  }

  /**
   * Restrictions an ingredient violates. Built-in foods use their dictionary tags. Custom foods carry
   * no tags, so their name and the line are scanned for keywords, as are unmatched lines.
   */
  static detect(ingredient) {
    const food = ingredient.food ?? (ingredient.foodId ? RecipeManager.getFood(ingredient.foodId) : null);
    let tags;
    if (food && !food.custom) tags = food.tags;
    else if (food) tags = [...this.scanKeywords(food.name), ...this.scanKeywords(ingredient.name)];
    else tags = this.scanKeywords(ingredient.name);
    // Allergens of a food named only as a product base ("walnut oil" matched as oil).
    const mentioned = (ingredient.mentions ?? []).flatMap((id) => RecipeManager.getFood(id)?.tags ?? [])
      .filter((t) => MENTION_RESTRICTIONS.includes(t));
    return [...new Set([...tags, ...mentioned])];
  }

  /** A substitute free of every active restriction, preferring food-specific options. */
  static pickSubstitute(restriction, foodId, active) {
    const options = SUBSTITUTES[restriction] ?? [];
    const isSafe = (option) => option.foodId === null
      || !(RecipeManager.getFood(option.foodId)?.tags ?? []).some((t) => active.includes(t));
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
    // A new analysis object (e.g. after custom foods change) invalidates the screened results.
    let entry = this.#cache.get(recipe);
    if (entry?.analysis !== analysis) {
      entry = { analysis, byKey: new Map() };
      this.#cache.set(recipe, entry);
    }
    const { byKey } = entry;
    if (byKey.has(key)) return byKey.get(key);

    const flagged = [];
    const ingredients = analysis.ingredients.map((ing) => {
      const hits = this.detect(ing).filter((t) => active.includes(t));
      if (!hits.length) return ing;
      const original = ing.food?.name ?? ing.name;
      const sub = hits.map((t) => this.pickSubstitute(t, ing.foodId, active)).find(Boolean) ?? null;
      flagged.push({
        raw: ing.raw,
        original,
        hits,
        isAllergy: hits.some((t) => profile.allergies.includes(t)),
        substitute: sub && {
          name: sub.foodId ? RecipeManager.getFood(sub.foodId).name : 'Omit',
          ratio: sub.ratio,
          note: sub.note,
        },
      });
      if (!sub) return { ...ing, blocked: true, nutrients: emptyNutrients() };
      if (sub.foodId === null) return { ...ing, omitted: true, grams: 0, nutrients: emptyNutrients(), swappedFrom: original };
      const food = RecipeManager.getFood(sub.foodId);
      const grams = ing.grams * sub.gramRatio;
      return {
        ...ing,
        foodId: food.id,
        food,
        grams,
        // A line marked "no nutrition" stays at zero; otherwise every nutrient comes from the substitute.
        nutrients: ing.matchSource === 'ignored' ? emptyNutrients() : scaleNutrients(food.nutrients, grams / 100),
        swappedFrom: original,
      };
    });

    const totals = ingredients.reduce((sum, ing) => addNutrients(sum, ing.nutrients), emptyNutrients());
    const result = {
      ingredients,
      totals,
      perServing: scaleNutrients(totals, 1 / Math.max(1, Number(recipe.servings) || 1)),
      unmatched: analysis.unmatched,
      unmatchedLines: analysis.unmatchedLines,
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
