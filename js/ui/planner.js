import { DAYS, DAY_LABELS, MEAL_SLOTS } from '../data/constants.js';
import { RESTRICTIONS } from '../data/restrictions.js';
import { App } from '../main.js';
import { analyzeForUser, blockedHits, state } from '../state.js';
import { Storage } from '../storage.js';
import { GroceryUI } from './grocery.js';
import { $, announce, escapeHTML, todayKey } from '../util.js';


export const PlannerUI = {
  init() {
    $('#planner-grid').addEventListener('change', (e) => {
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
      App.renderAll();
      announce('Weekly plan cleared.');
    });
  },

  render() {
    const labels = new Map(state.recipes.map((r) => {
      const { isSafe, flagged } = analyzeForUser(r);
      let suffix = '';
      if (!isSafe) suffix = ` (unavailable: contains ${blockedHits(flagged).map((t) => RESTRICTIONS[t].label.toLowerCase()).join(', ')})`;
      else if (flagged.length) suffix = ' (with swaps)';
      return [r.id, { text: `${r.title}${suffix}`, disabled: !isSafe }];
    }));
    const options = (selected) => ['<option value="">— No meal —</option>',
      ...state.recipes.map((r) => {
        const { text, disabled } = labels.get(r.id);
        return `<option value="${r.id}" ${r.id === selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${escapeHTML(text)}</option>`;
      })].join('');
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
