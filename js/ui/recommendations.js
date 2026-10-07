import { RecommendationEngine } from '../engines/recommendations.js';
import { $, escapeHTML } from '../util.js';

export const RecommendationsUI = {
  render({ intake, targets, plannedCount }) {
    const recs = RecommendationEngine.recommend(intake, targets, plannedCount);
    const label = { high: 'High priority', medium: 'Suggested', info: 'Note' };
    $('#recommendation-list').innerHTML = recs.map((rec) => `
      <li>
        <article class="card rec rec--${rec.priority}">
          <p class="rec__priority"><span class="badge badge--${rec.priority === 'high' ? 'danger' : rec.priority === 'medium' ? 'warn' : 'ok'}">${label[rec.priority]}</span></p>
          <h3 class="rec__food">${escapeHTML(rec.food)}</h3>
          <p class="rec__trigger"><strong>Why now:</strong> ${escapeHTML(rec.trigger)}</p>
          <p>${escapeHTML(rec.reason)}</p>
        </article>
      </li>`).join('');
  },
};
