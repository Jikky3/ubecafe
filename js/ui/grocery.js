import { GroceryAggregator } from '../engines/grocery.js';
import { recipesById, state } from '../state.js';
import { Storage } from '../storage.js';
import { $, announce, escapeHTML } from '../util.js';

export const GroceryUI = {
  init() {
    const household = $('#household-size');
    this.syncForm();
    household.addEventListener('change', () => {
      const value = Math.min(12, Math.max(1, Math.round(Number(household.value) || 1)));
      household.value = value;
      state.grocery.household = value;
      Storage.save(Storage.KEYS.grocery, state.grocery);
      this.render();
      announce(`Grocery quantities updated for ${value} ${value === 1 ? 'person' : 'people'}.`);
    });

    $('#grocery-list').addEventListener('change', (e) => {
      const checked = new Set(state.grocery.checked);
      if (e.target.checked) checked.add(e.target.value);
      else checked.delete(e.target.value);
      state.grocery.checked = [...checked];
      Storage.save(Storage.KEYS.grocery, state.grocery);
      this.updateProgress();
    });

    $('#uncheck-all').addEventListener('click', () => {
      state.grocery.checked = [];
      Storage.save(Storage.KEYS.grocery, state.grocery);
      document.querySelectorAll('#grocery-list input[type="checkbox"]').forEach((box) => { box.checked = false; });
      this.updateProgress();
      announce('All grocery items unchecked.');
    });

    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + ((7 - now.getDay()) % 7));
    $('#shopping-day').textContent = now.getDay() === 0
      ? 'Today is Sunday: your list is ready to shop.'
      : `Next shopping day: ${sunday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
  },

  /** Reflects the active user's household size in the form. */
  syncForm() {
    $('#household-size').value = state.grocery.household;
  },

  render() {
    const groups = GroceryAggregator.aggregate(state.plan, recipesById(), state.grocery.household, state.supplements.selected);
    const checked = new Set(state.grocery.checked);
    const list = $('#grocery-list');
    if (!groups.length) {
      list.innerHTML = '<p class="empty">Your list is empty. Plan some meals for the week to generate it.</p>';
      this.updateProgress();
      return;
    }
    list.innerHTML = groups.map((group) => `
      <fieldset class="card aisle">
        <legend>${group.aisle} <span class="aisle__count">(${group.items.length})</span></legend>
        <ul class="aisle__items">
          ${group.items.map((item) => {
            const id = `g-${item.key.replace(/[^a-z0-9-]/gi, '-')}`;
            return `
              <li class="check check--grocery">
                <input type="checkbox" id="${id}" value="${escapeHTML(item.key)}" ${checked.has(item.key) ? 'checked' : ''}>
                <label for="${id}"><span class="grocery__name">${escapeHTML(item.name)}</span> <span class="grocery__qty">${escapeHTML(item.amount)}</span></label>
              </li>`;
          }).join('')}
        </ul>
      </fieldset>`).join('');
    this.updateProgress();
  },

  updateProgress() {
    const boxes = [...document.querySelectorAll('#grocery-list input[type="checkbox"]')];
    const done = boxes.filter((b) => b.checked).length;
    $('#grocery-progress').textContent = boxes.length ? `${done} of ${boxes.length} items in your basket.` : '';
  },
};
