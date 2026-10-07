import { $, announce } from '../util.js';
import { AccountManager } from '../engines/accounts.js';
import { App } from '../main.js';
import { loadUserData, saveUserData, state } from '../state.js';
import { Storage } from '../storage.js';
import { BackupUI } from './backup.js';

export const AccountUI = {
  email: null,

  /** Restores a saved session before other controllers read state. */
  init() {
    const restored = AccountManager.restoreSession();
    if (restored) {
      this.email = restored;
      Storage.scope = restored;
      Object.assign(state, loadUserData());
    }
    this.renderState();

    $('#account-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    $('#btn-logout').addEventListener('click', () => this.signOut());
    $('#btn-delete-account').addEventListener('click', () => this.deleteAccount());

    const toggle = $('#toggle-password');
    toggle.addEventListener('click', () => {
      const show = toggle.getAttribute('aria-pressed') !== 'true';
      $('#user-password').type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
    });
  },

  setError(id, message) {
    $(`#${id}`).setAttribute('aria-invalid', String(Boolean(message)));
    $(`#${id}-error`).textContent = message;
  },

  validate() {
    const email = $('#user-email');
    const password = $('#user-password');
    const emailOk = email.value.trim() !== '' && email.validity.valid;
    const passwordOk = password.value.length >= 8;
    this.setError('user-email', emailOk ? '' : 'Enter an email address like you@example.com.');
    this.setError('user-password', passwordOk ? '' : 'Use at least 8 characters.');
    if (!emailOk) return email;
    return passwordOk ? null : password;
  },

  async submit() {
    const invalid = this.validate();
    if (invalid) {
      invalid.focus();
      announce('Please fix the highlighted account fields.');
      return;
    }
    const button = $('#btn-create-account');
    const password = $('#user-password');
    button.disabled = true;
    button.textContent = 'Checking…';
    try {
      const { email, created } = await AccountManager.signInOrCreate($('#user-email').value, password.value);
      if (created) {
        Storage.scope = email;
        saveUserData(); // the new account starts with the guest's current plan
      }
      Storage.save(Storage.KEYS.session, email);
      $('#account-form').reset();
      this.activate(email);
      announce(created
        ? `Account created for ${email}. Your current profile and meal plan were copied into it.`
        : `Signed in as ${email}. Your saved profile and meal plan are loaded.`);
    } catch (error) {
      if (error.message === 'wrong-password') {
        this.setError('user-password', 'That password does not match this email. Try again.');
        password.select();
        password.focus();
      } else {
        this.setError('user-email', 'Accounts need a secure (https) connection and a modern browser.');
      }
    } finally {
      button.disabled = false;
      button.textContent = 'Create account / Sign in';
      password.type = 'password';
      $('#toggle-password').setAttribute('aria-pressed', 'false');
    }
  },

  activate(email) {
    this.email = email;
    Storage.scope = email;
    App.reloadUserData();
    this.renderState();
    $('#account-status').focus();
  },

  signOut(message) {
    Storage.remove(Storage.KEYS.session);
    const previous = this.email;
    this.email = null;
    Storage.scope = null;
    App.reloadUserData();
    this.renderState();
    $('#user-email').focus();
    announce(message ?? `Signed out of ${previous}. You are now browsing as a guest.`);
  },

  deleteAccount() {
    const { email } = this;
    if (!window.confirm(`Permanently delete the account ${email} and all of its saved data on this device?`)) return;
    AccountManager.deleteAccount(email);
    this.signOut(`Account ${email} and its data were deleted.`);
  },

  renderState() {
    const signedIn = Boolean(this.email);
    $('#logged-out-view').hidden = signedIn;
    $('#logged-in-view').hidden = !signedIn;
    $('#display-user-email').textContent = this.email ?? '';
    $('#account-chip-label').textContent = signedIn ? this.email : 'Sign in';
    BackupUI.renderOwner();
  },
};
