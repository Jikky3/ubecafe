import { CUSTOM_FOOD_FIELDS, FOOD_LIST } from '../data/foods.js';
import { AISLES } from '../data/nutrients.js';
import { IGNORE_MATCH, RecipeManager } from '../engines/recipe-manager.js';
import { SubstitutionEngine } from '../engines/substitution.js';
import { analyzeForUser, blockedHits, saveCustomFoods, state } from '../state.js';
import { RecipeLibrary } from './library.js';
import { OCR_HINT_HTML, OcrController } from './ocr.js';
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
    /** Ingredient -> food overrides for the recipe in the form ({ [matchKey]: foodId | IGNORE_MATCH }). */
    this.matches = {};
    /** Match key whose picker keeps focus (and stays open) after the next analysis render. */
    this.focusKey = null;
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
          <p id="${p}-ocr-hint" class="field__hint">${OCR_HINT_HTML}</p>
          <input type="file" id="${p}-file" accept="image/*" hidden>
          <div class="button-row ocr-actions">
            <button type="button" id="${p}-sample" class="btn btn--ghost">Try a sample photo</button>
            <button type="button" id="${p}-ocr-cancel" class="btn btn--ghost" hidden>Cancel scan</button>
          </div>
          <label for="${p}-progress" class="sr-only">Text extraction progress</label>
          <progress id="${p}-progress" class="ocr-progress" max="100" value="0" hidden></progress>
          <p id="${p}-status" class="ocr-status" role="status" aria-live="polite"></p>
          <div id="${p}-preview-host" class="ocr-preview-host"></div>
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
        <div id="${p}-analysis" class="analysis"></div>
      </form>`;
  }

  bind() {
    this.el('parse').addEventListener('click', () => this.parseRaw());
    this.el('analyze').addEventListener('click', () => this.announceAnalysis(this.renderAnalysis(this.readForm()), 'Analysis ready: '));
    this.el('cancel').addEventListener('click', () => this.reset());
    this.el('form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });
    this.bindAnalysisControls();

    // Real on-device OCR; the drop zone, sample photo, progress and cancel belong to this importer only.
    this.ocr = new OcrController({
      dropzone: this.el('dropzone'),
      fileInput: this.el('file'),
      sample: this.el('sample'),
      cancel: this.el('ocr-cancel'),
      progress: this.el('progress'),
      status: this.el('status'),
      previewHost: this.el('preview-host'),
    }, { onText: (text) => this.applyOcrText(text), previewId: `${this.p}-preview` });
  }

  readForm() {
    return {
      id: this.editingId ?? createId(),
      title: this.el('title').value.trim(),
      servings: Number(this.el('servings').value),
      ingredientsText: this.el('ingredients').value.trim(),
      instructions: this.el('instructions').value.trim(),
      matches: this.usedMatches(this.el('ingredients').value),
    };
  }

  /** The overrides whose ingredient is still in the list (deleted lines drop their choice). */
  usedMatches(ingredientsText) {
    const keys = new Set(ingredientsText.split(/\r?\n/).filter((line) => line.trim())
      .map((line) => RecipeManager.parseIngredientLine(line).key));
    return Object.fromEntries(Object.entries(this.matches).filter(([key]) => keys.has(key)));
  }

  fillForm(recipe) {
    this.el('title').value = recipe.title;
    this.el('servings').value = recipe.servings;
    this.el('ingredients').value = recipe.ingredientsText;
    this.el('instructions').value = recipe.instructions;
    this.matches = { ...(recipe.matches ?? {}) };
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

  /** Puts OCR text in the raw box for review, then parses it into the form when headings were found. */
  applyOcrText(text) {
    const raw = this.el('raw');
    raw.value = text;
    if (!RecipeManager.parseRecipeText(text).ingredientsText) {
      announce('Text was read, but no “Ingredients” heading was found. Edit the raw text, add the headings, then choose Parse into form.');
      raw.focus();
      return;
    }
    this.parseRaw();
  }

  /** Options for a food picker: special choices, custom foods, then the built-in table by aisle. */
  foodOptions(selected, matched) {
    const opt = (value, label) => `<option value="${escapeHTML(value)}"${value === selected ? ' selected' : ''}>${escapeHTML(label)}</option>`;
    const custom = RecipeManager.customFoods();
    const groups = AISLES.map((aisle) => {
      const foods = FOOD_LIST.filter((f) => f.aisle === aisle).sort((a, b) => a.name.localeCompare(b.name));
      return foods.length ? `<optgroup label="${escapeHTML(aisle)}">${foods.map((f) => opt(f.id, f.name)).join('')}</optgroup>` : '';
    }).join('');
    return [
      opt('', matched ? 'Automatic match' : 'Choose a food…'),
      opt(IGNORE_MATCH, 'No nutrition (water, garnish, to taste)'),
      custom.length ? `<optgroup label="Your custom foods">${custom.map((f) => opt(f.id, f.name)).join('')}</optgroup>` : '',
      groups,
    ].join('');
  }

  /** "Matched food" cell: a picker for unrecognized lines, a collapsible "Change" picker otherwise. */
  matchCell(ing, i) {
    const override = this.matches[ing.key] ?? '';
    const unmatched = !ing.foodId && ing.matchSource !== 'ignored';
    const id = `${this.p}-match-${i}`;
    const picker = `
      <label class="sr-only" for="${id}">Food for “${escapeHTML(ing.raw)}”</label>
      <select id="${id}" class="match-select" data-match-key="${escapeHTML(ing.key)}">${this.foodOptions(override, !unmatched)}</select>`;
    if (unmatched) return `<span class="badge badge--warn"><span aria-hidden="true">!</span> Not recognized</span>${picker}`;
    const name = ing.matchSource === 'ignored' ? 'No nutrition' : escapeHTML(ing.food.name);
    const yours = ing.matchSource === 'auto' ? '' : ' <span class="match-note">(your choice)</span>';
    return `${name}${yours}
      <details class="match-change"${this.focusKey === ing.key ? ' open' : ''}>
        <summary>Change<span class="sr-only"> food for “${escapeHTML(ing.raw)}”</span></summary>
        ${picker}
      </details>`;
  }

  /** Form for a per-100 g custom food, below the analysis table. Open while anything is unrecognized. */
  customFoodForm(ingredients) {
    const p = this.p;
    const input = (key, label, unit, attrs) => `
      <div class="field">
        <label for="${p}-custom-${key}">${label} <span class="field__hint">(${unit})</span></label>
        <input type="number" id="${p}-custom-${key}" min="0" step="any" inputmode="decimal" ${attrs} aria-describedby="${p}-custom-${key}-error">
        <p id="${p}-custom-${key}-error" class="field-error"></p>
      </div>`;
    const fields = CUSTOM_FOOD_FIELDS.map((f) => input(f.key, f.label, f.unit, `max="${f.max}"${f.key === 'calories' ? ' required' : ''}`)).join('');
    const unmatched = ingredients.filter((ing) => !ing.foodId && ing.matchSource !== 'ignored');
    const seen = new Set();
    const targetOptions = [...unmatched, ...ingredients.filter((ing) => !unmatched.includes(ing))]
      .filter((ing) => !seen.has(ing.key) && seen.add(ing.key))
      .map((ing, i) => `<option value="${escapeHTML(ing.key)}"${i === 0 && unmatched.length ? ' selected' : ''}>${escapeHTML(ing.raw)}</option>`).join('');
    return `
      <details class="custom-food"${unmatched.length ? ' open' : ''}>
        <summary>Add a custom food</summary>
        <fieldset class="custom-food__fields">
          <legend>Custom food, values per 100 g</legend>
          <p class="field__hint">Copy the numbers from a nutrition label, scaled to 100 g. Vitamins and minerals you can't enter count as 0. Custom foods are saved to your account on this device. Only their name is checked for allergens, so choose a built-in food when you can.</p>
          <div class="field">
            <label for="${p}-custom-name">Name</label>
            <input type="text" id="${p}-custom-name" maxlength="60" autocomplete="off" required aria-describedby="${p}-custom-name-error">
            <p id="${p}-custom-name-error" class="field-error"></p>
          </div>
          <div class="custom-food__grid">
            ${fields}
            ${input('gPerUnit', 'Grams per piece', 'optional', 'max="5000"')}
            ${input('gPerCup', 'Grams per cup', 'optional', 'max="2000"')}
          </div>
          <div class="field">
            <label for="${p}-custom-target">Use for ingredient</label>
            <select id="${p}-custom-target"><option value="">Don't assign yet</option>${targetOptions}</select>
          </div>
          <div class="button-row">
            <button type="button" id="${p}-custom-add" class="btn btn--secondary">Add custom food</button>
          </div>
        </fieldset>
      </details>`;
  }

  /** Renders the analysis panel for a recipe and returns the screened analysis (or null). */
  renderAnalysis(recipe) {
    const out = this.el('analysis');
    if (!recipe.ingredientsText) {
      out.innerHTML = '<p>Add at least one ingredient to analyze.</p>';
      return null;
    }
    const temp = { ...recipe, servings: recipe.servings || 1, matches: recipe.matches ?? this.matches };
    const { ingredients: parsed } = RecipeManager.analyze(temp);
    const analysis = analyzeForUser(temp);
    const { ingredients, perServing: p, unmatched, isSafe, flagged } = analysis;
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
    const warningId = `${this.p}-analysis-warning`;
    const rows = ingredients.map((ing, i) => {
      const original = parsed[i];
      const isUnmatched = !original.foodId && original.matchSource !== 'ignored';
      return `
      <tr${isUnmatched ? ' class="is-unmatched"' : ''}>
        <th scope="row">${escapeHTML(ing.raw)}</th>
        <td>${this.matchCell(original, i)}</td>
        <td>${ing.foodId && ing.matchSource !== 'ignored' ? `${fmt(ing.grams)} g` : '—'}</td>
        <td>${fmt(ing.nutrients.calories)}</td>
        <td>${fmt(ing.nutrients.sodium)}</td>
        <td>${checkCell(ing, i)}</td>
      </tr>`;
    }).join('');
    out.innerHTML = `
      ${unmatched ? `<p class="analysis__warn" id="${warningId}"><span class="badge badge--warn"><span aria-hidden="true">!</span> Incomplete</span>
        ${unmatched} ingredient${unmatched === 1 ? ' is' : 's are'} not recognized and counted as zero, so these totals are too low.
        Choose a food for each highlighted line or add a custom food.</p>` : ''}
      <p class="analysis__summary"${unmatched ? ` aria-describedby="${warningId}"` : ''}>Per serving${unmatched ? ' (incomplete)' : ''}:
        <strong>${unmatched ? 'at least ' : ''}${fmt(p.calories)} kcal</strong> ·
        ${fmt(p.protein)} g protein · ${fmt(p.carbs)} g carbs · ${fmt(p.fat)} g fat (${fmt(p.saturatedFat)} g saturated) ·
        ${fmt(p.fiber)} g fiber · ${fmt(p.sodium)} mg sodium · ${fmt(p.iron)} mg iron</p>
      ${!isSafe ? `<p class="analysis__danger">${SubstitutionEngine.badge(blockedHits(flagged), { blocked: true })} This recipe contains an allergen with no safe substitute. It will be left out of your meal plan and grocery list.</p>` : ''}
      ${isSafe && flagged.length ? `<p class="analysis__warn">Nutrition reflects ${flagged.length} swap${flagged.length === 1 ? '' : 's'} for your allergies and diet.</p>` : ''}
      <div class="table-wrap">
        <table class="data-table analysis__table">
          <caption>Ingredient matches for the whole recipe</caption>
          <thead><tr><th scope="col">Ingredient</th><th scope="col">Matched food</th><th scope="col">Weight</th><th scope="col">kcal</th><th scope="col">Sodium (mg)</th><th scope="col">Allergy &amp; diet check</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${this.customFoodForm(parsed)}`;
    if (this.focusKey) {
      const select = [...out.querySelectorAll('select[data-match-key]')].find((el) => el.dataset.matchKey === this.focusKey);
      select?.focus();
      this.focusKey = null;
    }
    return analysis;
  }

  /** Short spoken summary after an analysis render (the panel itself is not a live region). */
  announceAnalysis(analysis, prefix = '') {
    if (!analysis) return;
    const { perServing: p, unmatched } = analysis;
    const rest = unmatched
      ? ` ${unmatched} ingredient${unmatched === 1 ? ' is' : 's are'} not recognized; totals are incomplete.`
      : ' All ingredients matched.';
    announce(`${prefix}${unmatched ? 'at least ' : ''}${fmt(p.calories)} kcal per serving.${rest}`);
  }

  bindAnalysisControls() {
    const out = this.el('analysis');
    out.addEventListener('change', (e) => {
      const select = e.target.closest('select[data-match-key]');
      if (!select) return;
      const key = select.dataset.matchKey;
      if (select.value) this.matches[key] = select.value;
      else delete this.matches[key];
      this.focusKey = key;
      let chosen = 'the automatic match';
      if (select.value === IGNORE_MATCH) chosen = 'no nutrition';
      else if (select.value) chosen = select.selectedOptions[0].textContent;
      this.announceAnalysis(this.renderAnalysis(this.readForm()), `“${key}” now uses ${chosen}. `);
    });
    out.addEventListener('click', (e) => {
      if (e.target.closest(`#${this.p}-custom-add`)) this.addCustomFood();
    });
    out.addEventListener('keydown', (e) => {
      // Enter inside the custom food fields must not submit the recipe form.
      if (e.key === 'Enter' && e.target.closest('.custom-food input')) {
        e.preventDefault();
        this.addCustomFood();
      }
    });
  }

  /** Validates the custom food fields, saves the food to the account and optionally assigns it to a line. */
  addCustomFood() {
    const field = (key) => this.el(`custom-${key}`);
    const num = (key) => (field(key).value.trim() === '' ? null : Number(field(key).value));
    const values = Object.fromEntries(CUSTOM_FOOD_FIELDS.map((f) => [f.key, num(f.key)]));
    const name = field('name').value.trim();
    const errors = {};
    if (!name) errors.name = 'Enter a name for the food.';
    else if (RecipeManager.customFoods().some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      errors.name = 'You already have a custom food with this name.';
    }
    CUSTOM_FOOD_FIELDS.forEach((f) => {
      const v = values[f.key];
      if (f.key === 'calories' && v === null) errors.calories = 'Enter calories per 100 g.';
      else if (v !== null && !(v >= 0 && v <= f.max)) errors[f.key] = `Enter a number from 0 to ${fmt(f.max)}.`;
    });
    const macros = (values.protein ?? 0) + (values.carbs ?? 0) + (values.fat ?? 0);
    if (!errors.fat && macros > 100) errors.fat = 'Protein, carbohydrates and fat add up to more than 100 g.';
    if (!errors.saturatedFat && (values.saturatedFat ?? 0) > (values.fat ?? Infinity)) errors.saturatedFat = 'Saturated fat cannot be more than total fat.';
    if (!errors.sugar && (values.sugar ?? 0) > (values.carbs ?? Infinity)) errors.sugar = 'Sugar cannot be more than carbohydrates.';
    ['gPerUnit', 'gPerCup'].forEach((key) => {
      const v = num(key);
      if (v !== null && !(v > 0 && v <= Number(field(key).max))) errors[key] = `Enter a weight from 1 to ${field(key).max} g, or leave it blank.`;
    });

    let firstInvalid = null;
    ['name', ...CUSTOM_FOOD_FIELDS.map((f) => f.key), 'gPerUnit', 'gPerCup'].forEach((key) => {
      setFieldError(field(key), errors[key] ?? '');
      if (errors[key] && !firstInvalid) firstInvalid = field(key);
    });
    if (firstInvalid) {
      firstInvalid.focus();
      announce('Please fix the highlighted custom food fields.');
      return;
    }

    const stored = {
      id: `custom-${createId().slice(2)}`,
      name,
      nutrients: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v ?? 0])),
      gPerUnit: num('gPerUnit'),
      gPerCup: num('gPerCup'),
    };
    saveCustomFoods([...(state.customFoods ?? []), stored]);
    const target = this.el('custom-target').value;
    if (target) {
      this.matches[target] = stored.id;
      this.focusKey = target;
    }
    const analysis = this.renderAnalysis(this.readForm());
    if (!target) this.el('custom-add').focus();
    this.announceAnalysis(analysis, `Added custom food “${name}”${target ? ` and used it for “${target}”` : ''}. `);
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
    this.matches = {};
    this.focusKey = null;
    this.el('form').reset();
    this.el('raw').value = '';
    this.el('form').querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    this.el('form').querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
    this.el('cancel').hidden = true;
    this.el('save').textContent = 'Save recipe';
    this.el('analysis').innerHTML = '';
  }
}
