import { NUTRIENT_KEYS } from '../data/nutrients.js';
import { FOOD_DB, ALIAS_INDEX, UNIT_LOOKUP, WEIGHT_GRAMS, UNICODE_FRACTIONS, LIST_MARKER } from '../data/foods.js';
import { emptyNutrients, addNutrients, scaleNutrients } from '../util.js';

export class RecipeParser {
  static #cache = new WeakMap();

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

  /** Finds the best dictionary match (longest alias) for an ingredient name. */
  static matchFood(name) {
    const normalized = ` ${name.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ')} `;
    const hit = ALIAS_INDEX.find((entry) => entry.pattern.test(normalized));
    return hit ? FOOD_DB[hit.id] : null;
  }

  static toGrams(food, qty, unit) {
    const gPerCup = food?.gPerCup ?? 240;
    switch (unit) {
      case 'g': case 'kg': case 'oz': case 'lb': return qty * WEIGHT_GRAMS[unit];
      case 'ml': return qty * (gPerCup / 240);
      case 'l': return qty * 1000 * (gPerCup / 240);
      case 'cup': return qty * gPerCup;
      case 'tbsp': return qty * (gPerCup / 16);
      case 'tsp': return qty * (gPerCup / 48);
      case 'can': return qty * (food?.gPerCan ?? 400);
      case 'pinch': return qty * 0.4;
      default: return qty * (food?.gPerUnit ?? 100);
    }
  }

  /** Parses one ingredient line, e.g. "1 (15 oz) can black beans, drained". */
  static parseIngredientLine(rawLine) {
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
      rest = this.parseAmount(rest.slice(paren[0].length)).rest;
    }

    const name = rest.replace(/^of\s+/i, '').trim() || raw;
    const food = this.matchFood(name);
    const grams = packageAmount
      ? qty * this.toGrams(food, packageAmount.qty, packageAmount.unit)
      : this.toGrams(food, qty, unit);

    return {
      raw,
      qty,
      unit,
      name,
      foodId: food?.id ?? null,
      grams,
      nutrients: food ? scaleNutrients(food.nutrients, grams / 100) : emptyNutrients(),
    };
  }

  /** Analyzes a recipe (memoized per recipe object). */
  static analyze(recipe) {
    if (this.#cache.has(recipe)) return this.#cache.get(recipe);
    const ingredients = recipe.ingredientsText
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => this.parseIngredientLine(line));
    const totals = ingredients.reduce((sum, ing) => addNutrients(sum, ing.nutrients), emptyNutrients());
    const servings = Math.max(1, Number(recipe.servings) || 1);
    const result = {
      ingredients,
      totals,
      perServing: scaleNutrients(totals, 1 / servings),
      unmatched: ingredients.filter((ing) => !ing.foodId).length,
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
