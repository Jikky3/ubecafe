import { RecommendationEngine } from '../engines/recommendations.js';
import { SubstitutionEngine } from '../engines/substitution.js';
import { state } from '../state.js';
import { $, escapeHTML } from '../util.js';

export const RecommendationsUI = {
  render({ intake, targets, plannedCount }) {
    const recs = RecommendationEngine.recommend(intake, targets, plannedCount, SubstitutionEngine.restrictionsFor(state.profile));
    const label = { high: 'High priority', medium: 'Suggested', info: 'Note' };
    const level = { high: 'danger', medium: 'warn', info: 'ok' };
    $('#recommendation-list').innerHTML = recs.map((rec) => `
      <li>
        <article class="card rec rec--${rec.priority}">
          <p><span class="badge badge--${level[rec.priority]}">${label[rec.priority]}</span></p>
          <h3 class="rec__food">${escapeHTML(rec.food)}</h3>
          <p class="meta"><strong>Why now:</strong> ${escapeHTML(rec.trigger)}</p>
          <p>${escapeHTML(rec.reason)}</p>
          ${rec.restrictionNote ? `<p class="meta">${escapeHTML(rec.restrictionNote)}</p>` : ''}
        </article>
      </li>`).join('');
  },
};
