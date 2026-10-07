import { UNIT_LOOKUP } from '../data/foods.js';

/**
 * In-browser photo OCR built on Tesseract.js.
 *
 * Privacy model: the image is decoded, downscaled and recognized entirely on this device,
 * inside a Web Worker. The only network traffic is a one-time download of the library,
 * its WebAssembly core and the English language data from jsDelivr (exact pinned versions);
 * the image itself is never uploaded anywhere.
 *
 * The pure helpers (text cleanup, scaling math, progress mapping) have no DOM dependencies,
 * so they can be unit-tested in Node. Only `loadLibrary` and `recognize` need a browser.
 */

const TESSERACT_VERSION = '5.1.1';
const CORE_VERSION = '5.1.1';
const CDN = 'https://cdn.jsdelivr.net/npm';

export const OCR_SOURCES = Object.freeze({
  script: `${CDN}/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`,
  // Subresource Integrity hash of the file above, as published to npm (jsDelivr serves it byte-for-byte).
  integrity: 'sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F',
  workerPath: `${CDN}/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`,
  // A directory: Tesseract picks the SIMD or plain LSTM-only build for this device.
  corePath: `${CDN}/tesseract.js-core@${CORE_VERSION}`,
  // Integer-quantized "best" English model (~3 MB gzipped).
  langPath: `${CDN}/@tesseract.js-data/eng@1.0.0/4.0.0_best_int`,
});

/** Longest image side (px) and total pixel budget passed to the recognizer. */
export const MAX_SIDE = 2400;
export const MAX_PIXELS = 4_000_000;

/** Scale factor (never above 1) that fits width × height inside both limits. */
export function fitWithin(width, height, maxSide = MAX_SIDE, maxPixels = MAX_PIXELS) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0) || !(h > 0)) return { width: 0, height: 0, scale: 0 };
  const scale = Math.min(1, maxSide / Math.max(w, h), Math.sqrt(maxPixels / (w * h)));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    scale,
  };
}

/**
 * Tesseract logger phases in the order they occur, mapped onto one 0–100 bar.
 * Downloads only report start/end, so their slices are wide; recognition reports finely.
 */
const PHASES = [
  ['loading tesseract core', 5, 35, 'Downloading the OCR engine'],
  ['initializing tesseract', 35, 40, 'Starting the OCR engine'],
  ['loading language traineddata', 40, 70, 'Loading English language data'],
  ['initializing api', 70, 75, 'Preparing to read'],
  ['recognizing text', 75, 100, 'Reading text'],
];

/** Converts a Tesseract logger message into { percent, label }, or null for unknown statuses. */
export function overallProgress(status, progress) {
  const phase = PHASES.find(([name]) => String(status ?? '').startsWith(name));
  if (!phase) return null;
  const [, start, end, label] = phase;
  const p = Math.min(1, Math.max(0, Number(progress) || 0));
  return { percent: Math.round(start + (end - start) * p), label };
}

const LIGATURES = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'ft', 'ﬆ': 'st' };
const UNIT_WORDS = Object.keys(UNIT_LOOKUP).join('|');
// Symbols OCR commonly produces for printed bullets (•, ▪, ☐ …); normalized to "- ".
const BULLET_SYMBOLS = /^[•·●▪■□◦○°©®¢»«>+*~✓✔☐❏➤►‣⁃]+\s*/;
// Bullets misread as a lone "e"/"o"/"c" — only stripped when an amount follows ("e 2 cups oats").
const LETTER_BULLET = /^[eoc]\s+(?=[\d½⅓⅔¼¾⅛])/;
// A lone l / I / | / ! read in place of the digit 1 before a unit or fraction ("l cup", "I 1/2 tsp").
const MISREAD_ONE = new RegExp(String.raw`^(- )?[lI|!](?=\s+(?:\d+\/\d+\s+)?(?:${UNIT_WORDS})\b\.?|\s*\/\s*\d)`, 'i');
const STEP_START = /^(?:\d+\s*[.):]|[-–*]\s|step\s*\d+)/i;

const HEADINGS = [
  [/^(?:for the |main )?ingredients?$|^you(?:'ll| will) need$|^what you need$/i, 'Ingredients:'],
  [/^(?:instructions?|directions?|method|steps|preparation|how to make(?: it)?)$/i, 'Instructions:'],
];

/** Returns the canonical heading ("Ingredients:" / "Instructions:") a noisy OCR line stands for, if any. */
export function canonicalHeading(line) {
  const core = line.replace(/^[^a-z]+|[^a-z]+$/gi, '').replace(/\s+/g, ' ').replace(/’/g, "'");
  const hit = HEADINGS.find(([pattern]) => pattern.test(core));
  return hit ? hit[1] : null;
}

/** Character-level fixes that are safe anywhere in OCR output. */
function normalizeChars(text) {
  return text
    .replace(/[ﬀ-ﬆ]/g, (ch) => LIGATURES[ch] ?? ch)
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[—‒−]/g, '-')
    .replace(/⁄/g, '/')
    .replace(/[  -​ 　\t]/g, ' ');
}

/** Cleans one line: trims noise, normalizes bullets and fixes obvious digit misreads in amounts. */
function cleanLine(raw) {
  let line = raw.replace(/\s+/g, ' ').trim();
  // Edge noise from page borders and shadows ("| 2 eggs", "_ Method").
  line = line.replace(/^[|_~`'",.:;]+\s*/, '').replace(/\s*[|_~`]+$/, '');
  line = line.replace(BULLET_SYMBOLS, '- ').replace(LETTER_BULLET, '- ');
  line = line.replace(MISREAD_ONE, (_, dash = '') => `${dash}1`);
  // "1 / 2 cup" → "1/2 cup"; "1O0 g" → "100 g".
  line = line.replace(/(\d)\s*\/\s*(\d)/g, '$1/$2').replace(/(\d)[Oo](?=\d)/g, '$10');
  return line.trim();
}

const alnumCount = (line) => (line.match(/[a-z0-9½⅓⅔¼¾⅛]/gi) ?? []).length;

/** True when `line` continues the previous one rather than starting a new item. */
function isContinuation(prev, line, section) {
  if (!prev || canonicalHeading(prev) || STEP_START.test(line) || /^[\d½⅓⅔¼¾⅛]/.test(line)) return false;
  if (/[a-z]-$/.test(prev) && /^[a-z]/.test(line)) return true; // hyphenated word break
  if (section === 'instructions') return !/[.!?:]$/.test(prev);
  if (section === 'ingredients') return /^[a-z(]/.test(line) && /(?:[,(/&+]|\b(?:and|or|of|to|with|for))$/i.test(prev);
  return false;
}

/**
 * Tidies raw Tesseract output so RecipeParser.parseRecipeText can read it: normalizes characters,
 * drops noise-only lines, turns heading variants into "Ingredients:" / "Instructions:", and
 * re-joins items that wrapped onto several lines in the photo.
 */
export function cleanOcrText(text) {
  const out = [];
  let section = null;
  normalizeChars(String(text ?? '')).split(/\r?\n/).forEach((raw) => {
    const line = cleanLine(raw);
    if (alnumCount(line) < 2) return;
    const heading = canonicalHeading(line);
    if (heading) {
      section = heading === 'Ingredients:' ? 'ingredients' : 'instructions';
      out.push(heading);
      return;
    }
    const prev = out[out.length - 1];
    if (isContinuation(prev, line, section)) {
      out[out.length - 1] = /[a-z]-$/.test(prev) && /^[a-z]/.test(line)
        ? `${prev.slice(0, -1)}${line}`
        : `${prev} ${line}`;
      return;
    }
    out.push(line);
  });
  return out.join('\n');
}

/** True when cleaned text holds at least a few real words. */
export function hasReadableText(text) {
  return (String(text).match(/[a-z]{3,}/gi) ?? []).length >= 3;
}

/** Error with a `code` the UI turns into a plain-language message. */
export class OcrError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OcrError';
    this.code = code;
  }
}

export class OcrEngine {
  static #library = null;

  /** Injects the pinned Tesseract.js script once, on first use. Retries after a failed load. */
  static loadLibrary() {
    if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
    if (this.#library) return this.#library;
    this.#library = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = OCR_SOURCES.script;
      script.integrity = OCR_SOURCES.integrity;
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => (window.Tesseract?.createWorker
        ? resolve(window.Tesseract)
        : reject(new OcrError('load', 'Tesseract.js loaded without its API.')));
      script.onerror = () => {
        script.remove();
        reject(new OcrError('load', 'Could not download Tesseract.js.'));
      };
      document.head.append(script);
    }).catch((err) => {
      this.#library = null;
      throw err;
    });
    return this.#library;
  }

  /** Decodes an image file and draws it on a canvas no larger than MAX_SIDE / MAX_PIXELS. */
  static async prepareImage(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new OcrError('decode', `Could not decode ${file.type || 'this file'}.`);
    }
    const { width, height, scale } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    // White backdrop so transparent PNGs/screenshots don't become black-on-black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return { canvas, scale };
  }

  /**
   * Recognizes English text in an image file on this device.
   * @param {Blob} file
   * @param {{ onProgress?: (p: {percent: number, label: string}) => void, signal?: AbortSignal }} options
   * @returns {Promise<{ text: string, confidence: number, scale: number }>}
   */
  static async recognize(file, { onProgress = () => {}, signal } = {}) {
    const abortError = () => new DOMException('OCR cancelled', 'AbortError');
    if (signal?.aborted) throw abortError();
    onProgress({ percent: 0, label: 'Preparing the photo' });
    const { canvas, scale } = await this.prepareImage(file);
    if (signal?.aborted) throw abortError();
    onProgress({ percent: 2, label: 'Loading the OCR library' });
    const Tesseract = await this.loadLibrary();
    if (signal?.aborted) throw abortError();

    let worker = null;
    let failWorker;
    // Tesseract reports some setup failures (e.g. language data unreachable) only via errorHandler.
    const workerFailed = new Promise((_, reject) => { failWorker = reject; });
    const aborted = new Promise((_, reject) => {
      signal?.addEventListener('abort', () => {
        worker?.terminate();
        reject(abortError());
      }, { once: true });
    });

    const work = (async () => {
      worker = await Tesseract.createWorker('eng', Tesseract.OEM?.LSTM_ONLY ?? 1, {
        workerPath: OCR_SOURCES.workerPath,
        corePath: OCR_SOURCES.corePath,
        langPath: OCR_SOURCES.langPath,
        logger: (m) => {
          const p = overallProgress(m.status, m.progress);
          if (p && !signal?.aborted) onProgress(p);
        },
        errorHandler: (message) => failWorker(new OcrError('engine', String(message))),
      });
      if (signal?.aborted) throw abortError();
      const { data } = await worker.recognize(canvas);
      return { text: data.text ?? '', confidence: data.confidence ?? 0, scale };
    })();

    const cleanup = () => { worker?.terminate(); };
    work.then(cleanup, cleanup);
    workerFailed.catch(() => {});
    aborted.catch(() => {});
    try {
      return await Promise.race([work, workerFailed, aborted]);
    } catch (err) {
      if (err?.name === 'AbortError' || err instanceof OcrError) throw err;
      throw new OcrError('engine', String(err?.message ?? err));
    }
  }
}
