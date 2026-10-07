import { SLOT_BY_ID } from '../data/constants.js';
import { NUTRIENT_BY_KEY } from '../data/nutrients.js';
import { RecipeMatcher } from '../engines/recipe-match.js';
import { RecommendationEngine } from '../engines/recommendations.js';
import { SubstitutionEngine } from '../engines/substitution.js';
import { analyzeForUser, state } from '../state.js';
import { $, escapeHTML, fmt } from '../util.js';

export const RecommendationsUI = {
  render({ intake, targets, plannedCount, meals }) {
    const recs = RecommendationEngine.recommend(intake, targets, plannedCount, SubstitutionEngine.restrictionsFor(state.profile));
    const label = { high: 'High priority', medium: 'Suggested', info: 'Note' };
    const level = { high: 'danger', medium: 'warn', info: 'ok' };
    $('#recommendation-list').innerHTML = recs.map((rec) => `
      <li>
        <article class="card rec rec--${rec.priority}">
          <p><span class="badge badge--${level[rec.priority]}">${label[rec.priority]}</span></p>
          <h3 class="rec__food">${escapeHTML(rec.food)}</h3>
          <p class="meta"><strong>Why now:</strong> ${escapeHTML(rec.trigger)}</p>
          ${rec.key ? this.renderGap(rec.key, intake, targets) : ''}
          <p>${escapeHTML(rec.reason)}</p>
          ${rec.restrictionNote ? `<p class="meta">${escapeHTML(rec.restrictionNote)}</p>` : ''}
          ${rec.key ? this.renderMeals(rec.key, intake, targets, meals) : ''}
        </article>
      </li>`).join('');
  },

  /** "8.1 of 18 mg · 9.9 mg to go" with a small meter. */
  renderGap(key, intake, targets) {
    const meta = NUTRIENT_BY_KEY[key];
    const g = RecipeMatcher.gap(key, intake, targets);
    const status = g.direction === 'increase'
      ? `${fmt(g.remaining)} ${meta.unit} to go`
      : g.over > 0 ? `${fmt(g.over)} ${meta.unit} over` : 'within limit';
    const id = `rec-gap-${key}`;
    return `
      <div class="rec__gap">
        <p id="${id}" class="rec__gap-text"><strong>${fmt(g.intake)}</strong> of ${fmt(g.target)} ${meta.unit}${meta.isLimit ? ' limit' : ''} · ${status}</p>
        <div class="bar bar--slim" role="progressbar" aria-labelledby="${id}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(g.pct, 100)}" aria-valuetext="${g.pct}% of ${meta.isLimit ? 'limit' : 'target'}">
          <span class="bar__fill bar__fill--${g.direction === 'increase' ? 'warn' : 'danger'}" style="width:${Math.min(g.pct, 100)}%"></span>
        </div>
      </div>`;
  },

  /** Which planned meals drive this nutrient, and library recipes (safe for this user) that would help. */
  renderMeals(key, intake, targets, meals) {
    const meta = NUTRIENT_BY_KEY[key];
    const g = RecipeMatcher.gap(key, intake, targets);
    const day = state.viewDay;
    const plannedIds = Object.values(meals).filter((m) => m && !m.blocked).map((m) => m.recipe.id);
    const sources = RecipeMatcher.contributors(meals, key);
    const picks = RecipeMatcher.rankRecipes(state.recipes, key, {
      direction: g.direction, target: g.target, excludeIds: plannedIds, analyze: analyzeForUser,
    });
    const viewButton = (recipe, extra = '') => `<button type="button" class="link-button" data-view-recipe="${escapeHTML(recipe.id)}"${extra}>${escapeHTML(recipe.title)}</button>`;

    const sourceList = sources.length ? `
      <div class="rec__section">
        <h4 class="rec__subhead">${g.direction === 'increase' ? 'Already helping today' : 'Biggest sources today'}</h4>
        <ul class="rec__meals">
          ${sources.map((s) => `
            <li>${escapeHTML(SLOT_BY_ID[s.slotId].label)}: ${viewButton(s.recipe, ` data-day="${day}" data-slot="${s.slotId}"`)}
              <span class="rec__amount">${fmt(s.amount)} ${meta.unit} (${Math.round(s.share * 100)}% of the day's ${meta.label})</span></li>`).join('')}
        </ul>
      </div>` : '';

    const pickList = picks.length ? `
      <div class="rec__section">
        <h4 class="rec__subhead">${g.direction === 'increase' ? `Recipes rich in ${meta.label.toLowerCase()}` : 'Lighter swaps from your library'}</h4>
        <ul class="rec__meals">
          ${picks.map((pick) => `
            <li>${viewButton(pick.recipe)}
              <span class="rec__amount">${g.direction === 'increase' ? '+' : ''}${fmt(pick.amount)} ${meta.unit} per serving${g.direction === 'increase' ? ` (${pick.pctOfTarget}% of target)` : ''} · ${fmt(pick.calories)} kcal${plannedIds.includes(pick.recipe.id) ? ' · already planned' : ''}</span></li>`).join('')}
        </ul>
      </div>` : '';

    return sourceList + pickList;
  },
};
