import { DAYS, MEAL_SLOTS } from '../data/constants.js';
import { FOOD_DB } from '../data/foods.js';
import { OCR_SAMPLES } from '../data/seeds.js';
import { RecipeParser } from '../engines/recipe-parser.js';
import { App } from '../main.js';
import { state } from '../state.js';
import { Storage } from '../storage.js';
import { $, announce, createId, escapeHTML, fmt } from '../util.js';

export const RecipeUI = {
  form: null,
  previewUrl: null,

  init() {
    this.form = $('#recipe-form');

    $('#parse-raw').addEventListener('click', () => this.parseRaw());
    $('#analyze-recipe').addEventListener('click', () => this.renderAnalysis(this.readForm()));
    $('#cancel-edit').addEventListener('click', () => this.resetForm());
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });

    // Custom drop zone: role="button" + Enter/Space keyboard support.
    const zone = $('#ocr-dropzone');
    const fileInput = $('#ocr-file');
    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('is-dragging');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('is-dragging');
      this.handleImage(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => this.handleImage(fileInput.files[0]));

    $('#recipe-library').addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      if (button.dataset.action === 'edit') this.edit(button.dataset.id);
      if (button.dataset.action === 'delete') this.remove(button.dataset.id);
    });
  },

  readForm() {
    const f = this.form.elements;
    return {
      id: state.editingId ?? createId(),
      title: f['recipe-title'].value.trim(),
      servings: Number(f['recipe-servings'].value),
      ingredientsText: f['recipe-ingredients'].value.trim(),
      instructions: f['recipe-instructions'].value.trim(),
    };
  },

  fillForm(recipe) {
    const f = this.form.elements;
    f['recipe-title'].value = recipe.title;
    f['recipe-servings'].value = recipe.servings;
    f['recipe-ingredients'].value = recipe.ingredientsText;
    f['recipe-instructions'].value = recipe.instructions;
  },

  parseRaw() {
    const raw = $('#raw-recipe').value;
    if (!raw.trim()) {
      announce('Paste recipe text first.');
      $('#raw-recipe').focus();
      return;
    }
    const parsed = RecipeParser.parseRecipeText(raw);
    this.fillForm(parsed);
    this.renderAnalysis(this.readForm());
    const count = parsed.ingredientsText ? parsed.ingredientsText.split('\n').length : 0;
    announce(`Recipe parsed: “${parsed.title || 'Untitled'}” with ${count} ingredients. Review the form below.`);
    $('#recipe-title').focus();
  },

  /** Simulated OCR: deterministic sample text chosen from the file size, revealed in progress steps. */
  handleImage(file) {
    const status = $('#ocr-status');
    const progress = $('#ocr-progress');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      status.textContent = 'That file is not an image. Choose a JPG, PNG, WebP or HEIC photo.';
      return;
    }
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(file);
    const preview = $('#ocr-preview');
    preview.src = this.previewUrl;
    preview.alt = `Uploaded recipe photo: ${file.name}`;
    preview.hidden = false;

    const steps = [[20, 'Detecting text regions…'], [55, 'Recognizing characters…'], [85, 'Structuring recipe sections…'], [100, 'Done']];
    progress.hidden = false;
    steps.forEach(([value, label], i) => {
      window.setTimeout(() => {
        progress.value = value;
        status.textContent = `${label} ${value}%`;
        if (value === 100) {
          $('#raw-recipe').value = OCR_SAMPLES[file.size % OCR_SAMPLES.length];
          progress.hidden = true;
          status.textContent = 'Text extracted (simulated). Fields have been pre-filled below for review.';
          this.parseRaw();
        }
      }, (i + 1) * 400);
    });
  },

  renderAnalysis(recipe) {
    const out = $('#analysis-output');
    if (!recipe.ingredientsText) {
      out.innerHTML = '<p>Add at least one ingredient to analyze.</p>';
      return;
    }
    const temp = { ...recipe, servings: recipe.servings || 1 };
    const { ingredients, perServing, unmatched } = RecipeParser.analyze(temp);
    const rows = ingredients.map((ing) => `
      <tr>
        <td>${escapeHTML(ing.raw)}</td>
        <td>${ing.foodId ? escapeHTML(FOOD_DB[ing.foodId].name) : '<span class="badge badge--warn"><span aria-hidden="true">!</span> Not recognized</span>'}</td>
        <td>${ing.foodId ? `${fmt(ing.grams)} g` : '—'}</td>
        <td>${fmt(ing.nutrients.calories)}</td>
      </tr>`).join('');
    out.innerHTML = `
      <p class="analysis__summary">Per serving: <strong>${fmt(perServing.calories)} kcal</strong> ·
        ${fmt(perServing.protein)} g protein · ${fmt(perServing.carbs)} g carbs · ${fmt(perServing.fat)} g fat ·
        ${fmt(perServing.fiber)} g fiber · ${fmt(perServing.iron)} mg iron</p>
      ${unmatched ? `<p class="analysis__warn">${unmatched} ingredient${unmatched === 1 ? ' was' : 's were'} not found in the nutrition dictionary and ${unmatched === 1 ? 'is' : 'are'} excluded from totals.</p>` : ''}
      <div class="table-wrap">
        <table class="data-table">
          <caption>Ingredient matches for the whole recipe</caption>
          <thead><tr><th scope="col">Ingredient</th><th scope="col">Matched food</th><th scope="col">Weight</th><th scope="col">kcal</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  validate(recipe) {
    const checks = [
      ['recipe-title', recipe.title.length > 0, 'Enter a recipe title.'],
      ['recipe-servings', recipe.servings >= 1 && recipe.servings <= 50, 'Enter servings between 1 and 50.'],
      ['recipe-ingredients', recipe.ingredientsText.length > 0, 'Add at least one ingredient.'],
    ];
    let firstInvalid = null;
    checks.forEach(([id, ok, message]) => {
      $(`#${id}`).setAttribute('aria-invalid', String(!ok));
      $(`#${id}-error`).textContent = ok ? '' : message;
      if (!ok && !firstInvalid) firstInvalid = $(`#${id}`);
    });
    return firstInvalid;
  },

  save() {
    const recipe = this.readForm();
    const invalid = this.validate(recipe);
    if (invalid) {
      invalid.focus();
      announce('Please fix the highlighted recipe fields.');
      return;
    }
    const existing = state.recipes.findIndex((r) => r.id === recipe.id);
    if (existing >= 0) state.recipes.splice(existing, 1, recipe);
    else state.recipes.push(recipe);
    Storage.save(Storage.KEYS.recipes, state.recipes);
    this.resetForm();
    App.renderRecipesChanged();
    announce(`${existing >= 0 ? 'Updated' : 'Saved'} “${recipe.title}”. It is now available in the weekly meal plan.`);
  },

  edit(id) {
    const recipe = state.recipes.find((r) => r.id === id);
    state.editingId = id;
    this.fillForm(recipe);
    this.renderAnalysis(recipe);
    $('#cancel-edit').hidden = false;
    $('#save-recipe').textContent = 'Update recipe';
    $('#recipe-title').focus();
    announce(`Editing “${recipe.title}”.`);
  },

  remove(id) {
    const recipe = state.recipes.find((r) => r.id === id);
    if (!window.confirm(`Delete “${recipe.title}”? It will also be removed from your meal plan.`)) return;
    state.recipes = state.recipes.filter((r) => r.id !== id);
    DAYS.forEach((day) => MEAL_SLOTS.forEach((slot) => {
      if (state.plan[day][slot.id] === id) state.plan[day][slot.id] = '';
    }));
    Storage.save(Storage.KEYS.recipes, state.recipes);
    Storage.save(Storage.KEYS.plan, state.plan);
    if (state.editingId === id) this.resetForm();
    App.renderRecipesChanged();
    $('#library-heading').focus();
    announce(`Deleted “${recipe.title}”.`);
  },

  resetForm() {
    state.editingId = null;
    this.form.reset();
    this.form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    this.form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
    $('#cancel-edit').hidden = true;
    $('#save-recipe').textContent = 'Save recipe';
    $('#analysis-output').innerHTML = '';
  },

  renderLibrary() {
    $('#recipe-count').textContent = String(state.recipes.length);
    const list = $('#recipe-library');
    if (!state.recipes.length) {
      list.innerHTML = '<li class="empty">No recipes yet. Import one above to get started.</li>';
      return;
    }
    list.innerHTML = state.recipes.map((recipe) => {
      const { perServing: p } = RecipeParser.analyze(recipe);
      const title = escapeHTML(recipe.title);
      return `
        <li>
          <article class="card recipe-card">
            <h3>${title}</h3>
            <p class="recipe-card__meta">${recipe.servings} serving${recipe.servings === 1 ? '' : 's'} · per serving</p>
            <dl class="macro-chips">
              <div><dt>kcal</dt><dd>${fmt(p.calories)}</dd></div>
              <div><dt>Protein</dt><dd>${fmt(p.protein)} g</dd></div>
              <div><dt>Carbs</dt><dd>${fmt(p.carbs)} g</dd></div>
              <div><dt>Fat</dt><dd>${fmt(p.fat)} g</dd></div>
            </dl>
            <div class="button-row">
              <button type="button" class="btn btn--ghost" data-action="edit" data-id="${recipe.id}" aria-label="Edit ${title}">Edit</button>
              <button type="button" class="btn btn--ghost btn--danger" data-action="delete" data-id="${recipe.id}" aria-label="Delete ${title}">Delete</button>
            </div>
          </article>
        </li>`;
    }).join('');
  },
};
