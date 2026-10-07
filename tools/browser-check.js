// Signs up, completes onboarding and visits every tab in headless Chromium; fails on any console error, uncaught exception,
// missing rendered section, or serious/critical WCAG 2.1 A/AA violation reported by axe-core.
// Uses CHROMIUM_PATH when set (e.g. a preinstalled browser), otherwise Playwright's default.
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import { openTab, signUpAndOnboard } from './flows.js';
import { server } from './serve.js';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

/** Runs axe-core in the page and returns serious/critical violations as readable lines. */
const runAxe = async (page, label) => {
  await page.addScriptTag({ path: AXE_PATH });
  const violations = await page.evaluate(async (tags) => {
    // eslint-disable-next-line no-undef
    const results = await axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return results.violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    }));
  }, AXE_TAGS);
  return violations
    .filter((v) => BLOCKING_IMPACTS.has(v.impact))
    .map((v) => `axe [${label}] ${v.impact} ${v.id}: ${v.help}\n    ${v.targets.join('\n    ')}`);
};

await new Promise((resolve) => server.listen(0, resolve));
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const checks = {};

for (const colorScheme of ['light', 'dark']) {
  const page = await browser.newPage({ colorScheme });
  page.on('pageerror', (e) => errors.push(`pageerror (${colorScheme}): ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console (${colorScheme}): ${m.text()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  const label = (where) => `${colorScheme} theme, ${where}`;

  errors.push(...await runAxe(page, label('sign in')));
  await signUpAndOnboard(page, {
    onStep: async (step) => {
      if (step === 2) await page.check('#allergy-dairy');
      if (step === 4) {
        // Analyze a recipe with a swap, an unrecognized line and the custom food form, then scan it.
        await page.fill('#ob-ingredients', '1/4 cup cheddar cheese\n1 tbsp gochujang\n1 cup cooked rice');
        await page.click('#ob-analyze');
        await page.locator('#ob-analysis tr.is-unmatched').waitFor();
        if (colorScheme === 'light') {
          checks['unmatched picker rendered'] = await page.locator('#ob-analysis select[data-match-key="gochujang"]').count() === 1;
          checks['custom food form rendered'] = await page.locator('#ob-custom-name').isVisible();
        }
      }
      errors.push(...await runAxe(page, label(`onboarding step ${step}`)));
    },
  });

  if (colorScheme === 'light') {
    Object.assign(checks, {
      'targets rendered': await page.locator('#targets-output .stat').count() > 0,
      'dashboard rendered': await page.locator('#macro-list .nutrient').count() > 0,
      'recipes rendered': await page.locator('#recipe-library .recipe-card').count() > 0,
      'limits in dashboard summary': /daily limit/.test(await page.locator('#dashboard-summary').innerText()),
      'grocery rendered': await page.locator('#grocery-list .aisle').count() > 0,
    });
  }
  for (const tab of ['tab-dashboard', 'tab-recipes', 'tab-planner', 'tab-grocery']) {
    await openTab(page, tab);
    errors.push(...await runAxe(page, label(tab)));
  }
  await page.close();
}

await browser.close();
server.close();

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => `missing: ${name}`);
const problems = [...errors, ...failed];
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Browser check passed (${Object.keys(checks).length} render checks, axe WCAG 2.1 A/AA on sign-in, every onboarding step and every tab, in light and dark themes, no console errors).`);
