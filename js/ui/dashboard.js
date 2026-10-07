import { DAYS, DAY_LABELS, MEAL_SLOTS } from '../data/constants.js';
import { NUTRIENTS } from '../data/nutrients.js';
import { App } from '../main.js';
import { currentTargets, mealsForDay, state } from '../state.js';
import { $, addNutrients, emptyNutrients, fmt, todayKey } from '../util.js';

export const DashboardUI = {
  init() {
    const select = $('#view-day');
    select.innerHTML = DAYS.map((d) => `<option value="${d}">${DAY_LABELS[d]}${d === todayKey() ? ' (today)' : ''}</option>`).join('');
    select.value = state.viewDay;
    select.addEventListener('change', () => {
      state.viewDay = select.value;
      App.renderNutrition();
    });
  },

  status(meta, pct) {
    if (meta.isLimit) return pct <= 100 ? ['ok', 'Within limit'] : ['danger', 'Over limit'];
    if (meta.key === 'calories') {
      if (pct < 80) return ['warn', 'Under target'];
      return pct > 110 ? ['warn', 'Over target'] : ['ok', 'On target'];
    }
    if (meta.group === 'macro') {
      if (pct < 80) return ['warn', 'Low'];
      return pct > 125 && meta.key !== 'protein' ? ['warn', 'High'] : ['ok', 'On target'];
    }
    if (pct < 50) return ['danger', 'Deficient'];
    return pct < 80 ? ['warn', 'Low'] : ['ok', 'Met'];
  },

  row(meta, value, target) {
    const pct = target > 0 ? Math.round((value / target) * 100) : 0;
    const width = Math.min(pct, 100);
    const [level, text] = this.status(meta, pct);
    const icon = { ok: '✓', warn: '!', danger: '✕' }[level];
    const labelId = `nutrient-${meta.key}`;
    return `
      <li class="nutrient">
        <div class="nutrient__head">
          <span class="nutrient__label" id="${labelId}">${meta.label}</span>
          <span class="nutrient__value">${fmt(value)} / ${fmt(target)} ${meta.unit}</span>
          <span class="badge badge--${level}"><span aria-hidden="true">${icon}</span><span class="sr-only">Status:</span> ${text}</span>
        </div>
        <div class="bar" role="progressbar" aria-labelledby="${labelId}" aria-valuemin="0" aria-valuemax="100"
             aria-valuenow="${width}" aria-valuetext="${fmt(value)} of ${fmt(target)} ${meta.unit}, ${pct}% of ${meta.isLimit ? 'limit' : 'target'}">
          <span class="bar__fill bar__fill--${level}" style="width:${width}%"></span>
        </div>
      </li>`;
  },

  render() {
    const meals = mealsForDay(state.viewDay);
    const planned = Object.values(meals).filter(Boolean);
    const intake = planned.reduce((sum, m) => addNutrients(sum, m.nutrients), emptyNutrients());
    const { targets } = currentTargets();
    const lowCount = NUTRIENTS.filter((m) => m.group === 'micro' && intake[m.key] < targets[m.key] * 0.8).length;

    $('#dashboard-summary').textContent =
      `${DAY_LABELS[state.viewDay]}: ${planned.length} of ${MEAL_SLOTS.length} meals planned, ${fmt(intake.calories)} kcal. ` +
      `${lowCount} micronutrient${lowCount === 1 ? '' : 's'} below 80% of target.`;
    $('#macro-list').innerHTML = NUTRIENTS.filter((m) => m.group === 'macro').map((m) => this.row(m, intake[m.key], targets[m.key])).join('');
    $('#micro-list').innerHTML = NUTRIENTS.filter((m) => m.group === 'micro').map((m) => this.row(m, intake[m.key], targets[m.key])).join('');
    document.querySelectorAll('[data-day-label]').forEach((el) => { el.textContent = DAY_LABELS[state.viewDay]; });

    return { intake, targets, plannedCount: planned.length, meals };
  },
};
