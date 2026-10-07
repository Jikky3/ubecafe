// End-to-end check of photo OCR in headless Chromium: real Tesseract.js recognition of rendered recipe images.
//
//   CHROMIUM_PATH=/path/to/chrome node tools/ocr-check.js
//
// By default the browser downloads Tesseract.js from cdn.jsdelivr.net exactly as users do.
// Where that CDN is blocked, set OCR_PACKAGES_DIR to a folder holding the unpacked npm tarballs
// (`npm pack tesseract.js@5.1.1 tesseract.js-core@5.1.1 @tesseract.js-data/eng@1.0.0`, each extracted
// into tesseract.js/, tesseract.js-core/ and eng/). jsDelivr's /npm/ URLs serve those same files,
// so requests to the CDN are answered from disk instead; nothing else changes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { server } from './serve.js';
import { OCR_SOURCES } from '../js/engines/ocr.js';

const packagesDir = process.env.OCR_PACKAGES_DIR;
const CDN_PREFIXES = {
  [OCR_SOURCES.script.replace(/dist\/.*$/, '')]: 'tesseract.js/package/',
  [`${OCR_SOURCES.corePath}/`]: 'tesseract.js-core/package/',
  [`${OCR_SOURCES.langPath.replace(/4\.0\.0_best_int$/, '')}`]: 'eng/package/',
};

async function serveCdnFromDisk(route) {
  const url = route.request().url();
  const prefix = Object.keys(CDN_PREFIXES).find((p) => url.startsWith(p));
  if (!prefix) return route.abort();
  const file = path.join(packagesDir, CDN_PREFIXES[prefix], url.slice(prefix.length));
  const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
  try {
    return route.fulfill({ body: await fs.readFile(file), contentType: type, headers: { 'access-control-allow-origin': '*' } });
  } catch {
    return route.fulfill({ status: 404, body: 'not found', headers: { 'access-control-allow-origin': '*' } });
  }
}

const RECIPE_HTML = `<!doctype html><meta charset="utf-8">
<style>body{margin:0;background:#fff;font:26px/1.5 "DejaVu Sans",sans-serif;color:#111}
.c{padding:40px 56px;width:900px}h1{font-size:40px;margin:0 0 6px}h2{font-size:28px;margin:24px 0 6px}</style>
<div class="c"><h1>Lentil Spinach Soup</h1><p>Serves: 4</p><h2>Ingredients:</h2>
<p>• 1 cup dry lentils</p><p>• 200 g spinach</p><p>• 1 onion</p><p>• 2 cloves garlic</p><p>• 1 tbsp olive oil</p>
<h2>Directions</h2><p>1. Saute the onion and garlic in the oil.</p><p>2. Add lentils and 4 cups water; simmer 25 minutes.</p>
<p>3. Stir in the spinach until wilted.</p></div>`;

await new Promise((resolve) => server.listen(0, resolve));
const appUrl = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function openApp({ offline = false } = {}) {
  const context = await browser.newContext();
  const cdnRequests = [];
  const errors = [];
  if (offline) await context.route('https://cdn.jsdelivr.net/**', (route) => route.abort('internetdisconnected'));
  else if (packagesDir) await context.route('https://cdn.jsdelivr.net/**', serveCdnFromDisk);
  // Everything except the app itself, blob: workers and the page's existing Google Fonts stylesheet.
  const ignored = /^(?:blob:|https:\/\/fonts\.(?:googleapis|gstatic)\.com\/)/;
  context.on('request', (req) => { if (!req.url().startsWith(appUrl) && !ignored.test(req.url())) cdnRequests.push(req); });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  return { context, page, errors, cdnRequests };
}

const ingredientLines = (page) => page.locator('#recipe-ingredients').inputValue().then((v) => v.split('\n').filter(Boolean));
// A scan is finished once the status no longer shows an in-progress "Label… N%" message.
const waitIdle = (page, timeout = 180_000) => page.waitForFunction(
  () => !/…/.test(document.querySelector('#ocr-status').textContent) && document.querySelector('#ocr-progress').hidden,
  null, { timeout },
);

// 1. Sample photo button → real OCR → parsed form.
{
  const { context, page, errors, cdnRequests } = await openApp();
  check('no CDN traffic before a photo is chosen', cdnRequests.length === 0, cdnRequests.map((r) => r.url()).join(', '));
  await page.click('#ocr-sample');
  await page.locator('#ocr-cancel').waitFor({ state: 'visible' });
  await waitIdle(page);
  const title = await page.locator('#recipe-title').inputValue();
  const servings = await page.locator('#recipe-servings').inputValue();
  const ingredients = await ingredientLines(page);
  const steps = (await page.locator('#recipe-instructions').inputValue()).split('\n').filter(Boolean);
  const status = await page.locator('#ocr-status').textContent();
  check('sample: title read', /kale\s*&\s*chickpea power salad/i.test(title), title);
  check('sample: servings read', servings === '2', servings);
  check('sample: 7 ingredients', ingredients.length === 7, ingredients.join(' | '));
  check('sample: 3 steps (wrapped step re-joined)', steps.length === 3, steps.join(' | '));
  check('sample: success status', /read on this device/i.test(status), status);
  const uploads = cdnRequests.filter((r) => r.method() !== 'GET' || r.postData());
  check('sample: no image upload (only GETs)', uploads.length === 0, uploads.map((r) => r.url()).join(', '));
  check('sample: only pinned jsDelivr files fetched', cdnRequests.every((r) => /^https:\/\/cdn\.jsdelivr\.net\/npm\/(?:tesseract\.js@5\.1\.1|tesseract\.js-core@5\.1\.1|@tesseract\.js-data\/eng@1\.0\.0)\//.test(r.url())),
    cdnRequests.map((r) => r.url()).join('\n'));
  console.log('Sample raw text:\n' + await page.locator('#raw-recipe').inputValue());

  // 2. A different, large (downscaled) image picked through the file input.
  const shot = await context.newPage();
  await shot.setViewportSize({ width: 1000, height: 900 });
  await shot.setContent(RECIPE_HTML);
  const small = await shot.locator('.c').screenshot();
  await shot.setViewportSize({ width: 1000, height: 900 });
  const big = await (async () => {
    // Re-render at 4× device scale to get a ~4000 px-wide image that must be downscaled.
    const hi = await browser.newPage({ deviceScaleFactor: 4 });
    await hi.setContent(RECIPE_HTML);
    const buf = await hi.locator('.c').screenshot();
    await hi.close();
    return buf;
  })();
  await shot.close();
  await page.setInputFiles('#ocr-file', { name: 'soup.png', mimeType: 'image/png', buffer: big });
  await waitIdle(page);
  check('upload: title read', /lentil spinach soup/i.test(await page.locator('#recipe-title').inputValue()), await page.locator('#recipe-title').inputValue());
  check('upload: servings read', (await page.locator('#recipe-servings').inputValue()) === '4');
  const soup = await ingredientLines(page);
  check('upload: 5 ingredients', soup.length === 5, soup.join(' | '));
  const analysis = await page.locator('#analysis-output').textContent();
  check('upload: analysis rendered', /per serving/i.test(analysis));
  check('upload (large image downscaled) has preview', await page.locator('#ocr-preview').isVisible());

  // 3. Unsupported file.
  await page.setInputFiles('#ocr-file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  check('unsupported file message', /not a supported image/i.test(await page.locator('#ocr-status').textContent()));

  // 4. Blank image → empty result message.
  const blank = await (async () => {
    const p = await browser.newPage({ viewport: { width: 400, height: 300 } });
    await p.setContent('<body style="margin:0;background:#fff"></body>');
    const buf = await p.screenshot();
    await p.close();
    return buf;
  })();
  await page.setInputFiles('#ocr-file', { name: 'blank.png', mimeType: 'image/png', buffer: blank });
  await waitIdle(page);
  check('empty result message', /no readable text/i.test(await page.locator('#ocr-status').textContent()), await page.locator('#ocr-status').textContent());

  // 5. Cancel mid-scan.
  await page.setInputFiles('#ocr-file', { name: 'soup2.png', mimeType: 'image/png', buffer: small });
  await page.locator('#ocr-cancel').waitFor({ state: 'visible' });
  await page.click('#ocr-cancel');
  await waitIdle(page, 5000);
  check('cancel: status', (await page.locator('#ocr-status').textContent()) === 'Scan cancelled.');
  check('cancel: focus back on drop zone', await page.evaluate(() => document.activeElement?.id === 'ocr-dropzone'));

  check('no console errors in normal use', errors.length === 0, errors.join('\n'));
  await context.close();
}

// 6. Offline: library download fails → clear message, retry possible.
{
  const { context, page } = await openApp({ offline: true });
  await page.click('#ocr-sample');
  await waitIdle(page, 30_000);
  check('offline: load error message', /could not download the ocr engine/i.test(await page.locator('#ocr-status').textContent()),
    await page.locator('#ocr-status').textContent());
  await context.close();
}

await browser.close();
server.close();

results.forEach(({ name, ok, detail }) => console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `\n     ${detail}`}`));
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} OCR checks passed${packagesDir ? ' (CDN served from OCR_PACKAGES_DIR)' : ''}.`);
process.exit(failed ? 1 : 0);
