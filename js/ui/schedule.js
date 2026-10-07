import { MEAL_SLOTS, SUPPLEMENTS, SUPPLEMENT_BY_ID } from '../data/constants.js';
import { ScheduleOptimizer } from '../engines/schedule.js';
import { SubstitutionEngine } from '../engines/substitution.js';
import { blockedHits, mealsForDay, state } from '../state.js';
import { Storage } from '../storage.js';
import { GroceryUI } from './grocery.js';
import { $, escapeHTML, fmt } from '../util.js';

export const ScheduleUI = {
  init() {
    $('#supplement-options').innerHTML = SUPPLEMENTS.map((s) => `
      <div class="check">
        <input type="checkbox" id="supp-${s.id}" name="supplements" value="${s.id}">
        <label for="supp-${s.id}">${s.label}</label>
      </div>`).join('');
    $('#supplement-form').addEventListener('change', (e) => {
      if (e.target.matches('[data-day-select]')) return;
      state.supplements = {
        selected: [...document.querySelectorAll('input[name="supplements"]:checked')].map((i) => i.value),
        coffeeAtBreakfast: $('#coffee-breakfast').checked,
      };
      Storage.save(Storage.KEYS.supplements, state.supplements);
      this.render(mealsForDay(state.viewDay));
      GroceryUI.render();
    });
  },

  syncForm() {
    document.querySelectorAll('input[name="supplements"]').forEach((box) => { box.checked = state.supplements.selected.includes(box.value); });
    $('#coffee-breakfast').checked = state.supplements.coffeeAtBreakfast;
  },

  render(meals) {
    const { selected, coffeeAtBreakfast } = state.supplements;
    const schedule = ScheduleOptimizer.build(meals, selected, coffeeAtBreakfast);
    $('#timeline').innerHTML = MEAL_SLOTS.map((slot) => {
      const meal = meals[slot.id];
      let mealText = '<p class="timeline__meal timeline__meal--empty">No meal planned</p>';
      if (meal?.blocked) {
        mealText = `<p class="timeline__meal">${escapeHTML(meal.recipe.title)}</p>
          <p class="meta">${SubstitutionEngine.badge(blockedHits(meal.flagged), { blocked: true })} No safe substitute, so this meal is excluded. Choose another recipe.</p>`;
      } else if (meal) {
        const swaps = meal.flagged.map((f) => (f.substitute.name === 'Omit' ? `${f.original.toLowerCase()} omitted` : `${f.substitute.name} for ${f.original.toLowerCase()}`));
        mealText = `<p class="timeline__meal">${escapeHTML(meal.recipe.title)}</p>
          <p class="meta">${fmt(meal.nutrients.calories)} kcal · ${fmt(meal.nutrients.protein)} g protein · ${fmt(meal.nutrients.fat)} g fat · ${fmt(meal.nutrients.vitaminC)} mg vitamin C</p>
          ${swaps.length ? `<p class="meta">Swaps: ${escapeHTML(swaps.join('; '))}.</p>` : ''}`;
      }
      const tips = ScheduleOptimizer.mealTips(slot.id, meal?.blocked ? null : meal, coffeeAtBreakfast);
      const supps = schedule[slot.id].length
        ? `<ul class="supp-list">${schedule[slot.id].map((s) => `<li><strong>${SUPPLEMENT_BY_ID[s.id].label}</strong>: ${escapeHTML(s.reason)}</li>`).join('')}</ul>`
        : '';
      const tipList = tips.length ? `<ul class="tip-list">${tips.map((t) => `<li>${t}</li>`).join('')}</ul>` : '';
      return `
        <li class="timeline__item">
          <article class="card">
            <h3 class="timeline__heading"><time datetime="${slot.time}">${slot.display}</time> <span class="timeline__slot">${slot.label}</span></h3>
            ${mealText}${supps}${tipList}
          </article>
        </li>`;
    }).join('');
  },
};
