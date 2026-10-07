import { FOOD_DB } from '../data/foods.js';
import { RecipeManager } from '../engines/recipe-manager.js';
import { SubstitutionEngine } from '../engines/substitution.js';
import { analyzeForUser, blockedHits, state } from '../state.js';
import { RecipeLibrary } from './library.js';
import { setFieldError } from './tabs.js';
import { announce, createId, escapeHTML, fmt } from '../util.js';


export class RecipeImporter {
  /**
   * @param {HTMLElement} root – container to render into
   * @param {{prefix: string, onSaved: (recipe, isUpdate: boolean) => void}} options
   */
  constructor(root, { prefix, onSaved }) {
    this.p = prefix;
    this.onSaved = onSaved;
    this.editingId = null;
    this.previewUrl = null;
    root.innerHTML = this.markup();
    this.bind();
  }

  el(name) {
    return document.getElementById(`${this.p}-${name}`);
  }

  markup() {
    const p = this.p;
    return `
      <div class="two-col">
        <article class="card" aria-labelledby="${p}-paste-title">
          <h3 id="${p}-paste-title">Paste recipe text</h3>
          <div class="field">
            <label for="${p}-raw">Raw recipe</label>
            <textarea id="${p}-raw" rows="8" aria-describedby="${p}-raw-hint" placeholder="Title: Morning Oats&#10;Servings: 2&#10;Ingredients:&#10;- 1 cup rolled oats&#10;- 2 cups milk&#10;Instructions:&#10;1. Simmer for 5 minutes."></textarea>
            <p id="${p}-raw-hint" class="field__hint">Include “Ingredients” and “Instructions” headings. Title and servings lines are optional.</p>
          </div>
          <button type="button" id="${p}-parse" class="btn btn--secondary">Parse into form</button>
        </article>
        <article class="card" aria-labelledby="${p}-ocr-title">
          <h3 id="${p}-ocr-title">Scan a recipe photo</h3>
          <div id="${p}-dropzone" class="dropzone" role="button" tabindex="0" aria-describedby="${p}-ocr-hint">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="32" height="32"><path d="M4 7h3l2-3h6l2 3h3v13H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            <span class="dropzone__title">Choose or drop a photo</span>
          </div>
          <p id="${p}-ocr-hint" class="field__hint">Simulated OCR for demonstration: your image never leaves this device, and a sample recipe text is extracted.</p>
          <input type="file" id="${p}-file" accept="image/*" hidden>
          <label for="${p}-progress" class="sr-only">Text extraction progress</label>
          <progress id="${p}-progress" class="ocr-progress" max="100" value="0" hidden></progress>
          <p id="${p}-status" class="ocr-status" role="status" aria-live="polite"></p>
          <img id="${p}-preview" class="ocr-preview" alt="" hidden>
        </article>
      </div>
      <form id="${p}-form" class="card form recipe-form" novalidate aria-labelledby="${p}-form-title">
        <h3 id="${p}-form-title">Recipe details</h3>
        <div class="form__grid form__grid--title">
          <div class="field">
            <label for="${p}-title">Title</label>
            <input type="text" id="${p}-title" autocomplete="off" required aria-describedby="${p}-title-error">
            <p id="${p}-title-error" class="field-error"></p>
          </div>
          <div class="field">
            <label for="${p}-servings">Servings</label>
            <input type="number" id="${p}-servings" min="1" max="50" step="1" value="1" inputmode="numeric" required aria-describedby="${p}-servings-error">
            <p id="${p}-servings-error" class="field-error"></p>
          </div>
        </div>
        <div class="form__grid">
          <div class="field">
            <label for="${p}-ingredients">Ingredients <span class="field__hint">(one per line)</span></label>
            <textarea id="${p}-ingredients" rows="7" required aria-describedby="${p}-ingredients-hint ${p}-ingredients-error"></textarea>
            <p id="${p}-ingredients-hint" class="field__hint">Examples: “1 1/2 cups rolled oats”, “200 g spinach”, “2 large eggs”.</p>
            <p id="${p}-ingredients-error" class="field-error"></p>
          </div>
          <div class="field">
            <label for="${p}-instructions">Instructions <span class="field__hint">(optional)</span></label>
            <textarea id="${p}-instructions" rows="7"></textarea>
          </div>
        </div>
        <div class="button-row">
          <button type="button" id="${p}-analyze" class="btn btn--secondary">Analyze nutrition</button>
          <button type="submit" id="${p}-save" class="btn btn--primary">Save recipe</button>
          <button type="button" id="${p}-cancel" class="btn btn--ghost" hidden>Cancel edit</button>
        </div>
        <div id="${p}-analysis" class="analysis" aria-live="polite"></div>
      </form>`;
  }

  bind() {
    this.el('parse').addEventListener('click', () => this.parseRaw());
    this.el('analyze').addEventListener('click', () => this.renderAnalysis(this.readForm()));
    this.el('cancel').addEventListener('click', () => this.reset());
    this.el('form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });

    // Custom drop zone: role="button" with Enter/Space keyboard activation.
    const zone = this.el('dropzone');
    const fileInput = this.el('file');
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
  }

  readForm() {
    return {
      id: this.editingId ?? createId(),
      title: this.el('title').value.trim(),
      servings: Number(this.el('servings').value),
      ingredientsText: this.el('ingredients').value.trim(),
      instructions: this.el('instructions').value.trim(),
    };
  }

  fillForm(recipe) {
    this.el('title').value = recipe.title;
    this.el('servings').value = recipe.servings;
    this.el('ingredients').value = recipe.ingredientsText;
    this.el('instructions').value = recipe.instructions;
  }

  parseRaw() {
    const raw = this.el('raw');
    if (!raw.value.trim()) {
      announce('Paste recipe text first.');
      raw.focus();
      return;
    }
    const parsed = RecipeManager.parseRecipeText(raw.value);
    this.fillForm(parsed);
    this.renderAnalysis(this.readForm());
    const count = parsed.ingredientsText ? parsed.ingredientsText.split('\n').length : 0;
    announce(`Recipe parsed: “${parsed.title || 'Untitled'}” with ${count} ingredients. Review the details form.`);
    this.el('title').focus();
  }

  /** Simulated OCR: deterministic sample text chosen from the file size, revealed in progress steps. */
  handleImage(file) {
    const status = this.el('status');
    const progress = this.el('progress');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      status.textContent = 'That file is not an image. Choose a JPG, PNG, WebP or HEIC photo.';
      return;
    }
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(file);
    const preview = this.el('preview');
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
          this.el('raw').value = OCR_SAMPLES[file.size % OCR_SAMPLES.length];
          progress.hidden = true;
          status.textContent = 'Text extracted (simulated). The details form has been pre-filled for review.';
          this.parseRaw();
        }
      }, (i + 1) * 400);
    });
  }

  renderAnalysis(recipe) {
    const out = this.el('analysis');
    if (!recipe.ingredientsText) {
      out.innerHTML = '<p>Add at least one ingredient to analyze.</p>';
      return;
    }
    const temp = { ...recipe, servings: recipe.servings || 1 };
    const { ingredients: parsed } = RecipeManager.analyze(temp);
    const { ingredients, perServing, unmatched, isSafe, flagged } = analyzeForUser(temp);
    const active = SubstitutionEngine.restrictionsFor(state.profile);
    const checkCell = (ing, i) => {
      const hits = SubstitutionEngine.detect(parsed[i]).filter((t) => active.includes(t));
      if (!hits.length) return active.length ? 'Safe' : '—';
      const flag = flagged.find((f) => f.raw === ing.raw);
      const badge = SubstitutionEngine.badge(hits, { isAllergy: flag.isAllergy, blocked: ing.blocked });
      if (ing.blocked) return `${badge} No safe substitute`;
      const sub = flag.substitute;
      return sub.name === 'Omit'
        ? `${badge} Omitted. ${escapeHTML(sub.note)}`
        : `${badge} Swapped for <strong>${escapeHTML(sub.name)}</strong> (${escapeHTML(sub.ratio)}). ${escapeHTML(sub.note)}`;
    };
    const rows = ingredients.map((ing, i) => `
      <tr>
        <td>${escapeHTML(ing.raw)}</td>
        <td>${ing.foodId ? escapeHTML(FOOD_DB[ing.foodId].name) : '<span class="badge badge--warn"><span aria-hidden="true">!</span> Not recognized</span>'}</td>
        <td>${ing.foodId ? `${fmt(ing.grams)} g` : '—'}</td>
        <td>${fmt(ing.nutrients.calories)}</td>
        <td>${checkCell(ing, i)}</td>
      </tr>`).join('');
    out.innerHTML = `
      <p class="analysis__summary">Per serving: <strong>${fmt(perServing.calories)} kcal</strong> ·
        ${fmt(perServing.protein)} g protein · ${fmt(perServing.carbs)} g carbs · ${fmt(perServing.fat)} g fat ·
        ${fmt(perServing.fiber)} g fiber · ${fmt(perServing.iron)} mg iron</p>
      ${!isSafe ? `<p class="analysis__danger">${SubstitutionEngine.badge(blockedHits(flagged), { blocked: true })} This recipe contains an allergen with no safe substitute. It will be left out of your meal plan and grocery list.</p>` : ''}
      ${isSafe && flagged.length ? `<p class="analysis__warn">Nutrition reflects ${flagged.length} swap${flagged.length === 1 ? '' : 's'} for your allergies and diet.</p>` : ''}
      ${unmatched ? `<p class="analysis__warn">${unmatched} ingredient${unmatched === 1 ? ' was' : 's were'} not found in the nutrition dictionary and ${unmatched === 1 ? 'is' : 'are'} excluded from totals.</p>` : ''}
      <div class="table-wrap">
        <table class="data-table">
          <caption>Ingredient matches for the whole recipe</caption>
          <thead><tr><th scope="col">Ingredient</th><th scope="col">Matched food</th><th scope="col">Weight</th><th scope="col">kcal</th><th scope="col">Allergy &amp; diet check</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  validate(recipe) {
    const checks = [
      [this.el('title'), recipe.title.length > 0, 'Enter a recipe title.'],
      [this.el('servings'), recipe.servings >= 1 && recipe.servings <= 50, 'Enter servings between 1 and 50.'],
      [this.el('ingredients'), recipe.ingredientsText.length > 0, 'Add at least one ingredient.'],
    ];
    let first = null;
    checks.forEach(([input, ok, message]) => {
      setFieldError(input, ok ? '' : message);
      if (!ok && !first) first = input;
    });
    return first;
  }

  save() {
    const recipe = this.readForm();
    const invalid = this.validate(recipe);
    if (invalid) {
      invalid.focus();
      announce('Please fix the highlighted recipe fields.');
      return;
    }
    const isUpdate = RecipeLibrary.upsert(recipe);
    this.reset();
    this.onSaved(recipe, isUpdate);
  }

  edit(recipe) {
    this.editingId = recipe.id;
    this.fillForm(recipe);
    this.renderAnalysis(recipe);
    this.el('cancel').hidden = false;
    this.el('save').textContent = 'Update recipe';
    this.el('title').focus();
    announce(`Editing “${recipe.title}”.`);
  }

  reset() {
    this.editingId = null;
    this.el('form').reset();
    this.el('raw').value = '';
    this.el('form').querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    this.el('form').querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
    this.el('cancel').hidden = true;
    this.el('save').textContent = 'Save recipe';
    this.el('analysis').innerHTML = '';
  }
}
