import { DAYS, MEAL_SLOTS } from '../data/constants.js';
import { SubstitutionEngine } from '../engines/substitution.js';
import { App } from '../main.js';
import { analyzeForUser, state } from '../state.js';
import { Storage } from '../storage.js';
import { $, announce, escapeHTML, fmt } from '../util.js';


export const RecipeLibrary = {
  init() {
    $('#recipe-library').addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      const recipe = state.recipes.find((r) => r.id === button.dataset.id);
      if (button.dataset.action === 'edit') App.importer.edit(recipe);
      if (button.dataset.action === 'delete') this.remove(recipe);
    });
  },

  /** Inserts or replaces a recipe; returns true when it was an update. */
  upsert(recipe) {
    const index = state.recipes.findIndex((r) => r.id === recipe.id);
    if (index >= 0) state.recipes.splice(index, 1, recipe);
    else state.recipes.push(recipe);
    Storage.save(Storage.KEYS.recipes, state.recipes);
    return index >= 0;
  },

  remove(recipe) {
    if (!window.confirm(`Delete “${recipe.title}”? It will also be removed from your meal plan.`)) return;
    state.recipes = state.recipes.filter((r) => r.id !== recipe.id);
    DAYS.forEach((day) => MEAL_SLOTS.forEach((slot) => {
      if (state.plan[day][slot.id] === recipe.id) state.plan[day][slot.id] = '';
    }));
    Storage.save(Storage.KEYS.recipes, state.recipes);
    Storage.save(Storage.KEYS.plan, state.plan);
    if (App.importer.editingId === recipe.id) App.importer.reset();
    App.renderAll();
    $('#library-heading').focus();
    announce(`Deleted “${recipe.title}”.`);
  },

  render() {
    $('#recipe-count').textContent = String(state.recipes.length);
    const list = $('#recipe-library');
    if (!state.recipes.length) {
      list.innerHTML = '<li class="empty">No recipes yet. Import one above to get started.</li>';
      return;
    }
    list.innerHTML = state.recipes.map((recipe) => {
      const { perServing: p, flagged, isSafe } = analyzeForUser(recipe);
      const title = escapeHTML(recipe.title);
      const checks = flagged.map((f) => {
        const badge = SubstitutionEngine.badge(f.hits, { isAllergy: f.isAllergy, blocked: !f.substitute });
        if (!f.substitute) return `<li>${badge} ${escapeHTML(f.original)}: no safe substitute; recipe unavailable</li>`;
        return `<li>${badge} ${escapeHTML(f.original)} → <strong>${escapeHTML(f.substitute.name === 'Omit' ? 'omitted' : f.substitute.name)}</strong></li>`;
      }).join('');
      return `
        <li>
          <article class="card recipe-card">
            <h3>${title}</h3>
            <p class="meta">${recipe.servings} serving${recipe.servings === 1 ? '' : 's'} · per serving${isSafe && flagged.length ? ', with your swaps' : ''}</p>
            <dl class="macro-chips">
              <div><dt>kcal</dt><dd>${fmt(p.calories)}</dd></div>
              <div><dt>Protein</dt><dd>${fmt(p.protein)} g</dd></div>
              <div><dt>Carbs</dt><dd>${fmt(p.carbs)} g</dd></div>
              <div><dt>Fat</dt><dd>${fmt(p.fat)} g</dd></div>
            </dl>
            ${checks ? `<ul class="allergy-list" aria-label="Allergy and diet check for ${title}">${checks}</ul>` : ''}
            <div class="button-row">
              <button type="button" class="btn btn--ghost" data-action="edit" data-id="${recipe.id}" aria-label="Edit ${title}">Edit</button>
              <button type="button" class="btn btn--ghost btn--danger" data-action="delete" data-id="${recipe.id}" aria-label="Delete ${title}">Delete</button>
            </div>
          </article>
        </li>`;
    }).join('');
  },
};
