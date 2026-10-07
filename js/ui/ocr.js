import { OcrEngine, cleanOcrText, hasReadableText } from '../engines/ocr.js';
import { $ } from '../util.js';

const SUPPORTED_TYPE = /^image\/(?:jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;
// Some systems report an empty MIME type (often for HEIC), so fall back to the extension.
const SUPPORTED_NAME = /\.(?:jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;
const isSupported = (file) => SUPPORTED_TYPE.test(file.type) || (!file.type && SUPPORTED_NAME.test(file.name));
const SAMPLE_PHOTO = 'assets/sample-recipe.png';

const ERROR_MESSAGES = {
  type: 'That file is not a supported image. Choose a JPG, PNG or WebP photo.',
  decode: 'This browser could not open that image. HEIC photos only open in Safari; try exporting the photo as JPG or PNG.',
  load: 'Could not download the OCR engine. Photo scanning needs an internet connection the first time; you can still paste recipe text instead.',
  engine: 'The OCR engine stopped before finishing. If you are offline, connect and try again, or paste the recipe text instead.',
  empty: 'No readable text was found. Try a sharper, well-lit photo taken straight on, with the recipe filling the frame.',
};

/** Photo → text UI: preview, progress, cancel and error handling around OcrEngine. */
export const OcrUI = {
  controller: null,
  previewUrl: null,
  lastAnnounced: '',
  onText: null,

  /** @param {(text: string) => void} onText receives cleaned text after a successful scan. */
  init(onText) {
    this.onText = onText;
    $('#ocr-cancel').addEventListener('click', () => this.cancel());
    $('#ocr-sample').addEventListener('click', () => this.scanSample());
  },

  setStatus(message) {
    $('#ocr-status').textContent = message;
  },

  /** Shows progress on the bar continuously but only re-announces when the phase changes. */
  showProgress({ percent, label }) {
    const progress = $('#ocr-progress');
    progress.value = percent;
    progress.setAttribute('aria-valuetext', `${label}, ${percent}%`);
    if (label !== this.lastAnnounced) {
      this.lastAnnounced = label;
      this.setStatus(`${label}… ${percent}%`);
    }
  },

  setBusy(busy) {
    $('#ocr-progress').hidden = !busy;
    $('#ocr-cancel').hidden = !busy;
    $('#ocr-sample').disabled = busy;
    if (!busy) this.lastAnnounced = '';
  },

  showPreview(file, name) {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(file);
    const preview = $('#ocr-preview');
    preview.src = this.previewUrl;
    preview.alt = `Uploaded recipe photo: ${name}`;
    preview.hidden = false;
  },

  cancel() {
    if (!this.controller) return;
    this.controller.abort();
    $('#ocr-dropzone').focus();
  },

  async scanSample() {
    try {
      const res = await fetch(SAMPLE_PHOTO);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      await this.scan(new File([blob], 'sample-recipe.png', { type: 'image/png' }));
    } catch {
      this.setStatus('Could not open the sample photo.');
    }
  },

  /**
   * Recognizes text in `file` on this device and hands the cleaned text to the init callback.
   * A new scan cancels any scan still running.
   */
  async scan(file) {
    if (!file) return;
    if (!isSupported(file)) {
      this.setStatus(ERROR_MESSAGES.type);
      return;
    }
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.showPreview(file, file.name);
    this.setBusy(true);
    this.showProgress({ percent: 0, label: 'Preparing the photo' });

    try {
      const { text, confidence } = await OcrEngine.recognize(file, {
        signal: controller.signal,
        onProgress: (p) => this.showProgress(p),
      });
      const cleaned = cleanOcrText(text);
      if (!hasReadableText(cleaned)) throw Object.assign(new Error('empty'), { code: 'empty' });
      this.onText?.(cleaned);
      this.setStatus(`Text read on this device (about ${Math.round(confidence)}% confidence). Check the raw text and the form below: OCR can misread amounts.`);
    } catch (err) {
      if (err?.name === 'AbortError') {
        if (this.controller === controller) this.setStatus('Scan cancelled.');
        return;
      }
      this.setStatus(ERROR_MESSAGES[err?.code] ?? ERROR_MESSAGES.engine);
    } finally {
      if (this.controller === controller) {
        this.controller = null;
        this.setBusy(false);
      }
    }
  },
};
