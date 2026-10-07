import { DAYS, DAY_LABELS, MEAL_SLOTS } from '../data/constants.js';
import { App } from '../main.js';
import { state } from '../state.js';
import { Storage } from '../storage.js';
import { GroceryUI } from './grocery.js';
import { $, announce, escapeHTML, todayKey } from '../util.js';

export const PlannerUI = {
  init() {
    const grid = $('#planner-grid');
    grid.addEventListener('change', (e) => {
      const { day, slot } = e.target.dataset;
      state.plan[day][slot] = e.target.value;
      Storage.save(Storage.KEYS.plan, state.plan);
      App.renderNutrition();
      GroceryUI.render();
    });
    $('#clear-week').addEventListener('click', () => {
      if (!window.confirm('Clear every meal from this week?')) return;
      DAYS.forEach((day) => MEAL_SLOTS.forEach((slot) => { state.plan[day][slot.id] = ''; }));
      Storage.save(Storage.KEYS.plan, state.plan);
      this.render();
      App.renderNutrition();
      GroceryUI.render();
      announce('Weekly plan cleared.');
    });
  },

  render() {
    const options = (selected) => ['<option value="">— No meal —</option>',
      ...state.recipes.map((r) => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${escapeHTML(r.title)}</option>`)].join('');
    $('#planner-grid').innerHTML = DAYS.map((day) => `
      <fieldset class="card day-card">
        <legend>${DAY_LABELS[day]}${day === todayKey() ? ' <span class="pill">Today</span>' : ''}</legend>
        ${MEAL_SLOTS.map((slot) => `
          <div class="field">
            <label for="plan-${day}-${slot.id}">${slot.label} <span class="field__hint">${slot.display}</span></label>
            <select id="plan-${day}-${slot.id}" data-day="${day}" data-slot="${slot.id}">${options(state.plan[day]?.[slot.id])}</select>
          </div>`).join('')}
      </fieldset>`).join('');
  },
};
