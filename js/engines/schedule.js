import { MEAL_SLOTS, SLOT_BY_ID, SUPPLEMENT_BY_ID } from '../data/constants.js';
import { fmt } from '../util.js';

/** Meal timeline and supplement timing rules. */
export class ScheduleOptimizer {
  /**
   * @param {Object<string, {recipe, nutrients}|null>} meals – keyed by slot id
   * @param {string[]} selected – supplement ids
   * @param {boolean} coffeeAtBreakfast
   */
  static build(meals, selected, coffeeAtBreakfast) {
    const plan = Object.fromEntries(MEAL_SLOTS.map((s) => [s.id, []]));
    const has = (id) => selected.includes(id);
    const n = (slotId, key) => meals[slotId]?.nutrients[key] ?? 0;

    // Rule 1: fat-soluble nutrients go with the highest-fat meal (Dinner on ties / empty days).
    const fatSlot = [...MEAL_SLOTS].reverse()
      .reduce((best, slot) => (n(slot.id, 'fat') > n(best, 'fat') ? slot.id : best), 'dinner');
    const fatGrams = fmt(n(fatSlot, 'fat'));
    selected.filter((id) => SUPPLEMENT_BY_ID[id].fatSoluble).forEach((id) => {
      plan[fatSlot].push({
        id,
        reason: `Fat-soluble: taken with your highest-fat meal (${fatGrams} g fat) so it is absorbed with dietary fat.`,
      });
    });

    // Rule 2: iron goes with the most vitamin C, away from coffee and calcium.
    let ironSlot = null;
    if (has('iron')) {
      const candidates = MEAL_SLOTS.filter((s) => !(coffeeAtBreakfast && s.id === 'breakfast'));
      ironSlot = candidates.reduce((best, slot) => {
        const score = (id) => n(id, 'vitaminC') - n(id, 'calcium') / 10;
        return score(slot.id) > score(best.id) ? slot : best;
      }, candidates.find((s) => s.id === 'lunch')).id;
      const coffeeNote = coffeeAtBreakfast ? ' Kept away from breakfast coffee, whose polyphenols block absorption.' : '';
      plan[ironSlot].push({
        id: 'iron',
        reason: `Paired with ${fmt(n(ironSlot, 'vitaminC'))} mg vitamin C and only ${fmt(n(ironSlot, 'calcium'))} mg calcium in this meal; vitamin C boosts non-heme iron uptake.${coffeeNote}`,
      });
    }

    // Rule 3: vitamin C rides along with iron when both are taken.
    if (has('vitaminC')) {
      const slot = ironSlot ?? 'breakfast';
      plan[slot].push({
        id: 'vitaminC',
        reason: ironSlot ? 'Taken alongside iron to maximize iron absorption.' : 'Water-soluble; morning dosing with food is easy on the stomach.',
      });
    }

    // Rule 4: calcium is separated from iron.
    let calciumSlot = null;
    if (has('calcium')) {
      calciumSlot = ['snack', 'lunch', 'breakfast', 'dinner'].find((id) => id !== ironSlot);
      plan[calciumSlot].push({
        id: 'calcium',
        reason: ironSlot
          ? `Separated from iron (${SLOT_BY_ID[ironSlot].label}) because calcium competes for the same absorption pathway.`
          : 'Split from your largest meals to improve absorption of smaller calcium doses.',
      });
    }

    // Rule 5: magnesium in the evening for sleep and recovery.
    if (has('magnesium')) {
      plan.dinner.push({ id: 'magnesium', reason: 'Evening dose supports muscle recovery and relaxation before sleep.' });
    }

    // Rule 6: zinc away from both iron and calcium.
    if (has('zinc')) {
      const slot = ['lunch', 'dinner', 'breakfast', 'snack'].find((id) => id !== ironSlot && id !== calciumSlot);
      plan[slot].push({ id: 'zinc', reason: 'Kept apart from iron and calcium, which compete with zinc for absorption; taken with food to avoid nausea.' });
    }

    // Rule 7: B12 in the morning.
    if (has('vitaminB12')) {
      plan.breakfast.push({ id: 'vitaminB12', reason: 'Water-soluble and involved in energy metabolism, so it fits best in the morning.' });
    }

    return plan;
  }

  /** Food-based synergy tips for a single meal. */
  static mealTips(slotId, meal, coffeeAtBreakfast) {
    if (!meal) return [];
    const tips = [];
    const { iron, vitaminC, fat, vitaminA } = meal.nutrients;
    if (iron >= 3 && vitaminC < 25) tips.push('Iron-rich meal: add bell pepper, citrus or strawberries to boost absorption.');
    if (slotId === 'breakfast' && coffeeAtBreakfast && iron >= 3) tips.push('Wait about an hour after this meal before drinking coffee.');
    if (vitaminA >= 300 && fat < 5) tips.push('Add a little olive oil or avocado to absorb the vitamin A in this meal.');
    return tips;
  }
}
