// Renders the "Try a sample photo" recipe card to assets/sample-recipe.png with headless Chromium.
// Run: CHROMIUM_PATH=/path/to/chrome node tools/make-ocr-sample.js
// The card is deliberately photo-like (no "Title:" line, bullets, a wrapped step) so OCR cleanup is exercised.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const out = path.resolve(import.meta.dirname, '..', 'assets', 'sample-recipe.png');

export const SAMPLE_CARD_HTML = `<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; background: #e9e4da; }
  .card { width: 640px; margin: 24px; padding: 32px 40px; background: #fffdf8; color: #222;
    font: 22px/1.45 Georgia, "DejaVu Serif", serif; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
  h1 { font-size: 34px; margin: 0 0 4px; }
  h2 { font-size: 20px; letter-spacing: .12em; text-transform: uppercase; margin: 22px 0 6px; }
  p { margin: 0; } ul, ol { margin: 0; padding-left: 28px; }
</style>
<div class="card">
  <h1>Kale &amp; Chickpea Power Salad</h1>
  <p>Serves 2</p>
  <h2>Ingredients</h2>
  <ul>
    <li>3 cups kale</li>
    <li>1 can chickpeas, drained</li>
    <li>1/2 cup quinoa</li>
    <li>1 red bell pepper</li>
    <li>2 tbsp olive oil</li>
    <li>1 lemon</li>
    <li>2 tbsp pumpkin seeds</li>
  </ul>
  <h2>Method</h2>
  <ol>
    <li>Cook the quinoa and let it cool.</li>
    <li>Massage the kale with the oil and the juice of the lemon until it softens.</li>
    <li>Toss with the chickpeas, pepper, quinoa and seeds.</li>
  </ol>
</div>`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 720, height: 900 } });
  await page.setContent(SAMPLE_CARD_HTML);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await page.locator('.card').screenshot({ path: out });
  await browser.close();
  console.log(`Wrote ${path.relative(process.cwd(), out)}`);
}
