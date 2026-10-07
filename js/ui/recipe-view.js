import { DAYS, DAY_LABELS, MEAL_SLOTS, SLOT_BY_ID, SUPPLEMENT_BY_ID } from '../data/constants.js';
import { NUTRIENTS } from '../data/nutrients.js';
import { RecipeMatcher } from '../engines/recipe-match.js';
import { ScheduleOptimizer } from '../engines/schedule.js';
import { SubstitutionEngine } from '../engines/substitution.js';
import { App } from '../main.js';
import { analyzeForUser, blockedHits, currentTargets, mealsForDay, state } from '../state.js';
import { $, announce, escapeHTML, fmt } from '../util.js';

const HASH_PREFIX = '#recipe/';

/**
 * Full recipe page in a modal dialog: ingredients and steps to cook along with,
 * per-serving nutrition, and — when opened from a planned meal — the timing
 * tips and supplements that go with it.
 *
 * Any element with data-view-recipe="<id>" opens it (optionally with
 * data-day / data-slot for meal context), and #recipe/<id> deep-links to it.
 */
export const RecipeView = {
  dialog: null,
  opener: null,
  returnHash: '',

  init() {
    this.dialog = $('#recipe-dialog');

    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-view-recipe]');
      if (!trigger) return;
      e.preventDefault();
      this.open(trigger.dataset.viewRecipe, { day: trigger.dataset.day, slot: trigger.dataset.slot }, trigger);
    });

    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.dialog.close(); // backdrop click
      const action = e.target.closest('button[data-dialog-action]')?.dataset.dialogAction;
      if (action === 'close') this.dialog.close();
      if (action === 'print') window.print();
      if (action === 'edit') {
        const recipe = state.recipes.find((r) => r.id === this.dialog.dataset.id);
        this.opener = null; // focus moves to the edit form instead
        this.dialog.close();
        App.tabs.select('tab-recipes');
        App.importer.edit(recipe);
        $('#lib-form').scrollIntoView({ block: 'start' });
      }
    });

    this.dialog.addEventListener('change', (e) => {
      if (!e.target.matches('.cook-list input[type="checkbox"]')) return;
      const list = e.target.closest('.cook-list');
      const done = list.querySelectorAll('input:checked').length;
      const total = list.querySelectorAll('input').length;
      $(`#${list.dataset.progress}`).textContent = `${done} of ${total} done`;
    });

    this.dialog.addEventListener('close', () => {
      if (window.location.hash.startsWith(HASH_PREFIX)) {
        window.history.replaceState(null, '', this.returnHash || window.location.pathname + window.location.search);
      }
      if (this.opener?.isConnected) this.opener.focus();
      this.opener = null;
    });

    window.addEventListener('hashchange', () => this.openFromHash());
  },

  /** Opens the recipe named in the URL hash, if any (call after first render). */
  openFromHash() {
    const { hash } = window.location;
    if (!hash.startsWith(HASH_PREFIX)) {
      if (this.dialog.open) this.dialog.close();
      return;
    }
    const id = decodeURIComponent(hash.slice(HASH_PREFIX.length));
    if (this.dialog.open && this.dialog.dataset.id === id) return;
    if (!state.account) return; // App.showApp() calls this again after sign-in
    if (!this.open(id)) announce('That recipe is not in your library.');
  },

  /**
   * @param {string} id – recipe id
   * @param {{day?: string, slot?: string}} context – the planned meal it was opened from
   * @param {HTMLElement} [opener] – element to return focus to
   * @returns {boolean} whether the recipe exists
   */
  open(id, context = {}, opener = document.activeElement) {
    const recipe = state.account && state.recipes.find((r) => r.id === id);
    if (!recipe) return false;
    this.opener = opener;
    if (!window.location.hash.startsWith(HASH_PREFIX)) this.returnHash = window.location.hash;
    window.history.replaceState(null, '', `${HASH_PREFIX}${encodeURIComponent(id)}`);

    this.dialog.dataset.id = id;
    $('#recipe-dialog-body').innerHTML = this.render(recipe, context);
    if (!this.dialog.open) this.dialog.showModal();
    $('#recipe-view-title').focus();
    return true;
  },

  /** Where this recipe sits in the weekly plan, e.g. ["Monday lunch", …]. */
  plannedSlots(id) {
    return DAYS.flatMap((day) => MEAL_SLOTS
      .filter((slot) => state.plan[day]?.[slot.id] === id)
      .map((slot) => ({ day, slot: slot.id, label: `${DAY_LABELS[day]} ${slot.label.toLowerCase()}` })));
  },

  render(recipe, { day, slot } = {}) {
    const { ingredients, perServing: p, unmatched, isSafe, flagged } = analyzeForUser(recipe);
    const { targets } = currentTargets();
    const highlights = RecipeMatcher.highlights(p, targets);
    const steps = recipe.instructions.split(/\r?\n/).map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
    const planned = this.plannedSlots(recipe.id);
    const hasContext = day && slot && SLOT_BY_ID[slot];

    const contextBlock = hasContext ? this.renderMealContext(recipe, day, slot) : '';
    const plannedNote = planned.length
      ? `<p class="recipe-view__planned"><strong>On your plan:</strong> ${planned.map((s) => escapeHTML(s.label)).join(', ')}</p>`
      : '<p class="recipe-view__planned">Not on this week\'s plan yet. Pick it in the weekly meal plan to add it.</p>';

    const swapNote = (ing) => {
      const flag = flagged.find((f) => f.raw === ing.raw);
      if (!flag) return '';
      const badge = SubstitutionEngine.badge(flag.hits, { isAllergy: flag.isAllergy, blocked: !flag.substitute });
      if (!flag.substitute) return `<span class="cook-swap">${badge} No safe substitute</span>`;
      if (flag.substitute.name === 'Omit') return `<span class="cook-swap">${badge} Leave this out. ${escapeHTML(flag.substitute.note)}</span>`;
      return `<span class="cook-swap">${badge} Use <strong>${escapeHTML(flag.substitute.name)}</strong> instead (${escapeHTML(flag.substitute.ratio)}). ${escapeHTML(flag.substitute.note)}</span>`;
    };
    const ingredientItems = ingredients.map((ing, i) => `
      <li class="check">
        <input type="checkbox" id="cook-ing-${i}">
        <label for="cook-ing-${i}">${escapeHTML(ing.raw)}${ing.foodId || ing.swappedFrom || ing.omitted ? '' : ' <span class="badge badge--warn"><span aria-hidden="true">!</span> No nutrition data</span>'}${swapNote(ing)}</label>
      </li>`).join('');
    const safetyNote = !isSafe
      ? `<p class="analysis__danger">${SubstitutionEngine.badge(blockedHits(flagged), { blocked: true })} This recipe contains an allergen with no safe substitute, so it is left out of your plan, dashboard and grocery list.</p>`
      : flagged.length ? `<p class="analysis__warn">Adjusted for your allergies and diet: ${flagged.length} swap${flagged.length === 1 ? '' : 's'}, marked in the ingredient list. Nutrition below includes them.</p>` : '';
    const stepItems = steps.map((step, i) => `
      <li class="check">
        <input type="checkbox" id="cook-step-${i}">
        <label for="cook-step-${i}"><span class="cook-step__num">Step ${i + 1}.</span> ${escapeHTML(step)}</label>
      </li>`).join('');

    const nutritionRows = NUTRIENTS.map((meta) => {
      const pct = targets[meta.key] > 0 ? Math.round((p[meta.key] / targets[meta.key]) * 100) : 0;
      return `<tr><th scope="row">${meta.label}</th><td>${fmt(p[meta.key])} ${meta.unit}</td><td>${pct}%${meta.isLimit ? ' of limit' : ''}</td></tr>`;
    }).join('');

    return `
      <header class="recipe-view__header">
        <p class="eyebrow">${hasContext ? `${DAY_LABELS[day]} · ${SLOT_BY_ID[slot].label} · ${SLOT_BY_ID[slot].display}` : 'Recipe'}</p>
        <h2 id="recipe-view-title" class="recipe-view__title" tabindex="-1">${escapeHTML(recipe.title)}</h2>
        <p class="meta">Makes ${recipe.servings} serving${recipe.servings === 1 ? '' : 's'} · nutrition shown per serving</p>
        ${plannedNote}
      </header>

      ${safetyNote}
      <dl class="macro-chips">
        <div><dt>kcal</dt><dd>${fmt(p.calories)}</dd></div>
        <div><dt>Protein</dt><dd>${fmt(p.protein)} g</dd></div>
        <div><dt>Carbs</dt><dd>${fmt(p.carbs)} g</dd></div>
        <div><dt>Fat</dt><dd>${fmt(p.fat)} g</dd></div>
      </dl>
      ${highlights.length ? `
        <p class="recipe-view__highlights"><strong>Good source of:</strong>
          ${highlights.map((h) => `<span class="chip">${h.label} <span class="chip__pct">${h.pct}%</span></span>`).join(' ')}
          <span class="field__hint">(share of your daily target per serving)</span>
        </p>` : ''}
      ${unmatched ? `<p class="analysis__warn">${unmatched} ingredient${unmatched === 1 ? ' has' : 's have'} no nutrition data, so the numbers above are an underestimate.</p>` : ''}

      ${contextBlock}

      <div class="recipe-view__columns">
        <section aria-labelledby="cook-ingredients-title">
          <h3 id="cook-ingredients-title">Ingredients <span id="cook-ingredients-progress" class="cook-progress" aria-live="polite"></span></h3>
          <ul class="cook-list" data-progress="cook-ingredients-progress">${ingredientItems}</ul>
        </section>
        <section aria-labelledby="cook-steps-title">
          <h3 id="cook-steps-title">Method <span id="cook-steps-progress" class="cook-progress" aria-live="polite"></span></h3>
          ${steps.length
            ? `<ol class="cook-list" data-progress="cook-steps-progress">${stepItems}</ol>`
            : '<p class="empty">No instructions saved. Edit the recipe to add steps.</p>'}
        </section>
      </div>

      <details class="recipe-view__details">
        <summary>Full nutrition per serving</summary>
        <div class="table-wrap">
          <table class="data-table">
            <caption>Per serving, compared with your daily targets</caption>
            <thead><tr><th scope="col">Nutrient</th><th scope="col">Amount</th><th scope="col">Of daily target</th></tr></thead>
            <tbody>${nutritionRows}</tbody>
          </table>
        </div>
      </details>`;
  },

  /** Timing tips and supplements for the planned meal this recipe was opened from. */
  renderMealContext(recipe, day, slot) {
    const meals = mealsForDay(day);
    const planned = meals[slot]?.recipe.id === recipe.id && !meals[slot].blocked;
    const meal = planned ? meals[slot] : { recipe, nutrients: analyzeForUser(recipe).perServing };
    const { selected, coffeeAtBreakfast } = state.supplements;
    const tips = ScheduleOptimizer.mealTips(slot, meal, coffeeAtBreakfast);
    const supplements = ScheduleOptimizer.build({ ...meals, [slot]: meal }, selected, coffeeAtBreakfast)[slot];
    if (!tips.length && !supplements.length) return '';
    return `
      <aside class="recipe-view__context" aria-label="With this meal">
        <h3>With this meal</h3>
        <ul>
          ${supplements.map((s) => `<li><strong>Take ${escapeHTML(SUPPLEMENT_BY_ID[s.id].label)}:</strong> ${escapeHTML(s.reason)}</li>`).join('')}
          ${tips.map((t) => `<li>${escapeHTML(t)}</li>`).join('')}
        </ul>
      </aside>`;
  },
};
