import { DIETS, RESTRICTIONS } from '../data/restrictions.js';
import { AuthManager } from '../engines/auth.js';
import { NutritionEngine } from '../engines/nutrition.js';
import { App } from '../main.js';
import { currentTargets, firstName, state } from '../state.js';
import { TargetsUI } from './dashboard.js';
import { OnboardingWizard } from './onboarding.js';
import { $, escapeHTML, fmt } from '../util.js';


export const ProfileDrawer = {
  init() {
    const dialog = $('#profile-drawer');
    $('#profile-button').addEventListener('click', () => {
      this.render();
      dialog.showModal();
    });
    $('#drawer-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close(); // backdrop click
    });
    $('#drawer-edit').addEventListener('click', () => {
      dialog.close();
      OnboardingWizard.start('edit');
    });
    $('#drawer-signout').addEventListener('click', () => App.signOut());
    $('#drawer-delete').addEventListener('click', () => {
      const { email } = state.account;
      if (!window.confirm(`Permanently delete the account ${email} and all of its saved data on this device?`)) return;
      AuthManager.deleteAccount(email);
      App.signOut(`Account ${email} and its data were deleted.`);
    });
  },

  renderButton() {
    const { fullName } = state.account;
    const c = NutritionEngine.bodyComposition(state.profile);
    $('#profile-initials').textContent = fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    $('#profile-button-name').textContent = firstName();
    $('#profile-button-stats').textContent = `BMI ${fmt(c.bmi)}${c.waistToHip ? ` · WHR ${c.waistToHip.toFixed(2)}` : ''}`;
  },

  render() {
    const { profile, account } = state;
    $('#drawer-name').textContent = account.fullName;
    $('#drawer-email').textContent = account.email;
    $('#drawer-body').innerHTML = TargetsUI.bodyRows()
      .map(([label, value, note]) => `<div><dt>${label}</dt><dd>${value} <span class="meta">${note}</span></dd></div>`).join('');
    const allergies = profile.allergies.map((a) => RESTRICTIONS[a].label).join(', ') || 'None';
    const prefs = [
      ['Goal', `${NutritionEngine.GOALS[profile.goal].label}${profile.goal === 'maintain' ? '' : `, ${profile.timelineWeeks} weeks`}`],
      ['Diet', DIETS[profile.diet].label],
      ['Allergies', allergies],
      ['Daily target', `${fmt(currentTargets().targets.calories)} kcal`],
    ];
    $('#drawer-prefs').innerHTML = prefs.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHTML(value)}</dd></div>`).join('');
  },
};
