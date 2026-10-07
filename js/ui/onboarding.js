import { ALLERGY_IDS, DIETS, RESTRICTIONS } from '../data/restrictions.js';
import { NutritionEngine } from '../engines/nutrition.js';
import { App } from '../main.js';
import { currentTargets, firstName, state } from '../state.js';
import { Storage } from '../storage.js';
import { RecipeImporter } from './recipe-importer.js';
import { setFieldError } from './tabs.js';
import { $, KG_PER_LB, announce, escapeHTML, fmt, round1 } from '../util.js';


export const OnboardingWizard = {
  STEP_NAMES: ['Goals & activity', 'Diet & allergies', 'Body composition & biometrics', 'First recipe'],
  LENGTH_LIMITS: { metric: { min: 40, max: 200, label: '(cm)' }, imperial: { min: 16, max: 80, label: '(in)' } },
  MASS_LIMITS: { metric: { min: 20, max: 200, label: '(kg)' }, imperial: { min: 44, max: 440, label: '(lb)' } },
  mode: 'onboarding',
  step: 1,
  importer: null,

  init() {
    $('#goal-timeline').innerHTML = NutritionEngine.TIMELINES
      .map((w) => `<option value="${w}">${w} weeks (${NutritionEngine.pace(w).label.toLowerCase()} pace)</option>`).join('');
    $('#diet-options').innerHTML = Object.entries(DIETS).map(([id, diet]) => `
      <div class="choice">
        <input type="radio" id="diet-${id}" name="diet" value="${id}">
        <label for="diet-${id}"><span class="choice__title">${diet.label}</span> <span class="choice__desc">${diet.description}</span></label>
      </div>`).join('');
    $('#allergy-options').innerHTML = ALLERGY_IDS.map((id) => `
      <div class="check">
        <input type="checkbox" id="allergy-${id}" name="allergy" value="${id}">
        <label for="allergy-${id}">${RESTRICTIONS[id].option}</label>
      </div>`).join('');

    this.importer = new RecipeImporter($('#onboarding-importer'), {
      prefix: 'ob',
      onSaved: (recipe) => {
        this.renderAdded();
        announce(`Added “${recipe.title}” to your library.`);
      },
    });

    document.querySelectorAll('input[name="units"]').forEach((radio) => {
      radio.addEventListener('change', () => this.switchUnits(radio.value));
    });
    $('#wizard-back').addEventListener('click', () => this.showStep(this.step - 1));
    $('#wizard-next').addEventListener('click', () => this.next());
    $('#wizard-save').addEventListener('click', () => this.finish());
    $('#wizard-signout').addEventListener('click', () => App.signOut());
    $('#wizard-cancel').addEventListener('click', () => {
      App.showApp();
      announce('Edits discarded.');
    });
  },

  /** @param {'onboarding'|'edit'} mode */
  start(mode) {
    this.mode = mode;
    const editing = mode === 'edit';
    this.fill(state.profile);
    this.importer.reset();
    this.renderAdded();
    $('#wizard-title').innerHTML = editing ? 'Edit your <em>preferences</em>' : 'Let’s set <em>your table</em>';
    $('#wizard-intro').textContent = editing
      ? 'Update any step, then save. Targets, swaps and your grocery list refresh instantly.'
      : `Welcome, ${firstName()}. Four short steps and your personal targets, plan and grocery list are ready.`;
    $('#wizard-cancel').hidden = !editing;
    $('#wizard-signout').hidden = editing;
    $('#wizard-save').hidden = !editing;
    App.showView('onboarding', { focus: false });
    this.showStep(editing ? 1 : state.profile.onboardingStep);
  },

  showStep(n) {
    this.step = Math.min(4, Math.max(1, n));
    document.querySelectorAll('.wizard-step').forEach((section) => {
      section.hidden = Number(section.dataset.step) !== this.step;
    });
    const label = `Step ${this.step} of 4: ${this.STEP_NAMES[this.step - 1]}`;
    $('#wizard-progress-label').textContent = label;
    const bar = $('#wizard-progressbar');
    bar.setAttribute('aria-valuenow', String(this.step));
    bar.setAttribute('aria-valuetext', label);
    $('#wizard-progress-fill').style.width = `${(this.step / 4) * 100}%`;
    [...$('#wizard-steps').children].forEach((li, i) => {
      li.classList.toggle('is-done', i + 1 < this.step);
      if (i + 1 === this.step) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    $('#wizard-back').disabled = this.step === 1;
    $('#wizard-next').textContent = this.step < 4 ? 'Continue' : (this.mode === 'edit' ? 'Save changes' : 'Finish setup');
    $(`#step-${this.step}-title`).focus();
  },

  next() {
    if (this.step === 4) {
      this.finish();
      return;
    }
    if (this.step === 3) {
      const invalid = this.validateBiometrics();
      if (invalid) {
        invalid.focus();
        announce('Please fix the highlighted fields.');
        return;
      }
    }
    if (this.mode === 'onboarding') {
      // Persist each completed step so a reload resumes where the user left off.
      state.profile = { ...state.profile, ...this.readStep(this.step), onboardingStep: this.step + 1 };
      Storage.save(Storage.KEYS.profile, state.profile);
    }
    this.showStep(this.step + 1);
  },

  finish() {
    const invalid = this.validateBiometrics();
    if (invalid) {
      this.showStep(3);
      invalid.focus();
      announce('Please complete your biometrics before saving.');
      return;
    }
    const wasOnboarding = this.mode === 'onboarding';
    state.profile = {
      ...state.profile,
      ...this.readStep(1),
      ...this.readStep(2),
      ...this.readStep(3),
      onboarded: true,
      onboardingStep: 4,
      updatedAt: new Date().toISOString(),
    };
    Storage.save(Storage.KEYS.profile, state.profile);
    App.showApp();
    const kcal = fmt(currentTargets().targets.calories);
    announce(wasOnboarding
      ? `Setup complete. Welcome to your dashboard, ${firstName()}: your target is ${kcal} calories a day.`
      : `Preferences saved. Your target is now ${kcal} calories a day; recipes and grocery list updated.`);
  },

  readStep(n) {
    if (n === 1) {
      return {
        goal: $('input[name="goal"]:checked').value,
        timelineWeeks: Number($('#goal-timeline').value),
        activity: $('#activity').value,
      };
    }
    if (n === 2) {
      return {
        diet: $('input[name="diet"]:checked').value,
        allergies: [...document.querySelectorAll('input[name="allergy"]:checked')].map((b) => b.value),
      };
    }
    if (n === 3) {
      const units = $('input[name="units"]:checked').value;
      const metric = units === 'metric';
      const optional = (sel, factor = 1) => ($(sel).value === '' ? null : round1(Number($(sel).value) * factor));
      return {
        units,
        age: Number($('#age').value),
        sex: $('#sex').value,
        heightCm: metric ? Number($('#height-cm').value) : (Number($('#height-ft').value) * 12 + Number($('#height-in').value)) * 2.54,
        weightKg: metric ? Number($('#weight-kg').value) : Number($('#weight-lb').value) * KG_PER_LB,
        bodyFatPct: optional('#body-fat'),
        waistCm: optional('#waist', metric ? 1 : 2.54),
        hipCm: optional('#hip', metric ? 1 : 2.54),
        leanMassKg: optional('#lean-mass', metric ? 1 : KG_PER_LB),
      };
    }
    return {};
  },

  fill(profile) {
    const metric = profile.units === 'metric';
    const value = (n) => (n === null || n === undefined ? '' : n);
    $(`#goal-${profile.goal}`).checked = true;
    $('#goal-timeline').value = String(profile.timelineWeeks);
    $('#activity').value = profile.activity;
    $(`#diet-${profile.diet}`).checked = true;
    document.querySelectorAll('input[name="allergy"]').forEach((box) => { box.checked = profile.allergies.includes(box.value); });
    $(`#units-${profile.units}`).checked = true;
    $('#age').value = value(profile.age);
    $('#sex').value = profile.sex;
    if (profile.heightCm) {
      const inches = profile.heightCm / 2.54;
      $('#height-cm').value = round1(profile.heightCm);
      $('#height-ft').value = Math.floor(inches / 12);
      $('#height-in').value = round1(inches % 12);
    } else {
      ['#height-cm', '#height-ft', '#height-in'].forEach((sel) => { $(sel).value = ''; });
    }
    $('#weight-kg').value = profile.weightKg ? round1(profile.weightKg) : '';
    $('#weight-lb').value = profile.weightKg ? round1(profile.weightKg / KG_PER_LB) : '';
    $('#body-fat').value = value(profile.bodyFatPct);
    $('#waist').value = profile.waistCm ? round1(metric ? profile.waistCm : profile.waistCm / 2.54) : '';
    $('#hip').value = profile.hipCm ? round1(metric ? profile.hipCm : profile.hipCm / 2.54) : '';
    $('#lean-mass').value = profile.leanMassKg ? round1(metric ? profile.leanMassKg : profile.leanMassKg / KG_PER_LB) : '';
    document.querySelectorAll('.wizard-step [aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    document.querySelectorAll('.wizard-step .field-error').forEach((el) => { el.textContent = ''; });
    this.applyUnitLimits(profile.units);
  },

  applyUnitLimits(units) {
    document.querySelectorAll('[data-units]').forEach((group) => { group.hidden = group.dataset.units !== units; });
    const length = this.LENGTH_LIMITS[units];
    const mass = this.MASS_LIMITS[units];
    document.querySelectorAll('[data-length]').forEach((input) => Object.assign(input, { min: length.min, max: length.max, step: 0.1 }));
    document.querySelectorAll('[data-mass]').forEach((input) => Object.assign(input, { min: mass.min, max: mass.max, step: 0.1 }));
    document.querySelectorAll('[data-length-unit]').forEach((el) => { el.textContent = length.label; });
    document.querySelectorAll('[data-mass-unit]').forEach((el) => { el.textContent = mass.label; });
  },

  /** Converts visible values when the unit system changes so no data is lost. */
  switchUnits(units) {
    const convert = (sel, factor) => {
      if (Number($(sel).value) > 0) $(sel).value = round1(Number($(sel).value) * factor);
    };
    if (units === 'metric') {
      const inches = Number($('#height-ft').value) * 12 + Number($('#height-in').value);
      if (inches > 0) $('#height-cm').value = round1(inches * 2.54);
      if (Number($('#weight-lb').value) > 0) $('#weight-kg').value = round1(Number($('#weight-lb').value) * KG_PER_LB);
      convert('#waist', 2.54);
      convert('#hip', 2.54);
      convert('#lean-mass', KG_PER_LB);
    } else {
      const cm = Number($('#height-cm').value);
      if (cm > 0) {
        $('#height-ft').value = Math.floor(cm / 2.54 / 12);
        $('#height-in').value = round1((cm / 2.54) % 12);
      }
      if (Number($('#weight-kg').value) > 0) $('#weight-lb').value = round1(Number($('#weight-kg').value) / KG_PER_LB);
      convert('#waist', 1 / 2.54);
      convert('#hip', 1 / 2.54);
      convert('#lean-mass', 1 / KG_PER_LB);
    }
    this.applyUnitLimits(units);
  },

  /** Validates visible step-3 numbers; optional fields may be blank. Returns first invalid input. */
  validateBiometrics() {
    const inputs = [...document.querySelectorAll('[data-step="3"] input[type="number"]')].filter((i) => !i.closest('[hidden]'));
    let first = null;
    inputs.forEach((input) => {
      const value = Number(input.value);
      const blankOptional = input.value === '' && !input.required;
      let message = '';
      if (!blankOptional && (input.value === '' || value < Number(input.min) || value > Number(input.max))) {
        message = `Enter a number between ${input.min} and ${input.max}${input.required ? '' : ', or leave it blank'}.`;
      }
      setFieldError(input, message);
      if (message && !first) first = input;
    });
    const lean = $('#lean-mass');
    const weight = $('#units-metric').checked ? $('#weight-kg') : $('#weight-lb');
    if (!first && lean.value !== '' && Number(lean.value) >= Number(weight.value)) {
      setFieldError(lean, 'Lean body mass must be less than your total weight.');
      first = lean;
    }
    return first;
  },

  renderAdded() {
    const custom = state.recipes.filter((r) => !r.id.startsWith('seed-'));
    $('#onboarding-added').innerHTML = custom.length
      ? `<h3>In your library</h3><ul class="added-list">${custom.map((r) => `<li>${escapeHTML(r.title)}</li>`).join('')}</ul>`
      : '';
  },
};
