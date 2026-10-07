import { DAYS, MEAL_SLOTS } from './data/constants.js';

/**
 * Schema migrations for one scope's user data (guest or one account).
 *
 * The data passed around is a plain object keyed by short data names, exactly
 * as saved under Storage.KEYS: { profile, recipes, plan, supplements, grocery, … }.
 * Keys a step does not know about (for example `customFoods`) are passed through
 * untouched so features can add data without a migration.
 *
 * Adding a migration: append { version: N + 1, description, migrate(data) } to
 * MIGRATIONS. `migrate` must be a pure function: it receives a private deep copy,
 * returns the new data object, and must not touch storage or the DOM. Never edit
 * or reorder a step that has shipped; write a new one instead. Data saved before
 * versioning existed is treated as version 0.
 */

export class MigrationError extends Error {
  /** @param {'invalid-version'|'newer-version'|'invalid-data'|'invalid-steps'} code */
  constructor(code, message) {
    super(message ?? code);
    this.name = 'MigrationError';
    this.code = code;
  }
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value) => typeof value === 'string';

/** v1 helpers: coerce each known key to the shape the current UI expects, or drop it so seeds are used. */
const normalizeV1 = {
  profile(profile) {
    return isPlainObject(profile) ? profile : undefined;
  },
  recipes(recipes) {
    if (!Array.isArray(recipes)) return undefined;
    return recipes
      .filter((r) => isPlainObject(r) && isString(r.id) && r.id !== '' && isString(r.title))
      .map((r) => ({
        ...r,
        servings: Number.isFinite(Number(r.servings)) && Number(r.servings) > 0 ? Number(r.servings) : 1,
        ingredientsText: isString(r.ingredientsText) ? r.ingredientsText : '',
        instructions: isString(r.instructions) ? r.instructions : '',
      }));
  },
  plan(plan) {
    if (!isPlainObject(plan)) return undefined;
    return Object.fromEntries(DAYS.map((day) => {
      const slots = isPlainObject(plan[day]) ? plan[day] : {};
      return [day, Object.fromEntries(MEAL_SLOTS.map((slot) => [slot.id, isString(slots[slot.id]) ? slots[slot.id] : '']))];
    }));
  },
  supplements(supplements) {
    if (!isPlainObject(supplements)) return undefined;
    return {
      ...supplements,
      selected: Array.isArray(supplements.selected) ? supplements.selected.filter(isString) : [],
      coffeeAtBreakfast: Boolean(supplements.coffeeAtBreakfast),
    };
  },
  grocery(grocery) {
    if (!isPlainObject(grocery)) return undefined;
    const household = Math.round(Number(grocery.household));
    return {
      ...grocery,
      household: Number.isFinite(household) ? Math.min(12, Math.max(1, household)) : 1,
      checked: Array.isArray(grocery.checked) ? grocery.checked.filter(isString) : [],
    };
  },
};

/** Ordered list of schema steps. The last step's version is the current schema version. */
export const MIGRATIONS = [
  {
    version: 1,
    description: 'Adopt versioned storage; validate the original profile, recipe, plan, supplement and grocery shapes.',
    migrate(data) {
      const next = { ...data };
      Object.entries(normalizeV1).forEach(([key, normalize]) => {
        if (!(key in next)) return;
        const value = normalize(next[key]);
        if (value === undefined) delete next[key];
        else next[key] = value;
      });
      return next;
    },
  },
];

/** Throws unless steps have unique, ascending, positive integer versions and a migrate function. */
export const validateSteps = (steps) => {
  steps.forEach((step, i) => {
    const ok = Number.isInteger(step?.version) && step.version > 0 && typeof step.migrate === 'function'
      && (i === 0 || step.version > steps[i - 1].version);
    if (!ok) throw new MigrationError('invalid-steps', `Migration step ${i} is out of order or malformed.`);
  });
  return steps;
};

export const latestVersion = (steps = MIGRATIONS) => (steps.length ? steps[steps.length - 1].version : 0);
export const CURRENT_SCHEMA_VERSION = latestVersion(validateSteps(MIGRATIONS));

/**
 * Brings one scope's data from `fromVersion` up to the latest step.
 * @param {object} data - short-name keyed user data (not modified)
 * @param {number} fromVersion - 0 for unversioned data
 * @returns {{data: object, version: number, applied: number[]}}
 * @throws {MigrationError} 'invalid-version' | 'newer-version' | 'invalid-data'
 */
export const runMigrations = (data, fromVersion, steps = MIGRATIONS) => {
  validateSteps(steps);
  const target = latestVersion(steps);
  if (!Number.isInteger(fromVersion) || fromVersion < 0) {
    throw new MigrationError('invalid-version', `Unknown schema version "${fromVersion}".`);
  }
  if (fromVersion > target) {
    throw new MigrationError('newer-version', `Data uses schema version ${fromVersion}; this app understands up to ${target}.`);
  }
  if (!isPlainObject(data)) throw new MigrationError('invalid-data', 'User data must be an object.');

  let current = structuredClone(data);
  const applied = [];
  steps.filter((step) => step.version > fromVersion).forEach((step) => {
    current = step.migrate(current);
    if (!isPlainObject(current)) throw new MigrationError('invalid-data', `Migration ${step.version} returned no data.`);
    applied.push(step.version);
  });
  return { data: current, version: target, applied };
};
