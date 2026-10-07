import { $, announce, escapeHTML } from '../util.js';
import { BackupEngine, BackupError } from '../engines/backup.js';
import { App } from '../main.js';
import { exportUserData } from '../state.js';
import { Storage } from '../storage.js';

const STORAGE_NOTES = {
  indexedDB: 'Saved in this browser’s IndexedDB storage.',
  localStorage: 'Saved in this browser’s localStorage (IndexedDB is unavailable here).',
  memory: 'This browser is blocking storage, so changes last only until you close the tab. Download a backup to keep them.',
};

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Export / import of the active user's data, with optional passphrase encryption. */
export const BackupUI = {
  /** Parsed envelope of the chosen file, and the migrated data awaiting confirmation. */
  file: null,
  pending: null,

  init() {
    $('#storage-status').textContent = STORAGE_NOTES[Storage.backendName] ?? '';
    this.renderOwner();

    const encrypt = $('#export-encrypt');
    encrypt.addEventListener('change', () => {
      $('#export-passphrase-fields').hidden = !encrypt.checked;
      $('#btn-export').textContent = encrypt.checked ? 'Download encrypted backup' : 'Download backup';
      if (!encrypt.checked) this.clearExportErrors();
    });
    $('#export-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.exportData();
    });

    $('#import-file').addEventListener('change', () => this.readFile());
    $('#import-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.checkImport();
    });
    $('#btn-import-confirm').addEventListener('click', () => this.confirmImport());
    $('#btn-import-cancel').addEventListener('click', () => this.cancelImport());
  },

  owner() {
    return Storage.scope ? `the account ${Storage.scope}` : 'this guest profile';
  },

  /** Keeps the "whose data" wording in sync with sign-in state. */
  renderOwner() {
    document.querySelectorAll('[data-backup-owner]').forEach((el) => { el.textContent = this.owner(); });
  },

  setError(id, message) {
    $(`#${id}`).setAttribute('aria-invalid', String(Boolean(message)));
    $(`#${id}-error`).textContent = message;
  },

  clearExportErrors() {
    this.setError('export-passphrase', '');
    this.setError('export-passphrase-confirm', '');
  },

  /** Returns the first invalid passphrase field, or null. */
  validateExport() {
    this.clearExportErrors();
    if (!$('#export-encrypt').checked) return null;
    const pass = $('#export-passphrase');
    const confirm = $('#export-passphrase-confirm');
    if (pass.value.length < 8) {
      this.setError('export-passphrase', 'Use at least 8 characters.');
      return pass;
    }
    if (confirm.value !== pass.value) {
      this.setError('export-passphrase-confirm', 'The two passphrases do not match.');
      return confirm;
    }
    return null;
  },

  async exportData() {
    const invalid = this.validateExport();
    if (invalid) {
      invalid.focus();
      announce('Please fix the highlighted backup fields.');
      return;
    }
    const button = $('#btn-export');
    const label = button.textContent;
    const encrypted = $('#export-encrypt').checked;
    button.disabled = true;
    button.textContent = encrypted ? 'Encrypting…' : 'Preparing…';
    try {
      let file = BackupEngine.create({ data: exportUserData(), account: Storage.scope });
      if (encrypted) file = await BackupEngine.encrypt(file, $('#export-passphrase').value);
      const name = BackupEngine.fileName(file);
      this.download(name, BackupEngine.serialize(file));
      $('#export-passphrase').value = '';
      $('#export-passphrase-confirm').value = '';
      announce(`Downloaded ${name}${encrypted ? ', encrypted with your passphrase' : ''}. Keep it somewhere safe.`);
    } catch (error) {
      const message = error instanceof BackupError && error.code === 'unsupported'
        ? error.message
        : 'The backup could not be created. Try again, or try without encryption.';
      if (encrypted) {
        this.setError('export-passphrase', message);
        $('#export-passphrase').focus();
      }
      announce(message);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  },

  download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  resetImportErrors() {
    this.setError('import-file', '');
    this.setError('import-passphrase', '');
  },

  hideReview() {
    this.pending = null;
    $('#import-review').hidden = true;
  },

  /** Reads and pre-checks the chosen file so the passphrase field appears only when needed. */
  async readFile() {
    this.hideReview();
    this.resetImportErrors();
    this.file = null;
    const passField = $('#import-passphrase-field');
    passField.hidden = true;
    $('#import-passphrase').value = '';
    const chosen = $('#import-file').files[0];
    if (!chosen) return;
    try {
      this.file = BackupEngine.parse(await chosen.text());
      if (BackupEngine.isEncrypted(this.file)) {
        passField.hidden = false;
        announce('This backup is encrypted. Enter its passphrase, then choose Check backup.');
      }
    } catch (error) {
      this.file = { error };
    }
  },

  showImportError(fieldId, error) {
    const message = error instanceof BackupError ? error.message : 'This file could not be read as an Ube Café backup.';
    this.setError(fieldId, message);
    $(`#${fieldId}`).focus();
    announce(message);
  },

  async checkImport() {
    this.hideReview();
    this.resetImportErrors();
    if (!$('#import-file').files[0]) {
      this.setError('import-file', 'Choose a backup file first.');
      $('#import-file').focus();
      announce('Choose a backup file first.');
      return;
    }
    if (!this.file) await this.readFile();
    if (this.file.error) {
      this.showImportError('import-file', this.file.error);
      return;
    }

    const button = $('#btn-import-check');
    button.disabled = true;
    button.textContent = 'Checking…';
    try {
      let backup = this.file;
      if (BackupEngine.isEncrypted(backup)) {
        const pass = $('#import-passphrase');
        if (!pass.value) {
          this.setError('import-passphrase', 'Enter the passphrase used when this backup was made.');
          pass.focus();
          announce('Enter the backup passphrase.');
          return;
        }
        try {
          backup = await BackupEngine.decrypt(backup, pass.value);
        } catch (error) {
          if (error instanceof BackupError && error.code === 'wrong-passphrase') {
            this.showImportError('import-passphrase', error);
            pass.select();
          } else {
            this.showImportError('import-file', error);
          }
          return;
        }
      }
      this.pending = BackupEngine.prepareImport(backup);
      this.renderReview(this.pending.summary);
    } catch (error) {
      this.showImportError('import-file', error);
    } finally {
      button.disabled = false;
      button.textContent = 'Check backup';
    }
  },

  renderReview(summary) {
    const date = summary.exportedAt ? new Date(summary.exportedAt) : null;
    const when = date && !Number.isNaN(date.getTime())
      ? date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : 'an unknown date';
    const items = [
      `Made ${when}${summary.account ? ` by ${summary.account}` : ' as a guest'}`,
      summary.hasProfile ? 'Your profile and measurements' : 'No profile (defaults will be used)',
      plural(summary.recipes, 'recipe'),
      plural(summary.plannedMeals, 'planned meal'),
      plural(summary.supplements, 'supplement'),
      plural(summary.groceryChecked, 'checked grocery item'),
    ];
    if (summary.customFoods) items.push(plural(summary.customFoods, 'custom food'));
    if (summary.otherKeys.length) items.push(`Other saved data: ${summary.otherKeys.join(', ')}`);
    $('#import-summary').innerHTML = items.map((item) => `<li>${escapeHTML(item)}</li>`).join('');
    this.renderOwner();
    const review = $('#import-review');
    review.hidden = false;
    review.focus();
    announce(`Backup checked: ${plural(summary.recipes, 'recipe')} and ${plural(summary.plannedMeals, 'planned meal')}. Choose Replace my data to restore it, or Cancel.`);
  },

  async confirmImport() {
    if (!this.pending) return;
    const { data, summary } = this.pending;
    Storage.replaceScopeData(Storage.scope, data);
    this.hideReview();
    this.file = null;
    $('#import-form').reset();
    $('#import-passphrase-field').hidden = true;
    App.reloadUserData();
    await Storage.flush();
    $('#backup-heading').focus();
    announce(`Restored ${plural(summary.recipes, 'recipe')} and ${plural(summary.plannedMeals, 'planned meal')} into ${this.owner()}.`);
  },

  cancelImport() {
    this.hideReview();
    $('#import-file').focus();
    announce('Restore cancelled. Your data was not changed.');
  },
};
