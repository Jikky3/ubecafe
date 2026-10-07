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

- **Targets**: BMR and TDEE (Mifflin-St Jeor × activity factor), goal-adjusted
  calories with safety floors (1,200 kcal, or 1,500 kcal for men), protein,
  fat, carbohydrate, sugar and fiber, plus age- and sex-specific RDAs.
- **Body composition** (optional): BMI, waist-to-hip and waist-to-height
  ratios, lean mass and Katch-McArdle BMR.
- **Recipe analysis**: paste a recipe and each ingredient line is parsed into
  a quantity, unit and food, then totaled per serving.
- **Weekly plan and dashboard**: a meal per slot per day, with that day's
  intake compared against your targets.
- **Recommendations**: "which food and why" rules for each gap or excess.
- **Supplement timing**: fat-soluble supplements go with your highest-fat
  meal; iron goes with vitamin C and is kept away from coffee, calcium and
  zinc; magnesium goes with dinner.
- **Grocery list**: the week's ingredients, scaled to your household size and
  grouped by aisle.
- **Local accounts**: several people can share one browser, each with
  separate data.

Photo import is a **demo**: the "scan a recipe photo" step does not yet read
your image and returns a built-in sample recipe instead.

## Privacy model

- **Your data stays on your device.** Profiles, recipes, plans and settings
  are saved in your browser's `localStorage`. The app has no backend, no
  analytics and no tracking, and it never uploads anything you enter.
- **Accounts are local.** An account separates people who share one browser.
  Passwords are salted and stretched with PBKDF2-SHA-256 (Web Crypto, 210,000
  iterations), and only the hash is stored. This keeps people's data apart; it
  is not server-grade security. The nutrition data itself is **not
  encrypted**, so anyone with access to the browser's storage can read it.
- **Clearing your browser data deletes everything.** There is no export or
  backup yet (planned in Phase 2 of the roadmap).
- **One third-party request:** the page loads its web fonts from Google
  Fonts, so Google receives a normal font request (including your IP address)
  when the page opens. No personal data is sent with it.

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
| `npm run test:browser` | Loads the app in headless Chromium, fails on console errors or missing sections, and runs [axe-core](https://github.com/dequelabs/axe-core) in the light and dark themes, failing on any serious or critical WCAG 2.1 A/AA violation. |

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
index.html            Page markup (single page, sectioned)
styles.css            All styles, with light and dark themes
js/
  main.js             Entry point: wires the UI modules together
  state.js            In-memory app state and per-user data loading
  storage.js          localStorage wrapper, namespaced per account
  util.js             Shared helpers (formatting, nutrient math, DOM helpers)
  data/               Constants, nutrient list, food table, seed recipes
  engines/            Pure logic, importable in Node without a DOM:
    biometrics.js       targets, RDAs, body composition
    recipe-parser.js    ingredient lines to grams and nutrients
    recommendations.js  "which food and why" rules
    schedule.js         supplement timing rules
    grocery.js          weekly grocery roll-up
    accounts.js         local accounts (PBKDF2 via Web Crypto)
  ui/                 One module per page section (DOM rendering and events)
tests/                Unit tests (node:test) and test helpers
tools/
  serve.js            Static dev server (npm start)
  browser-check.js    Headless Chromium smoke and accessibility check
.github/workflows/    CI and GitHub Pages deployment
```

## Data sources

- **Nutrient values** in `js/data/foods.js` were transcribed by hand from
  [USDA FoodData Central](https://fdc.nal.usda.gov/) (SR Legacy) and are given
  per 100 g. They have not been checked line by line and are not yet linked to
  FoodData Central IDs, so **verify them before relying on them**. Phase 1 of
  the roadmap replaces this table with a script-generated, sourced dataset.
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
