/** Tracked nutrients and grocery aisles. */
export const NUTRIENTS = [
  { key: 'calories', label: 'Calories', unit: 'kcal', group: 'macro' },
  { key: 'protein', label: 'Protein', unit: 'g', group: 'macro' },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g', group: 'macro' },
  { key: 'fat', label: 'Fat', unit: 'g', group: 'macro' },
  { key: 'sugar', label: 'Sugar', unit: 'g', group: 'macro', isLimit: true },
  { key: 'fiber', label: 'Fiber', unit: 'g', group: 'micro' },
  { key: 'vitaminA', label: 'Vitamin A', unit: 'mcg', group: 'micro' },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg', group: 'micro' },
  { key: 'vitaminD', label: 'Vitamin D', unit: 'mcg', group: 'micro' },
  { key: 'vitaminB12', label: 'Vitamin B12', unit: 'mcg', group: 'micro' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', group: 'micro' },
  { key: 'iron', label: 'Iron', unit: 'mg', group: 'micro' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', group: 'micro' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', group: 'micro' },
  { key: 'zinc', label: 'Zinc', unit: 'mg', group: 'micro' },
  { key: 'omega3', label: 'Omega-3', unit: 'g', group: 'micro' },
];
export const NUTRIENT_KEYS = NUTRIENTS.map((n) => n.key);
export const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n]));

export const AISLES = ['Produce', 'Meat & Seafood', 'Dairy', 'Pantry & Grains', 'Supplements & Spices'];
export const [PRODUCE, MEAT, DAIRY, PANTRY, SPICES] = AISLES;
