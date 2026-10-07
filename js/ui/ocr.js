import { OcrEngine, cleanOcrText, hasReadableText } from '../engines/ocr.js';

const SUPPORTED_TYPE = /^image\/(?:jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;
// Some systems report an empty MIME type (often for HEIC), so fall back to the extension.
const SUPPORTED_NAME = /\.(?:jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;
export const isSupportedImage = (file) => SUPPORTED_TYPE.test(file.type) || (!file.type && SUPPORTED_NAME.test(file.name));
export const SAMPLE_PHOTO = 'assets/sample-recipe.png';

export const OCR_ERROR_MESSAGES = Object.freeze({
  type: 'That file is not a supported image. Choose a JPG, PNG or WebP photo.',
  decode: 'This browser could not open that image. HEIC photos only open in Safari; try exporting the photo as JPG or PNG.',
  load: 'Could not download the OCR engine. Photo scanning needs an internet connection the first time; you can still paste recipe text instead.',
  engine: 'The OCR engine stopped before finishing. If you are offline, connect and try again, or paste the recipe text instead.',
  empty: 'No readable text was found. Try a sharper, well-lit photo taken straight on, with the recipe filling the frame.',
  sample: 'Could not open the sample photo.',
});

/** Hint (HTML) shown under every photo drop zone. */
export const OCR_HINT_HTML = 'Text is read on your device by Tesseract.js in a background worker: your photo is never uploaded. '
  + 'The first scan downloads about 5&nbsp;MB of OCR engine and English language data from jsDelivr, which your browser then keeps. '
  + 'Clear, printed recipes in English work best.';

/**
 * Photo → text UI for one importer: drop zone, file input, sample photo, preview, progress,
 * cancel and plain-language errors around OcrEngine. Each instance owns its elements and its
 * scan state, so several importers on one page work independently.
 *
 *   new OcrController({ dropzone, fileInput, sample, cancel, progress, status, previewHost },
 *                     { onText, previewId })
 *
 * The preview <img> is created inside `previewHost` once a photo is chosen, so the markup
 * never holds an <img> without a src.
 */
export class OcrController {
  /**
   * @param {{ dropzone: HTMLElement, fileInput: HTMLInputElement, sample: HTMLButtonElement,
   *   cancel: HTMLButtonElement, progress: HTMLProgressElement, status: HTMLElement,
   *   previewHost: HTMLElement }} elements
   * @param {{ onText?: (text: string) => void, previewId?: string }} [options]
   *   onText receives the cleaned text after a successful scan; previewId is given to the preview <img>.
   */
  constructor(elements, { onText, previewId } = {}) {
    this.els = elements;
    this.onText = onText;
    this.previewId = previewId;
    this.abort = null;
    this.previewUrl = null;
    this.lastAnnounced = '';
    this.bind();
  }

  bind() {
    const { dropzone: zone, fileInput, sample, cancel } = this.els;
    // Custom drop zone: role="button" with Enter/Space keyboard activation, plus drag and drop.
    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('is-dragging');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('is-dragging');
      this.scan(e.dataTransfer?.files[0]);
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      // Reset so choosing the same photo again still fires "change".
      fileInput.value = '';
      this.scan(file);
    });
    sample.addEventListener('click', () => this.scanSample());
    cancel.addEventListener('click', () => this.cancel());
  }

  /** True while this controller has a scan running. */
  get busy() {
    return Boolean(this.abort);
  }

  setStatus(message) {
    this.els.status.textContent = message;
  }

  /** Shows progress on the bar continuously but only re-announces when the phase changes. */
  showProgress({ percent, label }) {
    const { progress } = this.els;
    progress.value = percent;
    progress.setAttribute('aria-valuetext', `${label}, ${percent}%`);
    if (label !== this.lastAnnounced) {
      this.lastAnnounced = label;
      this.setStatus(`${label}… ${percent}%`);
    }
  }

  setBusy(busy) {
    const { progress, cancel, sample } = this.els;
    progress.hidden = !busy;
    cancel.hidden = !busy;
    sample.disabled = busy;
    if (!busy) this.lastAnnounced = '';
  }

  showPreview(file) {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(file);
    let img = this.els.previewHost.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'ocr-preview';
      if (this.previewId) img.id = this.previewId;
      this.els.previewHost.append(img);
    }
    img.src = this.previewUrl;
    img.alt = `Uploaded recipe photo: ${file.name}`;
  }

  /** Stops the running scan (if any) and returns focus to the drop zone. */
  cancel() {
    if (!this.abort) return;
    this.abort.abort();
    this.els.dropzone.focus();
  }

  async scanSample() {
    let file;
    try {
      const res = await fetch(SAMPLE_PHOTO);
      if (!res.ok) throw new Error(String(res.status));
      file = new File([await res.blob()], 'sample-recipe.png', { type: 'image/png' });
    } catch {
      this.setStatus(OCR_ERROR_MESSAGES.sample);
      return;
    }
    await this.scan(file);
  }

  /**
   * Recognizes text in `file` on this device and hands the cleaned text to onText.
   * A new scan in this controller cancels any scan it still has running.
   */
  async scan(file) {
    if (!file) return;
    if (!isSupportedImage(file)) {
      this.setStatus(OCR_ERROR_MESSAGES.type);
      return;
    }
    this.abort?.abort();
    const controller = new AbortController();
    this.abort = controller;
    this.showPreview(file);
    this.setBusy(true);
    this.showProgress({ percent: 0, label: 'Preparing the photo' });

    try {
      const { text, confidence } = await OcrEngine.recognize(file, {
        signal: controller.signal,
        onProgress: (p) => { if (this.abort === controller) this.showProgress(p); },
      });
      if (this.abort !== controller) return;
      const cleaned = cleanOcrText(text);
      if (!hasReadableText(cleaned)) throw Object.assign(new Error('empty'), { code: 'empty' });
      this.setStatus(`Text read on this device (about ${Math.round(confidence)}% confidence). Check the raw text and the form below: OCR can misread amounts.`);
      this.onText?.(cleaned);
    } catch (err) {
      // A newer scan has taken over this controller; let it own the status.
      if (this.abort !== controller) return;
      this.setStatus(err?.name === 'AbortError'
        ? 'Scan cancelled.'
        : OCR_ERROR_MESSAGES[err?.code] ?? OCR_ERROR_MESSAGES.engine);
    } finally {
      if (this.abort === controller) {
        this.abort = null;
        this.setBusy(false);
      }
    }
  }
}
