import { DAYS, MEAL_SLOTS, SUPPLEMENT_BY_ID } from '../data/constants.js';
import { FOOD_DB } from '../data/foods.js';
import { AISLES, PANTRY, SPICES } from '../data/nutrients.js';
import { recipesById } from '../state.js';
import { fmt } from '../util.js';


export class GroceryAggregator {
  /**
   * @param {(recipe) => {isSafe: boolean, ingredients: Array}} analyze – restriction-aware analyzer;
   *   unsafe recipes are skipped and substituted ingredients are bought instead of the originals.
   */
  static aggregate(plan, recipesById, household, supplementIds, analyze) {
    const items = new Map();

    DAYS.forEach((day) => MEAL_SLOTS.forEach((slot) => {
      const recipe = recipesById.get(plan[day]?.[slot.id]);
      if (!recipe) return;
      const analysis = analyze(recipe);
      if (!analysis.isSafe) return;
      const factor = household / Math.max(1, recipe.servings);
      analysis.ingredients.forEach((ing) => {
        if (ing.omitted) return;
        if (ing.foodId) {
          const food = ing.food ?? FOOD_DB[ing.foodId];
          const entry = items.get(food.id) ?? { key: food.id, name: food.name, aisle: food.aisle, grams: 0, food, replaces: new Set() };
          entry.grams += ing.grams * factor;
          if (ing.swappedFrom) entry.replaces.add(ing.swappedFrom.toLowerCase());
          items.set(food.id, entry);
        } else {
          const key = `x:${ing.name.toLowerCase().replace(/[^a-z]+/g, '-')}:${ing.unit ?? 'unit'}`;
          const entry = items.get(key) ?? { key, name: ing.name, aisle: PANTRY, qty: 0, unit: ing.unit };
          entry.qty += ing.qty * factor;
          items.set(key, entry);
        }
      });
    }));

    supplementIds.forEach((id) => {
      items.set(`s:${id}`, { key: `s:${id}`, name: SUPPLEMENT_BY_ID[id].label, aisle: SPICES, note: 'check supply' });
    });

    return AISLES.map((aisle) => ({
      aisle,
      items: [...items.values()]
        .filter((item) => item.aisle === aisle)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({ ...item, amount: this.formatAmount(item) })),
    })).filter((group) => group.items.length > 0);
  }

  static formatAmount(item) {
    if (item.note) return item.note;
    if (item.grams === undefined) {
      const qty = Math.round(item.qty * 100) / 100;
      return item.unit && item.unit !== 'unit' ? `${qty} ${item.unit}` : `${qty}×`;
    }
    const grams = item.grams > 50 ? Math.round(item.grams / 5) * 5 : Math.max(1, Math.round(item.grams));
    const weight = grams >= 1000 ? `${fmt(grams / 1000)} kg` : `${grams} g`;
    if (item.food.count) {
      const size = item.food.count === 'cans' ? item.food.gPerCan : item.food.gPerUnit;
      return `${Math.ceil(item.grams / size - 0.15)} ${item.food.count} (${weight})`;
    }
    return weight;
  }
}
