import { AuthManager } from '../engines/auth.js';
import { App } from '../main.js';
import { firstName } from '../state.js';
import { Tabs, setFieldError } from './tabs.js';
import { $, announce } from '../util.js';


export const AuthView = {
  tabs: null,

  init() {
    this.tabs = new Tabs($('#auth-tablist'));
    $('#signin-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.signIn();
    });
    $('#signup-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.signUp();
    });
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.getAttribute('aria-controls'));
        const show = button.getAttribute('aria-pressed') !== 'true';
        input.type = show ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(show));
      });
    });
  },

  reset() {
    ['#signin-form', '#signup-form'].forEach((sel) => {
      const form = $(sel);
      form.reset();
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      form.querySelectorAll('.field-error, .form-error').forEach((el) => { el.textContent = ''; });
      form.querySelectorAll('[data-password-toggle]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      form.querySelectorAll('input[type="text"][id$="password"]').forEach((i) => { i.type = 'password'; });
    });
    this.tabs.select('tab-signin');
  },

  /** Validates fields; returns the first invalid input or null. */
  validate(checks) {
    let first = null;
    checks.forEach(([input, ok, message]) => {
      setFieldError(input, ok ? '' : message);
      if (!ok && !first) first = input;
    });
    return first;
  },

  async withBusy(form, label, task) {
    const button = form.querySelector('[type="submit"]');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = label;
    try {
      await task();
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  },

  async signIn() {
    const email = $('#signin-email');
    const password = $('#signin-password');
    $('#signin-error').textContent = '';
    const invalid = this.validate([
      [email, email.value.trim() !== '' && email.validity.valid, 'Enter an email address like you@example.com.'],
      [password, password.value !== '', 'Enter your password.'],
    ]);
    if (invalid) {
      invalid.focus();
      return;
    }
    await this.withBusy($('#signin-form'), 'Signing in…', async () => {
      try {
        App.enter(await AuthManager.signIn(email.value, password.value));
        announce(`Signed in. Welcome back, ${firstName()}.`);
      } catch (error) {
        $('#signin-error').textContent = error.message === 'invalid'
          ? 'That email and password combination was not found. Check both and try again.'
          : 'Accounts need a secure (https) connection and a modern browser.';
        password.select();
        password.focus();
      }
    });
  },

  async signUp() {
    const name = $('#signup-name');
    const email = $('#signup-email');
    const password = $('#signup-password');
    $('#signup-error').textContent = '';
    const invalid = this.validate([
      [name, name.value.trim().length >= 2, 'Enter your full name.'],
      [email, email.value.trim() !== '' && email.validity.valid, 'Enter an email address like you@example.com.'],
      [password, password.value.length >= 8, 'Use at least 8 characters.'],
    ]);
    if (invalid) {
      invalid.focus();
      return;
    }
    await this.withBusy($('#signup-form'), 'Creating account…', async () => {
      try {
        App.enter(await AuthManager.register(name.value, email.value, password.value));
        announce('Account created. Let’s set up your profile, step 1 of 4.');
      } catch (error) {
        if (error.message === 'exists') {
          setFieldError(email, 'An account with this email already exists. Choose “Sign in” instead.');
          email.focus();
        } else {
          $('#signup-error').textContent = 'Accounts need a secure (https) connection and a modern browser.';
        }
      }
    });
  },
};
