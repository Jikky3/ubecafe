// End-to-end check of photo OCR in headless Chromium: real Tesseract.js recognition of rendered recipe images.
// Signs up and onboards first (tools/flows.js), then scans in the Recipe Library importer ('lib-' ids)
// and, on a separate page stopped at onboarding step 4, in the wizard's importer ('ob-' ids).
//
//   CHROMIUM_PATH=/path/to/chrome node tools/ocr-check.js
//
// By default the browser downloads Tesseract.js from cdn.jsdelivr.net exactly as users do.
// Where that CDN is blocked, set OCR_PACKAGES_DIR to a folder holding the unpacked npm tarballs
// (`npm pack tesseract.js@5.1.1 tesseract.js-core@5.1.1 @tesseract.js-data/eng@1.0.0`, each extracted
// into tesseract.js/, tesseract.js-core/ and eng/). jsDelivr's /npm/ URLs serve those same files,
// so requests to the CDN are answered from disk instead; nothing else changes.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { openTab, signUpAndOnboard } from './flows.js';
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

// Readable text with no "Ingredients" heading: the importer should keep it in the raw box for editing.
const NOTE_HTML = `<!doctype html><meta charset="utf-8">
<style>body{margin:0;background:#fff;font:30px/1.5 "DejaVu Sans",sans-serif;color:#111}.c{padding:40px 56px;width:900px}</style>
<div class="c"><p>Shopping note for the weekend</p><p>Remember apples, pears and fresh bread</p><p>Call the bakery before noon</p></div>`;

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

/** Signs up, onboards and opens the Recipe Library tab, whose importer uses the 'lib' id prefix. */
async function openLibrary(page) {
  await signUpAndOnboard(page);
  await openTab(page, 'tab-recipes');
}

const $id = (prefix, name) => `#${prefix}-${name}`;
const ingredientLines = (page, p) => page.locator($id(p, 'ingredients')).inputValue().then((v) => v.split('\n').filter(Boolean));
const statusText = (page, p) => page.locator($id(p, 'status')).textContent();
// A scan is finished once the status no longer shows an in-progress "Label… N%" message.
const waitIdle = (page, p, timeout = 180_000) => page.waitForFunction(
  (prefix) => !/…/.test(document.getElementById(`${prefix}-status`).textContent)
    && document.getElementById(`${prefix}-progress`).hidden,
  p, { timeout },
);
const screenshotOf = async (html, { scale = 1 } = {}) => {
  const pg = await browser.newPage({ deviceScaleFactor: scale, viewport: { width: 1000, height: 900 } });
  await pg.setContent(html);
  const buf = await pg.locator('.c').screenshot();
  await pg.close();
  return buf;
};

/** Checks that the bundled sample photo was read into importer `p`'s form. */
async function checkSample(page, p, label) {
  const title = await page.locator($id(p, 'title')).inputValue();
  const servings = await page.locator($id(p, 'servings')).inputValue();
  const ingredients = await ingredientLines(page, p);
  const steps = (await page.locator($id(p, 'instructions')).inputValue()).split('\n').filter(Boolean);
  const status = await statusText(page, p);
  check(`${label}: title read`, /kale\s*&\s*chickpea power salad/i.test(title), title);
  check(`${label}: servings read`, servings === '2', servings);
  check(`${label}: 7 ingredients`, ingredients.length === 7, ingredients.join(' | '));
  check(`${label}: 3 steps (wrapped step re-joined)`, steps.length === 3, steps.join(' | '));
  check(`${label}: success status`, /read on this device/i.test(status), status);
  check(`${label}: preview shown`, await page.locator($id(p, 'preview')).isVisible());
  check(`${label}: analysis rendered`, /per serving/i.test(await page.locator($id(p, 'analysis')).textContent()));
}

const AXE_PATH = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
/** Serious/critical WCAG 2.1 A/AA violations axe-core finds in the page's current state. */
const axeViolations = async (page) => {
  if (!await page.evaluate(() => 'axe' in window)) await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const { violations } = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'],
    });
    return violations.filter((v) => ['serious', 'critical'].includes(v.impact))
      .map((v) => `${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`);
  });
};

const PINNED_CDN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/(?:tesseract\.js@5\.1\.1|tesseract\.js-core@5\.1\.1|@tesseract\.js-data\/eng@1\.0\.0)\//;

// 1–6. Recipe Library importer, after sign-up and onboarding.
{
  const { context, page, errors, cdnRequests } = await openApp();
  await openLibrary(page);
  const p = 'lib';
  check('library: no CDN traffic before a photo is chosen', cdnRequests.length === 0, cdnRequests.map((r) => r.url()).join(', '));
  check('library: no preview <img> before a photo is chosen', (await page.locator($id(p, 'preview')).count()) === 0);

  // Keyboard activation of the drop zone opens the file picker.
  await page.focus($id(p, 'dropzone'));
  const [enterChooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.keyboard.press('Enter')]);
  check('library: Enter on the drop zone opens the file picker', Boolean(enterChooser));
  const [spaceChooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.keyboard.press(' ')]);
  check('library: Space on the drop zone opens the file picker', Boolean(spaceChooser));

  // 1. Sample photo button → real OCR → parsed form.
  await page.click($id(p, 'sample'));
  await page.locator($id(p, 'ocr-cancel')).waitFor({ state: 'visible' });
  await waitIdle(page, p);
  await checkSample(page, p, 'library sample');
  const uploads = cdnRequests.filter((r) => r.method() !== 'GET' || r.postData());
  check('library sample: no image upload (only GETs)', uploads.length === 0, uploads.map((r) => r.url()).join(', '));
  check('library sample: only pinned jsDelivr files fetched', cdnRequests.every((r) => PINNED_CDN.test(r.url())),
    cdnRequests.map((r) => r.url()).join('\n'));
  const afterScan = await axeViolations(page);
  check('library sample: no axe violations after a scan', afterScan.length === 0, afterScan.join('\n'));
  check('library sample: onboarding importer untouched', (await statusText(page, 'ob')) === ''
    && (await page.locator($id('ob', 'preview')).count()) === 0
    && (await page.locator($id('ob', 'raw')).inputValue()) === '');
  console.log(`Sample raw text:\n${await page.locator($id(p, 'raw')).inputValue()}`);

  // 2. A different, large image (~4000 px wide, must be downscaled) picked through the file input.
  const big = await screenshotOf(RECIPE_HTML, { scale: 4 });
  await page.setInputFiles($id(p, 'file'), { name: 'soup.png', mimeType: 'image/png', buffer: big });
  await waitIdle(page, p);
  const soupTitle = await page.locator($id(p, 'title')).inputValue();
  check('upload: title read', /lentil spinach soup/i.test(soupTitle), soupTitle);
  check('upload: servings read', (await page.locator($id(p, 'servings')).inputValue()) === '4');
  const soup = await ingredientLines(page, p);
  check('upload: 5 ingredients', soup.length === 5, soup.join(' | '));
  check('upload: analysis rendered', /per serving/i.test(await page.locator($id(p, 'analysis')).textContent()));
  check('upload (large image downscaled): preview shows the new photo',
    await page.locator($id(p, 'preview')).evaluate((img) => img.alt.includes('soup.png') && img.src.startsWith('blob:')));

  // 3. Drag and drop onto the drop zone; text without an "Ingredients" heading stays in the raw box.
  const note = await screenshotOf(NOTE_HTML);
  const dataTransfer = await page.evaluateHandle((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'note.png', { type: 'image/png' }));
    return dt;
  }, note.toString('base64'));
  await page.dispatchEvent($id(p, 'dropzone'), 'drop', { dataTransfer });
  await page.locator($id(p, 'ocr-cancel')).waitFor({ state: 'visible' });
  await waitIdle(page, p);
  const noteRaw = await page.locator($id(p, 'raw')).inputValue();
  check('drop: text read into the raw box', /shopping note/i.test(noteRaw), noteRaw);
  check('drop: no heading → raw box focused for editing', await page.evaluate(() => document.activeElement?.id === 'lib-raw'));
  check('drop: form left as it was', /lentil spinach soup/i.test(await page.locator($id(p, 'title')).inputValue()));

  // 4. Unsupported file.
  await page.setInputFiles($id(p, 'file'), { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  check('unsupported file message', /not a supported image/i.test(await statusText(page, p)));

  // 5. Blank image → empty result message.
  const blank = await (async () => {
    const pg = await browser.newPage({ viewport: { width: 400, height: 300 } });
    await pg.setContent('<body style="margin:0;background:#fff"></body>');
    const buf = await pg.screenshot();
    await pg.close();
    return buf;
  })();
  await page.setInputFiles($id(p, 'file'), { name: 'blank.png', mimeType: 'image/png', buffer: blank });
  await waitIdle(page, p);
  check('empty result message', /no readable text/i.test(await statusText(page, p)), await statusText(page, p));

  // 6. Cancel mid-scan.
  const small = await screenshotOf(RECIPE_HTML);
  await page.setInputFiles($id(p, 'file'), { name: 'soup2.png', mimeType: 'image/png', buffer: small });
  await page.locator($id(p, 'ocr-cancel')).waitFor({ state: 'visible' });
  await page.click($id(p, 'ocr-cancel'));
  await waitIdle(page, p, 5000);
  check('cancel: status', (await statusText(page, p)) === 'Scan cancelled.');
  check('cancel: focus back on drop zone', await page.evaluate(() => document.activeElement?.id === 'lib-dropzone'));
  check('cancel: sample button enabled again', await page.locator($id(p, 'sample')).isEnabled());

  check('library: no console errors in normal use', errors.length === 0, errors.join('\n'));
  await context.close();
}

// 7. Onboarding wizard step 4 importer ('ob' prefix), on its own page.
{
  const { context, page, errors } = await openApp();
  await signUpAndOnboard(page, { stopAtStep: 4 });
  const p = 'ob';
  check('onboarding: importer shown at step 4', await page.locator($id(p, 'dropzone')).isVisible());
  await page.click($id(p, 'sample'));
  await page.locator($id(p, 'ocr-cancel')).waitFor({ state: 'visible' });
  const midScan = await axeViolations(page);
  check('onboarding: no axe violations mid-scan', midScan.length === 0, midScan.join('\n'));
  check('onboarding: library importer stays idle while scanning', (await statusText(page, 'lib')) === ''
    && await page.locator($id('lib', 'progress')).evaluate((el) => el.hidden));
  await waitIdle(page, p);
  await checkSample(page, p, 'onboarding sample');
  check('onboarding: library importer untouched', (await page.locator($id('lib', 'raw')).inputValue()) === ''
    && (await page.locator($id('lib', 'preview')).count()) === 0);
  check('onboarding: no console errors', errors.length === 0, errors.join('\n'));
  await context.close();
}

// 8. Offline: library download fails → clear message, retry possible.
{
  const { context, page } = await openApp({ offline: true });
  await openLibrary(page);
  await page.click('#lib-sample');
  await waitIdle(page, 'lib', 30_000);
  check('offline: load error message', /could not download the ocr engine/i.test(await statusText(page, 'lib')),
    await statusText(page, 'lib'));
  check('offline: sample button enabled again for a retry', await page.locator('#lib-sample').isEnabled());
  await context.close();
}

await browser.close();
server.close();

results.forEach(({ name, ok, detail }) => console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `\n     ${detail}`}`));
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} OCR checks passed${packagesDir ? ' (CDN served from OCR_PACKAGES_DIR)' : ''}.`);
process.exit(failed ? 1 : 0);
