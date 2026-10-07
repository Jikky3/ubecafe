import { NUTRIENTS } from '../data/nutrients.js';
import { BiometricsEngine } from '../engines/biometrics.js';
import { App } from '../main.js';
import { currentTargets, state } from '../state.js';
import { Storage } from '../storage.js';
import { AccountUI } from './account.js';
import { $, announce, fmt } from '../util.js';

export const ProfileUI = {
  form: null,
  /** Tape-measure limits per unit system (waist & hip share the same range). */
  LENGTH_LIMITS: { metric: { min: 40, max: 200, step: 0.1, label: 'cm' }, imperial: { min: 16, max: 80, step: 0.1, label: 'in' } },

  init() {
    this.form = $('#profile-form');
    this.fill(state.profile);
    this.form.addEventListener('change', (e) => {
      if (e.target.name === 'units') this.switchUnits(e.target.value);
    });
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
  },

  fill(profile) {
    const f = this.form.elements;
    const toLength = (cm) => (cm ? Math.round((profile.units === 'metric' ? cm : cm / 2.54) * 10) / 10 : '');
    f.units.value = profile.units;
    f.age.value = profile.age;
    f.gender.value = profile.gender;
    f.activity.value = profile.activity;
    f.goal.value = profile.goal;
    f['height-cm'].value = Math.round(profile.heightCm * 10) / 10;
    f['weight-kg'].value = Math.round(profile.weightKg * 10) / 10;
    const totalInches = profile.heightCm / 2.54;
    f['height-ft'].value = Math.floor(totalInches / 12);
    f['height-in'].value = Math.round((totalInches % 12) * 10) / 10;
    f['weight-lb'].value = Math.round((profile.weightKg / 0.45359237) * 10) / 10;
    f['body-fat'].value = profile.bodyFatPct ?? '';
    f.waist.value = toLength(profile.waistCm);
    f.hip.value = toLength(profile.hipCm);
    this.toggleUnitFields(profile.units);
    this.renderSavedNote(profile);
  },

  toggleUnitFields(units) {
    this.form.querySelectorAll('[data-units]').forEach((group) => {
      group.hidden = group.dataset.units !== units;
    });
    const limits = this.LENGTH_LIMITS[units];
    this.form.querySelectorAll('[data-length]').forEach((input) => {
      Object.assign(input, { min: limits.min, max: limits.max, step: limits.step });
    });
    this.form.querySelectorAll('[data-length-unit]').forEach((el) => { el.textContent = `(${limits.label})`; });
  },

  /** Converts the visible values so switching units never loses data. */
  switchUnits(units) {
    const f = this.form.elements;
    const convertLength = (input, factor) => {
      if (Number(input.value) > 0) input.value = Math.round(Number(input.value) * factor * 10) / 10;
    };
    if (units === 'metric') {
      const inches = Number(f['height-ft'].value) * 12 + Number(f['height-in'].value);
      if (inches > 0) f['height-cm'].value = Math.round(inches * 25.4) / 10;
      if (Number(f['weight-lb'].value) > 0) f['weight-kg'].value = Math.round(Number(f['weight-lb'].value) * 4.5359237) / 10;
      [f.waist, f.hip].forEach((input) => convertLength(input, 2.54));
    } else {
      const cm = Number(f['height-cm'].value);
      if (cm > 0) {
        const inches = cm / 2.54;
        f['height-ft'].value = Math.floor(inches / 12);
        f['height-in'].value = Math.round((inches % 12) * 10) / 10;
      }
      if (Number(f['weight-kg'].value) > 0) f['weight-lb'].value = Math.round((Number(f['weight-kg'].value) / 0.45359237) * 10) / 10;
      [f.waist, f.hip].forEach((input) => convertLength(input, 1 / 2.54));
    }
    this.toggleUnitFields(units);
  },

  /** Validates visible numeric fields; optional fields may be left blank. */
  validate() {
    const inputs = [...this.form.querySelectorAll('input[type="number"]')]
      .filter((input) => !input.closest('[hidden]'));
    let firstInvalid = null;
    inputs.forEach((input) => {
      const error = $(`#${input.id}-error`);
      const value = Number(input.value);
      const blankOptional = input.value === '' && !input.required;
      const valid = blankOptional || (input.value !== '' && value >= Number(input.min) && value <= Number(input.max));
      input.setAttribute('aria-invalid', String(!valid));
      error.textContent = valid ? '' : `Enter a number between ${input.min} and ${input.max}${input.required ? '' : ', or leave it blank'}.`;
      if (!valid && !firstInvalid) firstInvalid = input;
    });
    return firstInvalid;
  },

  submit() {
    const invalid = this.validate();
    if (invalid) {
      invalid.focus();
      announce('Please fix the highlighted fields.');
      return;
    }
    const f = this.form.elements;
    const units = f.units.value;
    const optional = (input, factor = 1) => (input.value === '' ? null : Math.round(Number(input.value) * factor * 10) / 10);
    const lengthFactor = units === 'metric' ? 1 : 2.54;
    state.profile = {
      units,
      age: Number(f.age.value),
      gender: f.gender.value,
      activity: f.activity.value,
      goal: f.goal.value,
      heightCm: units === 'metric'
        ? Number(f['height-cm'].value)
        : (Number(f['height-ft'].value) * 12 + Number(f['height-in'].value)) * 2.54,
      weightKg: units === 'metric' ? Number(f['weight-kg'].value) : Number(f['weight-lb'].value) * 0.45359237,
      bodyFatPct: optional(f['body-fat']),
      waistCm: optional(f.waist, lengthFactor),
      hipCm: optional(f.hip, lengthFactor),
      updatedAt: new Date().toISOString(),
    };
    Storage.save(Storage.KEYS.profile, state.profile);
    this.renderSavedNote(state.profile);
    App.renderNutrition();
    const where = AccountUI.email ? ` to ${AccountUI.email}` : ' on this device';
    announce(`Profile saved${where}. Targets updated: ${fmt(currentTargets().targets.calories)} calories per day.`);
  },

  renderSavedNote(profile) {
    const note = $('#profile-saved');
    if (!profile.updatedAt) {
      note.textContent = '';
      return;
    }
    const when = new Date(profile.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    note.textContent = `Last saved ${when}${AccountUI.email ? ` to ${AccountUI.email}` : ' as guest'}.`;
  },

  renderBodyComposition() {
    const c = BiometricsEngine.bodyComposition(state.profile);
    const metric = state.profile.units === 'metric';
    const rows = [['BMI', fmt(c.bmi), c.bmiCategory]];
    if (c.waistToHip) rows.push(['Waist-to-hip ratio', c.waistToHip.toFixed(2), `${c.waistToHipRisk} (WHO cut-off ${c.waistToHipLimit})`]);
    if (c.waistToHeight) rows.push(['Waist-to-height ratio', c.waistToHeight.toFixed(2), `${c.waistToHeightRisk} (cut-off 0.5)`]);
    if (c.leanMassKg) {
      const lean = metric ? `${fmt(c.leanMassKg)} kg` : `${fmt(c.leanMassKg / 0.45359237)} lb`;
      rows.push(['Lean body mass', lean, `From ${fmt(state.profile.bodyFatPct)}% body fat`]);
      rows.push(['BMR (Katch-McArdle)', `${fmt(c.katchBmr)} kcal`, 'Lean-mass estimate, for comparison']);
    }
    return `
      <div class="table-wrap">
        <table class="data-table">
          <caption>Body composition</caption>
          <thead><tr><th scope="col">Measure</th><th scope="col">Value</th><th scope="col">Interpretation</th></tr></thead>
          <tbody>${rows.map(([label, value, note]) => `<tr><th scope="row">${label}</th><td>${value}</td><td>${note}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      ${rows.length === 1 ? '<p class="field__hint">Add body fat %, waist and hip measurements for more indicators.</p>' : ''}`;
  },

  renderTargets() {
    const { bmr, tdee, targets } = currentTargets();
    const rows = NUTRIENTS.map((meta) => `
      <tr>
        <th scope="row">${meta.label}${meta.isLimit ? ' (max)' : ''}</th>
        <td>${fmt(targets[meta.key])} ${meta.unit}</td>
      </tr>`).join('');
    $('#targets-output').innerHTML = `
      <div class="stat-row">
        <p class="stat"><span class="stat__value">${fmt(targets.calories)}</span><span class="stat__label">Daily calories</span></p>
        <p class="stat"><span class="stat__value">${fmt(bmr)}</span><span class="stat__label">BMR (kcal)</span></p>
        <p class="stat"><span class="stat__value">${fmt(tdee)}</span><span class="stat__label">TDEE (kcal)</span></p>
      </div>
      ${this.renderBodyComposition()}
      <div class="table-wrap">
        <table class="data-table">
          <caption>Your daily nutrition targets</caption>
          <thead><tr><th scope="col">Nutrient</th><th scope="col">Daily target</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },
};
