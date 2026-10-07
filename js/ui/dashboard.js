import { DAYS, DAY_LABELS, MEAL_SLOTS } from '../data/constants.js';
import { NUTRIENTS } from '../data/nutrients.js';
import { NutritionEngine } from '../engines/nutrition.js';
import { App } from '../main.js';
import { currentTargets, mealsForDay, state } from '../state.js';
import { $, KG_PER_LB, addNutrients, emptyNutrients, fmt, todayKey } from '../util.js';


export const DashboardUI = {
  init() {
    document.querySelectorAll('[data-day-select]').forEach((select) => {
      select.innerHTML = DAYS.map((d) => `<option value="${d}">${DAY_LABELS[d]}${d === todayKey() ? ' (today)' : ''}</option>`).join('');
      select.addEventListener('change', () => App.setViewDay(select.value));
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
    const planned = Object.values(meals).filter((meal) => meal && !meal.blocked);
    const intake = planned.reduce((sum, m) => addNutrients(sum, m.nutrients), emptyNutrients());
    const { targets } = currentTargets();
    const lowCount = NUTRIENTS.filter((m) => m.group === 'micro' && !m.isLimit && intake[m.key] < targets[m.key] * 0.8).length;
    const overLimits = NUTRIENTS.filter((m) => m.isLimit && intake[m.key] > targets[m.key]).map((m) => m.label.toLowerCase());

    $('#dashboard-summary').textContent =
      `${DAY_LABELS[state.viewDay]}: ${planned.length} of ${MEAL_SLOTS.length} meals planned, ${fmt(intake.calories)} kcal. ` +
      `${lowCount} micronutrient${lowCount === 1 ? '' : 's'} below 80% of target. ` +
      (overLimits.length ? `Over the daily limit for ${overLimits.join(', ')}.` : 'Every daily limit respected.');
    $('#macro-list').innerHTML = NUTRIENTS.filter((m) => m.group === 'macro').map((m) => this.row(m, intake[m.key], targets[m.key])).join('');
    $('#micro-list').innerHTML = NUTRIENTS.filter((m) => m.group === 'micro').map((m) => this.row(m, intake[m.key], targets[m.key])).join('');
    document.querySelectorAll('[data-day-label]').forEach((el) => { el.textContent = DAY_LABELS[state.viewDay]; });
    return { intake, targets, plannedCount: planned.length, meals };
  },
};

export const TargetsUI = {
  render() {
    const { bmr, tdee, pace, projectedKg, targets } = currentTargets();
    const { profile } = state;
    const metric = profile.units === 'metric';
    const mass = (kg) => (metric ? `${fmt(Math.abs(kg))} kg` : `${fmt(Math.abs(kg) / KG_PER_LB)} lb`);
    const goal = NutritionEngine.GOALS[profile.goal].label;
    // The safety floor (1,200 / 1,500 kcal) can sit above a small, sedentary body's TDEE,
    // so a loss goal would project a gain; say so instead of promising weight loss.
    const floorBlocksLoss = profile.goal === 'loss' && projectedKg >= 0;
    const projection = profile.goal === 'maintain'
      ? 'Maintenance: calories match your daily energy expenditure.'
      : floorBlocksLoss
        ? `Your daily target is held at the ${fmt(targets.calories)} kcal safety minimum, which is at or above the ${fmt(tdee)} kcal you use each day, so this plan is not expected to cause weight loss. Talk to a registered dietitian or doctor about a safe approach.`
        : `${goal} over ${profile.timelineWeeks} weeks (${pace.toLowerCase()} pace): about ${mass(projectedKg)} ${projectedKg < 0 ? 'lost' : 'gained'} if followed consistently.`;
    const ketoNote = profile.diet === 'keto' ? '<p class="field__hint">Keto: carbohydrates capped at 30 g, with fat filling the remaining energy.</p>' : '';
    const rows = NUTRIENTS.map((meta) => `
      <tr><th scope="row">${meta.label}${meta.isLimit ? ' (max)' : ''}</th><td>${fmt(targets[meta.key])} ${meta.unit}</td></tr>`).join('');

    $('#targets-output').innerHTML = `
      <article class="card stack" aria-labelledby="energy-title">
        <h3 id="energy-title">Energy &amp; body composition</h3>
        <div class="stat-row">
          <p class="stat"><span class="stat__value">${fmt(targets.calories)}</span><span class="stat__label">Daily calories</span></p>
          <p class="stat"><span class="stat__value">${fmt(bmr)}</span><span class="stat__label">BMR (kcal)</span></p>
          <p class="stat"><span class="stat__value">${fmt(tdee)}</span><span class="stat__label">TDEE (kcal)</span></p>
        </div>
        <p>${projection}</p>
        ${ketoNote}
        ${this.bodyTable()}
      </article>
      <article class="card" aria-labelledby="targets-table-title">
        <h3 id="targets-table-title">Daily targets</h3>
        <div class="table-wrap">
          <table class="data-table">
            <caption class="sr-only">Daily nutrition targets</caption>
            <thead><tr><th scope="col">Nutrient</th><th scope="col">Daily target</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </article>`;
  },

  /** BMI, waist ratios and lean mass rows shared by the dashboard and the profile drawer. */
  bodyRows() {
    const c = NutritionEngine.bodyComposition(state.profile);
    const metric = state.profile.units === 'metric';
    const rows = [['BMI', fmt(c.bmi), c.bmiCategory]];
    rows.push(c.waistToHip
      ? ['Waist-to-hip ratio', c.waistToHip.toFixed(2), `${c.waistToHipRisk} (WHO cut-off ${c.waistToHipLimit})`]
      : ['Waist-to-hip ratio', '—', 'Add waist and hip measurements']);
    if (c.waistToHeight) rows.push(['Waist-to-height ratio', c.waistToHeight.toFixed(2), `${c.waistToHeightRisk} (cut-off 0.5)`]);
    if (c.leanMassKg) {
      rows.push(['Lean body mass', metric ? `${fmt(c.leanMassKg)} kg` : `${fmt(c.leanMassKg / KG_PER_LB)} lb`, c.leanSource]);
      rows.push(['BMR (Katch-McArdle)', `${fmt(c.katchBmr)} kcal`, 'Lean-mass estimate, for comparison']);
    }
    return rows;
  },

  bodyTable() {
    return `
      <div class="table-wrap">
        <table class="data-table">
          <caption>Body composition</caption>
          <thead><tr><th scope="col">Measure</th><th scope="col">Value</th><th scope="col">Interpretation</th></tr></thead>
          <tbody>${this.bodyRows().map(([label, value, note]) => `<tr><th scope="row">${label}</th><td>${value}</td><td>${note}</td></tr>`).join('')}</tbody>
        </table>
      </div>`;
  },
};
