# Ube Café — Development Roadmap

_Written October 2026 against commit `f2628ac`; progress is ticked below._

> **Update:** the main repository (`julianaviado/ubecafe`) has since added
> local sign-in, a four-step onboarding wizard, a tabbed layout, allergen
> screening and diet patterns with safe substitutions. This branch is rebuilt
> on that version: the code is split into modules and the work below is
> ported onto it.

## Where the project is

Ube Café is a free, private, browser-only nutrition planner: three static files
(`index.html`, `styles.css`, `script.js`) with no build step and no server. It
turns a profile into calorie, macro and micronutrient targets, analyzes recipes
against an embedded food table, plans a week of meals, times supplements and
builds a grocery list. Every output comes from explicit, readable rules — the
code describes itself as "deterministic, rule-based … (no AI)".

## Interpreted direction

The two commits so far point in one consistent direction:

> **A trustworthy, explainable, privacy-first kitchen companion** — every number
> traceable to a published formula or data source, every suggestion paired with
> its reason, and all personal data kept on the user's own device.

The roadmap below keeps those three principles fixed and grows the app along
them: first make the numbers right, then make the data durable, then make the
planner smarter, and only then widen the reach.

## What the review found

### The food database is the weakest link

The 54-food table in `script.js` (`FOOD_ROWS`) drives everything downstream, and
its aliases map distinct foods onto the wrong entries. Running the parser on
common ingredient lines:

| Ingredient line            | Matched as      | Result         | Problem |
|----------------------------|-----------------|----------------|---------|
| `2 cups cooked brown rice` | brown rice (dry)| 1,358 kcal     | ~3× too high: values are for dry rice, no cooked/raw distinction |
| `1 tbsp butter beans`      | butter          | 102 kcal       | "butter" alias wins inside "butter beans" |
| `1 tsp red pepper flakes`  | red bell pepper | —              | spice matched as a vegetable |
| `1 cup almond milk`        | dairy milk      | dairy protein/calcium | plant milks share the cow's-milk row |
| `1 cup coconut milk`       | dairy milk      | 122 kcal       | real value is ~450 kcal |
| `4 oz feta`                | cheddar         | —              | feta has a different fat/sodium profile |
| `1 tbsp maple syrup`       | honey           | —              | different sugar and minerals |
| `1 lb ground turkey`       | _no match_      | 0 kcal         | silently contributes nothing |

Other gaps:

- **No sodium or saturated fat** is tracked, even though `salt` is in the table.
  These are the two limits most diet guidelines lead with.
- **Unmatched ingredients count as zero** with only a count shown, so totals
  can quietly be far too low.
- **Every planned meal counts as exactly one serving**; portions can't be
  adjusted.
- **No data provenance**: values aren't tied to a source such as a USDA
  FoodData Central ID, so they can't be audited or updated.

### Data durability

- Everything lives in `localStorage` with **no schema version**, so any future
  change to the data shape risks breaking saved data.
- **No export, import or backup.** Clearing browser data, or switching devices,
  loses every recipe and plan.
- Accounts keep people apart on a shared browser, but the stored data isn't
  encrypted (this is documented in the code).

### Engineering foundations

- **No README, license, tests or CI.** The engines (`BiometricsEngine`,
  `RecipeParser`, `RecommendationEngine`, `ScheduleOptimizer`,
  `GroceryAggregator`) are plain classes and would be easy to unit-test.
- `script.js` is one 1,800-line file. Native ES modules would split it without
  adding a build step.
- **Deployment target mismatch**: canonical and Open Graph URLs point to
  `julianaviado.github.io/ubecafe/`; this fork (`Jikky3/ubecafe`) would need its
  own URLs, or changes should flow upstream through pull requests.
- **"Photo OCR" is simulated**: it returns one of three built-in sample recipes
  regardless of the image. The UI should say so plainly until real OCR exists.

## Roadmap

### Phase 0 — Foundations (1–2 weeks)

Goal: make the project safe to change.

- [x] Add `README.md` (purpose, how to run, privacy model, data sources). A `LICENSE` is still the owner's decision.
- [x] Split `script.js` into ES modules (`data/`, `engines/`, `ui/`) loaded with `<script type="module">`; still no build step.
- [x] Add unit tests (Node's built-in `node:test`) for the parser, targets, recommendations, schedule and grocery roll-up. Seed them with the failing cases in the table above.
- [x] GitHub Actions: run the tests and an HTML/accessibility check on every PR; deploy to GitHub Pages from `main`.
- [ ] Decide which repository is canonical and fix the canonical/OG URLs to match.
- [x] ~~Label the photo import as a demo in the UI.~~ Superseded: photo import now does real on-device OCR.

### Phase 1 — Accurate nutrition data (2–4 weeks)

Goal: numbers a dietitian would accept.

- [ ] Move the food table into `data/foods.json` with a documented schema: id, name, aliases, aisle, per-100 g nutrients, portion weights, and a `source` field (USDA FoodData Central `fdcId`).
- [ ] Add separate raw/dry and cooked entries (rice, pasta, quinoa, lentils, beans) and detect "cooked" in ingredient lines.
- [ ] Split conflated entries: plant milks, coconut milk, feta vs cheddar, maple syrup vs honey, lime vs lemon, chili flakes vs bell pepper.
- [ ] Match whole phrases first and block false hits like "butter beans" → butter.
- [ ] Grow the table to roughly 300 common foods, generated from FoodData Central by a script that's checked into the repo, rather than typed in by hand.
- [ ] Track **sodium** and **saturated fat** as limits, with dashboard bars and recommendation rules.
- [ ] Unmatched ingredients: show a clear warning on each line, and let the user pick a matching food or enter custom values.

### Phase 2 — Durable, portable data (2–3 weeks)

Goal: never lose a user's work.

- [x] Add a `schemaVersion` and a migration step on load.
- [x] Export / import of all user data as a JSON file, plus an optional encrypted backup (Web Crypto AES-GCM with a key derived from a passphrase, which can be the account password).
- [x] Move storage from `localStorage` to IndexedDB, which allows more data and partial updates.
- [x] Make it an installable offline PWA (web app manifest and a service worker).

### Phase 3 — A smarter planner (4–6 weeks)

Goal: from tracking what you planned to helping you plan.

- [ ] Adjustable portions, more than one item per meal slot, and custom meal times.
- [x] Dietary preferences and allergies that filter recommendations and recipes (delivered upstream: allergen screening, diet patterns and safe substitutions).
- [x] Turn recommendations from food names into **ranked recipes** from the user's own library that close the day's biggest gaps.
- [ ] Rule-based "auto-fill my week" that meets targets within limits, keeping the rules readable and every choice explained.
- [ ] Weekly view of averages, since most micronutrient targets are meant to be met over days, not within one day.
- [ ] Grocery list: merge with pantry stock, show amounts in package sizes, and export as text or for printing.

### Phase 4 — Reach (later, optional)

Each of these needs a deliberate decision about the privacy promise.

- [x] Real photo-to-text with an in-browser OCR library such as Tesseract.js, so images still never leave the device.
- [ ] Import recipes from a URL by reading schema.org `Recipe` data. This needs a fetch proxy, which weakens the no-server promise.
- [ ] Optional end-to-end-encrypted sync across a user's devices.
- [ ] Translations into other languages, and metric-first regional defaults.
- [ ] A shared household plan: one grocery list for several profiles.

## Guardrails

These stay true in every phase:

1. **Explainable.** Every target, recommendation and supplement placement shows its rule and its source.
2. **Private by default.** Nothing leaves the device unless the user explicitly asks it to.
3. **Accessible.** WCAG 2.1 AA, checked automatically in CI.
4. **Not medical advice.** Keep the footer disclaimer. Add stronger warnings where the app touches medical territory: very-low-calorie targets, pregnancy, kidney disease and supplements.

## Suggested next step

Start with Phase 0's tests and Phase 1's food-data fixes together. The failing
cases above make a ready-made test suite, and fixing them is the largest single
improvement to how much users can trust the numbers.
