// Loads the app in headless Chromium and fails on any console error or uncaught exception.
// Uses CHROMIUM_PATH when set (e.g. a preinstalled browser), otherwise Playwright's default.
import { chromium } from 'playwright-core';
import { server } from './serve.js';

await new Promise((resolve) => server.listen(0, resolve));
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto(url, { waitUntil: 'networkidle' });

const checks = {
  'targets rendered': await page.locator('#targets-output .stat').count() > 0,
  'dashboard rendered': await page.locator('#macro-list .nutrient').count() > 0,
  'recipes rendered': await page.locator('#recipe-library .recipe-card').count() > 0,
  'grocery rendered': await page.locator('#grocery-list .aisle').count() > 0,
};
await browser.close();
server.close();

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => `missing: ${name}`);
const problems = [...errors, ...failed];
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Browser check passed (${Object.keys(checks).length} checks, no console errors).`);
