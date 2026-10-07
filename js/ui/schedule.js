import { MEAL_SLOTS, SUPPLEMENTS, SUPPLEMENT_BY_ID } from '../data/constants.js';
import { ScheduleOptimizer } from '../engines/schedule.js';
import { mealsForDay, state } from '../state.js';
import { Storage } from '../storage.js';
import { GroceryUI } from './grocery.js';
import { $, escapeHTML, fmt } from '../util.js';

export const ScheduleUI = {
  init() {
    this.syncForm();
    $('#supplement-form').addEventListener('change', () => {
      state.supplements = {
        selected: [...document.querySelectorAll('input[name="supplements"]:checked')].map((i) => i.value),
        coffeeAtBreakfast: $('#coffee-breakfast').checked,
      };
      Storage.save(Storage.KEYS.supplements, state.supplements);
      this.render(mealsForDay(state.viewDay));
      GroceryUI.render();
    });
  },

  /** Reflects the active user's supplement choices in the form. */
  syncForm() {
    $('#supplement-options').innerHTML = SUPPLEMENTS.map((s) => `
      <div class="check">
        <input type="checkbox" id="supp-${s.id}" name="supplements" value="${s.id}" ${state.supplements.selected.includes(s.id) ? 'checked' : ''}>
        <label for="supp-${s.id}">${s.label}</label>
      </div>`).join('');
    $('#coffee-breakfast').checked = state.supplements.coffeeAtBreakfast;
  },

  render(meals) {
    const { selected, coffeeAtBreakfast } = state.supplements;
    const schedule = ScheduleOptimizer.build(meals, selected, coffeeAtBreakfast);
    $('#timeline').innerHTML = MEAL_SLOTS.map((slot) => {
      const meal = meals[slot.id];
      const tips = ScheduleOptimizer.mealTips(slot.id, meal, coffeeAtBreakfast);
      const mealText = meal
        ? `<p class="timeline__meal"><button type="button" class="link-button" data-view-recipe="${escapeHTML(meal.recipe.id)}" data-day="${state.viewDay}" data-slot="${slot.id}">${escapeHTML(meal.recipe.title)}</button></p>
           <p class="timeline__meta">${fmt(meal.nutrients.calories)} kcal · ${fmt(meal.nutrients.protein)} g protein · ${fmt(meal.nutrients.fat)} g fat · ${fmt(meal.nutrients.vitaminC)} mg vitamin C</p>`
        : '<p class="timeline__meal timeline__meal--empty">No meal planned</p>';
      const supps = schedule[slot.id].length
        ? `<ul class="supp-list">${schedule[slot.id].map((s) => `
            <li><strong>${SUPPLEMENT_BY_ID[s.id].label}</strong>: ${escapeHTML(s.reason)}</li>`).join('')}</ul>`
        : '';
      const tipList = tips.length ? `<ul class="tip-list">${tips.map((t) => `<li>${t}</li>`).join('')}</ul>` : '';
      return `
        <li class="timeline__item">
          <article class="card timeline__card">
            <h3><time datetime="${slot.time}">${slot.display}</time> <span class="timeline__slot">${slot.label}</span></h3>
            ${mealText}${supps}${tipList}
          </article>
        </li>`;
    }).join('');
  },
};
