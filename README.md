# Ube Café

A free, private, browser-only nutrition planner. Ube Café turns a short profile
into calorie, macro and micronutrient targets, analyzes your recipes against a
built-in food table, plans a week of meals, times your supplements, and builds a
grocery list for the week.

Every number comes from an explicit, readable rule (Mifflin-St Jeor for energy,
NIH Dietary Reference Intakes for micronutrients, WHO cut-offs for body
composition), and every recommendation says which rule triggered it. There is
no AI, no server and no build step: it is static HTML, CSS and native
JavaScript modules.

See [ROADMAP.md](ROADMAP.md) for where the project is headed.

## Features

- **Accounts and onboarding**: create a local account, then a four-step
  wizard collects goals and timeline, diet pattern and allergies, biometrics
  (with optional body fat, waist, hip and lean mass) and a first recipe. A
  reload resumes the current step.
- **Targets**: BMR and TDEE (Mifflin-St Jeor × activity factor), goal- and
  timeline-adjusted calories with safety floors (1,200 kcal, or 1,500 kcal for
  men), protein, fat, carbohydrate (a 30 g keto split when chosen), sugar and
  fiber, daily limits for saturated fat (under 10 % of energy) and sodium
  (2,300 mg), plus age- and sex-specific RDAs and a projected weight change.
- **Allergies and diets**: peanuts, tree nuts, dairy, gluten, soy, eggs and
  shellfish, plus vegetarian, vegan, pescatarian, keto and paleo patterns.
  Each conflicting ingredient is swapped for a nutritionally similar, safe
  substitute; recipes with an allergen that has no safe swap are kept out of
  the plan, dashboard and grocery list.
- **Recipes**: paste a recipe or scan a photo (read on your device with
  Tesseract.js; the photo is never uploaded). Ingredient lines are parsed into
  quantities, units and foods (177 built-in foods, with cooked, dry and canned
  variants) and totaled per serving, with swaps applied. Any line the table
  doesn't recognize is highlighted: pick a food for it, mark it as "no
  nutrition", or add your own custom food (values per 100 g from a label).
  Totals say "at least" until every line is resolved.
- **Cook-along recipe view**: opens from the planner, the day's timeline, the
  library and the suggestion cards, with tick-off ingredients and steps,
  per-serving nutrition, inline swaps and the supplements that go with that
  meal. Every recipe has a link (`#recipe/<id>`).
- **Weekly plan and dashboard**: a meal per slot per day, with the day's
  intake compared against your targets.
- **Suggestions**: "which food and why" rules for each gap or excess, with how
  far off you are, which planned meals drive the nutrient and the best safe
  recipes from your library.
- **Supplement timing**: fat-soluble supplements go with your highest-fat
  meal; iron goes with vitamin C and is kept away from coffee, calcium and
  zinc; magnesium goes with dinner.
- **Grocery list**: the week's ingredients (substitutes included), scaled to
  your household size and grouped by aisle.
- **Backups and offline use**: export everything to a file (optionally
  passphrase-encrypted), restore it on any device, and install the app to use
  it offline.

## Privacy model

- **Your data stays on your device.** Profiles, recipes, plans and settings
  are saved in your browser's IndexedDB (falling back to `localStorage`). The
  app has no backend, no analytics and no tracking, and it never uploads
  anything you enter.
- **Accounts are local.** An account separates people who share one browser.
  Passwords are salted and stretched with PBKDF2-SHA-256 (Web Crypto, 210,000
  iterations), and only the hash is stored. This keeps people's data apart; it
  is not server-grade security. Saved nutrition data is **not encrypted** in
  the browser, so anyone with access to its storage can read it.
- **Back up before clearing your browser.** Clearing site data deletes
  everything; use **Profile → Back up & restore** to keep a copy. Backups can
  be encrypted with a passphrase (AES-GCM, PBKDF2-derived key).
- **Third-party downloads, no personal data:** the page loads its web fonts
  from Google Fonts, and the first photo scan downloads the OCR engine and
  English language data (about 5 MB) from jsDelivr. Both are ordinary file
  requests (they reveal your IP address to those services); your photos and
  data are never sent.

## Running locally

The app uses native ES modules, which browsers do not load from `file://`
URLs. If you open `index.html` directly, the page appears but none of the app
runs, so serve the folder over HTTP:

```sh
npm start            # serves the repo at http://localhost:8080 (PORT=3000 npm start to change it)
```

`npm start` needs only Node.js 22 or later and no installed packages. Any
static file server works too, for example `python3 -m http.server 8080`.

## Testing

Install the development tools once:

```sh
npm install
```

| Command | What it checks |
|---------|----------------|
| `npm test` | Unit tests for the engines (`tests/*.test.js`, Node's built-in `node:test`). No browser needed. |
| `npm run lint:html` | Validates `index.html` with [html-validate](https://html-validate.org/) (`html-validate:recommended`). |
| `npm run test:browser` | In headless Chromium, signs up, completes onboarding and opens every tab, failing on console errors or missing sections; runs [axe-core](https://github.com/dequelabs/axe-core) on each screen in the light and dark themes and fails on any serious or critical WCAG 2.1 A/AA violation. |
| `npm run test:ocr` | End-to-end photo OCR check in headless Chromium (needs network access to jsDelivr, or `OCR_PACKAGES_DIR` pointing at local copies of the pinned packages). |

The browser check needs a Chromium build. Either let Playwright download one:

```sh
npx playwright-core install chromium
```

or point it at an existing Chrome or Chromium:

```sh
CHROMIUM_PATH=/path/to/chrome npm run test:browser
```

A few html-validate rules are switched off for single elements in
`index.html`, using inline `html-validate-disable-next` comments that give the
reason (for example, the supplement form saves on every change and so has no
submit button). The JSON config can't hold comments, so the exceptions are kept
next to the markup they cover.

### Continuous integration and deployment

- `.github/workflows/ci.yml` runs the unit tests, HTML lint and the
  browser/accessibility check on every push and pull request.
- `.github/workflows/pages.yml` runs the tests and lint, then deploys the
  static site (`index.html`, `styles.css`, `js/` and any assets) to GitHub
  Pages on every push to `main`. To turn this on, set **Settings → Pages →
  Source** to **GitHub Actions** in the repository.

## Project structure

```
index.html            Page markup: sign-in view, onboarding wizard, tabbed app, dialogs
styles.css            All styles, with light and dark themes
sw.js                 Service worker (offline app shell)
manifest.webmanifest  Install metadata; icons/ holds the app icons
js/
  main.js             Entry point: storage init, view routing, tabs, wiring
  state.js            In-memory app state and per-account data loading
  storage.js          IndexedDB-backed key-value store with a synchronous cache
  migrations.js       Ordered schema migrations for saved data and backups
  util.js             Shared helpers (formatting, nutrient math, DOM helpers)
  data/               Nutrient list, food table, allergy/diet rules and
                      substitutes, constants, seed recipes
  engines/            Pure logic, importable in Node without a DOM:
    nutrition.js        targets, pace, RDAs, body composition
    recipe-manager.js   ingredient lines to grams and nutrients
    substitution.js     allergy and diet screening with safe swaps
    recommendations.js  "which food and why" rules
    recipe-match.js     links nutrient gaps to planned meals and recipes
    schedule.js         supplement timing rules
    grocery.js          weekly grocery roll-up
    auth.js             local accounts (PBKDF2 via Web Crypto)
    backup.js           export, import and encrypted backups
    ocr.js              on-device OCR (Tesseract.js) and text cleanup
  ui/                 One module per view or panel (DOM rendering and events)
tests/                Unit tests (node:test) and test helpers
tools/
  serve.js            Static dev server (npm start)
  flows.js            Shared sign-up/onboarding steps for browser checks
  browser-check.js    Headless Chromium smoke and accessibility check
  ocr-check.js        End-to-end OCR check
  make-icons.js       Regenerates icons/ from the SVG mark
.github/workflows/    CI and GitHub Pages deployment
```

## Data sources

- **Nutrient values** in `js/data/foods.js` are per 100 g and were transcribed
  by hand from [USDA FoodData Central](https://fdc.nal.usda.gov/) (SR Legacy);
  each row names the USDA food description it comes from, and the few foods
  not in SR Legacy (fortified oat milk, coconut aminos, coconut yogurt,
  gluten-free bread and pasta, nutritional yeast) are marked as label-derived
  estimates. The rows are
  not yet linked to FoodData Central IDs or checked against the API, so
  **verify them before relying on them**. Custom foods are whatever you enter.
- **Limits**: saturated fat under 10 % of energy and sodium under 2,300 mg a
  day (Dietary Guidelines for Americans 2020-2025, AHA).
- **Energy**: Mifflin-St Jeor equation (1990); Katch-McArdle when body fat is
  known.
- **Micronutrient targets**: NIH Office of Dietary Supplements, Dietary
  Reference Intakes (RDA or AI).
- **Fiber**: 14 g per 1,000 kcal (Institute of Medicine). **Sugar**: under
  10 % of energy (WHO).
- **Body composition**: WHO cut-offs for BMI and waist-to-hip ratio;
  waist-to-height ratio of 0.5.

## Disclaimer

Ube Café is an educational tool, not medical advice. Its numbers are estimates
from general-population formulas and an unverified food table. They may be
wrong for you, especially if you are pregnant or breastfeeding, under 18, an
athlete, managing a medical condition, or taking medication. Talk to a doctor
or registered dietitian before changing your diet or starting supplements.

## License

No license has been chosen yet. Until one is added, the default copyright
rules apply and the code is not licensed for reuse.
