// Shared Playwright steps for driving the app in headless checks.

/**
 * Creates an account and completes the four onboarding steps, ending on the dashboard.
 * @param {import('playwright-core').Page} page
 * @param {{ name?: string, email?: string, password?: string, onStep?: (step: number) => Promise<void>,
 *   stopAtStep?: number }} [options]
 *   onStep runs once each wizard step is visible (e.g. for an accessibility scan).
 *   stopAtStep (1–4) returns as soon as that wizard step is shown, without continuing; by default
 *   all four steps are completed.
 */
export const signUpAndOnboard = async (page, {
  name = 'Ana Cruz', email = 'ana@example.com', password = 'correct horse', onStep, stopAtStep,
} = {}) => {
  await page.click('#tab-signup');
  await page.fill('#signup-name', name);
  await page.fill('#signup-email', email);
  await page.fill('#signup-password', password);
  await page.click('#signup-form [type="submit"]');
  await page.locator('#onboarding-view').waitFor({ state: 'visible' });

  for (let step = 1; step <= 4; step++) {
    await page.locator(`.wizard-step[data-step="${step}"]`).waitFor({ state: 'visible' });
    if (step === 3) {
      await page.fill('#age', '32');
      await page.fill('#height-ft', '5');
      await page.fill('#height-in', '6');
      await page.fill('#weight-lb', '150');
    }
    await onStep?.(step);
    if (step === stopAtStep) return;
    await page.click('#wizard-next');
  }
  await page.locator('#app-view').waitFor({ state: 'visible' });
};

/** Selects one of the main app tabs by its id (e.g. 'tab-planner'). */
export const openTab = async (page, id) => {
  await page.click(`#${id}`);
  await page.locator(`#${await page.getAttribute(`#${id}`, 'aria-controls')}`).waitFor({ state: 'visible' });
};
