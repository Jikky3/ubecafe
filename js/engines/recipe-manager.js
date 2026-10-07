import {
  FOOD_DB, FOOD_GROUPS, ALIAS_INDEX, EXCLUDES, PRODUCT_WORDS, UNIT_LOOKUP, WEIGHT_GRAMS, UNICODE_FRACTIONS, LIST_MARKER,
  buildCustomFood, normalizeText,
} from '../data/foods.js';
import { emptyNutrients, addNutrients, scaleNutrients } from '../util.js';

/** Value stored in recipe.matches to mark a line as "no nutrition" (e.g. ice, garnish). */
export const IGNORE_MATCH = 'none';

/** State words, checked against the whole ingredient line. The earliest one in the line wins. */
const STATE_WORDS = [
  [/(?<![a-z])(?:cooked|boiled|steamed|roasted|grilled|baked|rotisserie|leftover)(?![a-z])/, 'cooked'],
  [/(?<![a-z])(?:canned|tinned)(?![a-z])/, 'canned'],
  [/(?<![a-z])(?:dry|dried|uncooked)(?![a-z])/, 'dry'],
  [/(?<![a-z])raw(?![a-z])/, 'raw'],
];
const STATE_FALLBACK = { cooked: ['cooked', 'canned'], canned: ['canned', 'cooked'], dry: ['dry', 'raw'], raw: ['raw', 'dry'] };

export class RecipeManager {
  static #cache = new WeakMap();
  static #custom = new Map();

  /** Registers the user's custom foods (stored shape, see buildCustomFood) and clears the analysis cache. */
  static setCustomFoods(list = []) {
    this.#custom = new Map(list.map((stored) => [stored.id, buildCustomFood(stored)]));
    this.#cache = new WeakMap();
  }

  /** Looks up a built-in or custom food by id. */
  static getFood(id) {
    return FOOD_DB[id] ?? this.#custom.get(id) ?? null;
  }

  static customFoods() {
    return [...this.#custom.values()];
  }

  /** Key used in recipe.matches: the ingredient name without prep notes ("black beans, drained" → "black beans"). */
  static matchKey(name) {
    return normalizeText(String(name).split(/[,(;]/)[0]) || normalizeText(name);
  }

  /** Converts "1 1/2", "3/4" or "2.5" into a number. */
  static toNumber(text) {
    return text.trim().split(/\s+/).reduce((sum, part) => {
      if (part.includes('/')) {
        const [num, den] = part.split('/').map(Number);
        return sum + (den ? num / den : 0);
      }
      return sum + Number(part);
    }, 0);
  }

  /** Reads a leading quantity (with ranges) and unit from text. */
  static parseAmount(text) {
    const number = String.raw`\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+`;
    const qtyMatch = text.match(new RegExp(`^(${number})(?:\\s*(?:-|to)\\s*(${number}))?\\s*`));
    let qty = null;
    let rest = text;
    if (qtyMatch) {
      const low = this.toNumber(qtyMatch[1]);
      qty = qtyMatch[2] ? (low + this.toNumber(qtyMatch[2])) / 2 : low;
      rest = text.slice(qtyMatch[0].length);
    }
    const unitMatch = rest.match(/^([a-zA-Z]+)\.?(?=\s|$)/);
    const unit = unitMatch ? UNIT_LOOKUP[unitMatch[1].toLowerCase()] ?? null : null;
    if (unit) rest = rest.slice(unitMatch[0].length).trim();
    return { qty, unit, rest: rest.trim() };
  }

  /**
   * Finds the dictionary alias for an ingredient name. Rules, in order:
   * the longest alias wins (ties go to the later one, usually the head noun: "cherry tomatoes");
   * an alias directly followed by a product word ("butter beans", "almond flour") is skipped;
   * a food whose exclude phrases appear in the name is skipped.
   * Returns { food, alias } or null.
   */
  static findMatch(name) {
    const text = normalizeText(name);
    if (!text) return null;
    let best = null;
    for (const entry of ALIAS_INDEX) {
      if (best && entry.length < best.length) break;
      if (EXCLUDES[entry.id].some((phrase) => text.includes(phrase))) continue;
      entry.pattern.lastIndex = 0;
      for (const m of text.matchAll(entry.pattern)) {
        const nextWord = text.slice(m.index + m[0].length).trim().split(' ')[0];
        if (PRODUCT_WORDS.has(nextWord)) continue;
        if (!best || m.index > best.index) best = { id: entry.id, alias: entry.alias, length: entry.length, index: m.index };
      }
    }
    return best ? { food: FOOD_DB[best.id], alias: best.alias } : null;
  }

  /**
   * Foods named only as the base of another product ("walnut oil", "almond flour", "shrimp paste"):
   * an alias directly followed by a product word, not vetoed by the food's excludes. The substitution
   * engine uses these so an allergen stays visible when the line matches a different food or none.
   */
  static productMentions(name) {
    const text = normalizeText(name);
    const ids = new Set();
    if (!text) return [];
    for (const entry of ALIAS_INDEX) {
      if (ids.has(entry.id) || EXCLUDES[entry.id].some((phrase) => text.includes(phrase))) continue;
      entry.pattern.lastIndex = 0;
      for (const m of text.matchAll(entry.pattern)) {
        const nextWord = text.slice(m.index + m[0].length).trim().split(' ')[0];
        if (PRODUCT_WORDS.has(nextWord)) { ids.add(entry.id); break; }
      }
    }
    return [...ids];
  }

  /** Finds the best dictionary match for an ingredient name (food object or null). */
  static matchFood(name) {
    return this.findMatch(name)?.food ?? null;
  }

  /** Reads "cooked", "dry", "canned" … from a line; a "can" unit implies canned. Returns a FOOD_STATES value or null. */
  static detectState(text, unit = null) {
    const normalized = normalizeText(text);
    let found = null;
    STATE_WORDS.forEach(([pattern, state]) => {
      const m = normalized.match(pattern);
      if (m && (!found || m.index < found.index)) found = { state, index: m.index };
    });
    if (found) return found.state;
    return unit === 'can' ? 'canned' : null;
  }

  /** Swaps a food for its state variant (dry ↔ cooked ↔ canned) when the line asks for one. */
  static resolveState(food, state) {
    if (!food?.group || !state) return food;
    const variants = FOOD_GROUPS[food.group];
    const pick = STATE_FALLBACK[state].map((s) => variants[s]).find(Boolean);
    return pick ?? food;
  }

  static toGrams(food, qty, unit) {
    const portions = food?.portions ?? { unit: food?.gPerUnit ?? 100, cup: food?.gPerCup ?? 240, can: food?.gPerCan ?? 400 };
    switch (unit) {
      case 'g': case 'kg': case 'oz': case 'lb': return qty * WEIGHT_GRAMS[unit];
      case 'ml': return qty * (portions.cup / 240);
      case 'l': return qty * 1000 * (portions.cup / 240);
      case 'cup': return qty * portions.cup;
      case 'tbsp': return qty * (portions.cup / 16);
      case 'tsp': return qty * (portions.cup / 48);
      case 'can': return qty * portions.can;
      case 'pinch': return qty * 0.4;
      default: return qty * portions.unit;
    }
  }

  /**
   * Parses one ingredient line, e.g. "1 (15 oz) can black beans, drained".
   * `matches` is a recipe's override map ({ [matchKey]: foodId | IGNORE_MATCH }).
   * Returns { raw, qty, unit, name, key, foodId, food, state, matchSource: 'auto' | 'user' | 'ignored' | null,
   *           grams, nutrients, mentions } (`mentions`: see productMentions).
   */
  static parseIngredientLine(rawLine, matches = {}) {
    const raw = rawLine.replace(LIST_MARKER, '').trim();
    const text = raw.replace(/(\d)?\s*([½⅓⅔¼¾⅛])/g, (_, whole, frac) => `${whole ? `${whole} ` : ''}${UNICODE_FRACTIONS[frac]}`);
    const amount = this.parseAmount(text);
    const qty = amount.qty ?? 1;
    let { unit, rest } = amount;

    // Package sizes in parentheses override the outer unit: "1 (15 oz) can beans".
    let packageAmount = null;
    const paren = rest.match(/^\(([^)]*)\)\s*/);
    if (paren) {
      const inner = this.parseAmount(paren[1]);
      if (inner.qty !== null && inner.unit && !inner.rest) packageAmount = inner;
      const after = this.parseAmount(rest.slice(paren[0].length));
      if (!unit && after.unit) unit = after.unit;
      rest = after.rest;
    }
    // "Salt to taste" with no amount counts as a pinch.
    if (amount.qty === null && !unit && /\bto taste\b/i.test(text)) unit = 'pinch';

    const name = rest.replace(/^of\s+/i, '').trim() || raw;
    const key = this.matchKey(name);
    const override = matches?.[key];

    let food = null;
    let matchSource = null;
    if (override === IGNORE_MATCH) {
      matchSource = 'ignored';
    } else if (override && this.getFood(override)) {
      food = this.getFood(override);
      matchSource = 'user';
    } else {
      const auto = this.matchFood(name);
      food = this.resolveState(auto, this.detectState(raw, unit));
      matchSource = food ? 'auto' : null;
    }

    // A can's label weight includes the liquid; "drained" uses the food's drained can weight instead.
    const drainedCan = unit === 'can' && /\bdrained\b/i.test(text);
    const grams = packageAmount && !drainedCan
      ? qty * this.toGrams(food, packageAmount.qty, packageAmount.unit)
      : this.toGrams(food, qty, unit);

    return {
      raw,
      qty,
      unit,
      name,
      key,
      foodId: food?.id ?? null,
      food,
      state: food?.state ?? null,
      matchSource,
      grams,
      nutrients: food ? scaleNutrients(food.nutrients, grams / 100) : emptyNutrients(),
      mentions: this.productMentions(name).filter((id) => id !== food?.id),
    };
  }

  /**
   * Analyzes a recipe (memoized per recipe object). Uses recipe.matches overrides.
   * `unmatched` counts lines with no food that the user has not marked as "no nutrition".
   */
  static analyze(recipe) {
    if (this.#cache.has(recipe)) return this.#cache.get(recipe);
    const ingredients = recipe.ingredientsText
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => this.parseIngredientLine(line, recipe.matches));
    const totals = ingredients.reduce((sum, ing) => addNutrients(sum, ing.nutrients), emptyNutrients());
    const servings = Math.max(1, Number(recipe.servings) || 1);
    const unmatchedLines = ingredients.filter((ing) => !ing.foodId && ing.matchSource !== 'ignored');
    const result = {
      ingredients,
      totals,
      perServing: scaleNutrients(totals, 1 / servings),
      unmatched: unmatchedLines.length,
      unmatchedLines,
    };
    this.#cache.set(recipe, result);
    return result;
  }

  /** Splits pasted / OCR'd text into title, servings, ingredients and instructions. */
  static parseRecipeText(text) {
    let title = '';
    let servings = null;
    let mode = null;
    const ingredients = [];
    const instructions = [];

    text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
      const titleMatch = line.match(/^title\s*[:-]\s*(.+)$/i);
      const servingsMatch = line.match(/^(?:servings?|serves|yield|makes)\s*[:-]?\s*(\d+)/i);
      if (titleMatch) {
        title = titleMatch[1];
      } else if (servingsMatch) {
        servings = Number(servingsMatch[1]);
      } else if (/^ingredients?\s*:?$/i.test(line)) {
        mode = 'ingredients';
      } else if (/^(?:instructions?|directions?|method|steps|preparation)\s*:?$/i.test(line)) {
        mode = 'instructions';
      } else if (mode === 'ingredients') {
        ingredients.push(line.replace(LIST_MARKER, ''));
      } else if (mode === 'instructions') {
        instructions.push(line.replace(LIST_MARKER, ''));
      } else if (!title) {
        title = line;
      }
    });

    return { title, servings: servings ?? 1, ingredientsText: ingredients.join('\n'), instructions: instructions.join('\n') };
  }
}
