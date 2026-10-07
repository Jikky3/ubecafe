/**
 * Ube Café Nutrition Planner
 * Deterministic, rule-based meal planning & nutrition engine (no AI).
 *
 * Modules
 *  1. Reference data      – nutrients, food dictionary, units, aisles, seeds
 *  2. Utilities & Storage – formatting, escaping, localStorage persistence
 *  3. BiometricsEngine    – Mifflin-St Jeor energy + macro/micro targets
 *  4. RecipeParser        – raw text + ingredient parsing, nutrition analysis
 *     AllergenGuard       – allergen detection + rule-based safe substitutions
 *  5. RecommendationEngine– if/else "which food & why" rules
 *  6. ScheduleOptimizer   – meal timeline + supplement timing rules
 *  7. GroceryAggregator   – weekly ingredient roll-up grouped by aisle
 *  8. AccountManager      – local multi-user accounts (PBKDF2-hashed passwords)
 *  9. UI controllers      – rendering and accessible event handling
 */
'use strict';

/* =========================================================
 * 1. Reference data
 * ======================================================= */

const NUTRIENTS = [
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
const NUTRIENT_KEYS = NUTRIENTS.map((n) => n.key);
const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n]));

const AISLES = ['Produce', 'Meat & Seafood', 'Dairy', 'Pantry & Grains', 'Supplements & Spices'];
const [PRODUCE, MEAT, DAIRY, PANTRY, SPICES] = AISLES;

/**
 * Food dictionary. Values are per 100 g, in NUTRIENT_KEYS order:
 * kcal, protein, carbs, fat, sugar, fiber, vitA(mcg RAE), vitC(mg), vitD(mcg),
 * B12(mcg), calcium(mg), iron(mg), potassium(mg), magnesium(mg), zinc(mg), omega-3(g).
 * gPerUnit = grams for one "piece/clove/slice"; gPerCup = grams in one US cup.
 * count = label used on the grocery list for countable produce.
 */
const FOOD_ROWS = [
  ['spinach', 'Spinach', PRODUCE, ['spinach', 'baby spinach'], 30, 30, [23, 2.9, 3.6, 0.4, 0.4, 2.2, 469, 28, 0, 0, 99, 2.7, 558, 79, 0.5, 0.14]],
  ['kale', 'Kale', PRODUCE, ['kale'], 21, 21, [35, 2.9, 4.4, 1.5, 0.8, 4.1, 241, 93, 0, 0, 254, 1.6, 348, 33, 0.4, 0.18]],
  ['broccoli', 'Broccoli', PRODUCE, ['broccoli', 'broccoli florets'], 150, 91, [34, 2.8, 6.6, 0.4, 1.7, 2.6, 31, 89, 0, 0, 47, 0.7, 316, 21, 0.4, 0.02]],
  ['bell-pepper', 'Red bell pepper', PRODUCE, ['bell pepper', 'red pepper', 'green pepper', 'yellow pepper', 'capsicum'], 120, 150, [31, 1, 6, 0.3, 4.2, 2.1, 157, 128, 0, 0, 7, 0.4, 211, 12, 0.3, 0.03], 'pcs'],
  ['sweet-potato', 'Sweet potato', PRODUCE, ['sweet potato', 'yam'], 130, 133, [86, 1.6, 20, 0.1, 4.2, 3, 709, 2.4, 0, 0, 30, 0.6, 337, 25, 0.3, 0], 'pcs'],
  ['carrot', 'Carrot', PRODUCE, ['carrot'], 61, 128, [41, 0.9, 9.6, 0.2, 4.7, 2.8, 835, 5.9, 0, 0, 33, 0.3, 320, 12, 0.2, 0], 'pcs'],
  ['tomato', 'Tomato', PRODUCE, ['tomato', 'diced tomato', 'cherry tomato'], 123, 180, [18, 0.9, 3.9, 0.2, 2.6, 1.2, 42, 14, 0, 0, 10, 0.3, 237, 11, 0.2, 0], 'pcs', 400],
  ['onion', 'Onion', PRODUCE, ['onion', 'red onion', 'shallot'], 110, 160, [40, 1.1, 9.3, 0.1, 4.2, 1.7, 0, 7.4, 0, 0, 23, 0.2, 146, 10, 0.2, 0], 'pcs'],
  ['garlic', 'Garlic', PRODUCE, ['garlic', 'garlic clove'], 3, 136, [149, 6.4, 33, 0.5, 1, 2.1, 0, 31, 0, 0, 181, 1.7, 401, 25, 1.2, 0], 'cloves'],
  ['ginger', 'Ginger', PRODUCE, ['ginger'], 10, 96, [80, 1.8, 18, 0.8, 1.7, 2, 0, 5, 0, 0, 16, 0.6, 415, 43, 0.3, 0]],
  ['cucumber', 'Cucumber', PRODUCE, ['cucumber'], 300, 120, [15, 0.7, 3.6, 0.1, 1.7, 0.5, 5, 2.8, 0, 0, 16, 0.3, 147, 13, 0.2, 0], 'pcs'],
  ['mushroom', 'Mushrooms', PRODUCE, ['mushroom'], 18, 70, [22, 3.1, 3.3, 0.3, 2, 1, 0, 2.1, 0.2, 0.04, 3, 0.5, 318, 9, 0.5, 0]],
  ['avocado', 'Avocado', PRODUCE, ['avocado'], 150, 150, [160, 2, 8.5, 14.7, 0.7, 6.7, 7, 10, 0, 0, 12, 0.6, 485, 29, 0.6, 0.11], 'pcs'],
  ['banana', 'Banana', PRODUCE, ['banana'], 118, 150, [89, 1.1, 22.8, 0.3, 12.2, 2.6, 3, 8.7, 0, 0, 5, 0.3, 358, 27, 0.2, 0.03], 'pcs'],
  ['apple', 'Apple', PRODUCE, ['apple'], 182, 125, [52, 0.3, 13.8, 0.2, 10.4, 2.4, 3, 4.6, 0, 0, 6, 0.1, 107, 5, 0, 0], 'pcs'],
  ['orange', 'Orange', PRODUCE, ['orange'], 131, 180, [47, 0.9, 11.8, 0.1, 9.4, 2.4, 11, 53, 0, 0, 40, 0.1, 181, 10, 0.1, 0.01], 'pcs'],
  ['kiwi', 'Kiwi', PRODUCE, ['kiwi', 'kiwifruit'], 69, 180, [61, 1.1, 14.7, 0.5, 9, 3, 4, 93, 0, 0, 34, 0.3, 312, 17, 0.1, 0.04], 'pcs'],
  ['lemon', 'Lemon', PRODUCE, ['lemon', 'lemon juice', 'lime', 'lime juice'], 58, 244, [29, 1.1, 9.3, 0.3, 2.5, 2.8, 1, 53, 0, 0, 26, 0.6, 138, 8, 0.1, 0], 'pcs'],
  ['blueberries', 'Blueberries', PRODUCE, ['blueberry', 'blueberries'], 148, 148, [57, 0.7, 14.5, 0.3, 10, 2.4, 3, 9.7, 0, 0, 6, 0.3, 77, 6, 0.2, 0.06]],
  ['strawberries', 'Strawberries', PRODUCE, ['strawberry', 'strawberries'], 152, 152, [32, 0.7, 7.7, 0.3, 4.9, 2, 1, 59, 0, 0, 16, 0.4, 153, 13, 0.1, 0.07]],
  ['tofu', 'Firm tofu', PRODUCE, ['tofu', 'firm tofu'], 120, 248, [144, 17.3, 2.8, 8.7, 0.6, 2.3, 0, 0.2, 0, 0, 683, 2.7, 237, 58, 1.6, 0.6]],
  ['chicken', 'Chicken breast', MEAT, ['chicken', 'chicken breast'], 200, 140, [120, 22.5, 0, 2.6, 0, 0, 9, 0, 0.1, 0.2, 5, 0.4, 334, 28, 0.7, 0.02]],
  ['beef', 'Lean ground beef', MEAT, ['beef', 'ground beef', 'lean beef', 'steak'], 113, 225, [176, 20, 0, 10, 0, 0, 0, 0, 0.1, 2.2, 12, 2.2, 321, 20, 4.8, 0.04]],
  ['salmon', 'Salmon', MEAT, ['salmon', 'salmon fillet'], 170, 140, [208, 20, 0, 13, 0, 0, 12, 0, 11, 3.2, 9, 0.3, 363, 27, 0.4, 2.3], 'fillets'],
  ['tuna', 'Canned tuna', MEAT, ['tuna'], 142, 154, [116, 25.5, 0, 0.8, 0, 0, 6, 0, 1.2, 2.5, 11, 1.5, 237, 27, 0.8, 0.27], 'cans', 142],
  ['sardines', 'Sardines', MEAT, ['sardine'], 92, 150, [208, 24.6, 0, 11.5, 0, 0, 32, 0, 4.8, 8.9, 382, 2.9, 397, 39, 1.3, 1.48], 'cans', 92],
  ['shrimp', 'Shrimp', MEAT, ['shrimp', 'prawn'], 15, 145, [85, 20, 0, 0.5, 0, 0, 0, 0, 0, 1.1, 64, 0.2, 264, 35, 1.3, 0.3]],
  ['eggs', 'Eggs', DAIRY, ['egg'], 50, 243, [143, 12.6, 0.7, 9.5, 0.4, 0, 160, 0, 2, 0.9, 56, 1.8, 138, 12, 1.3, 0.07], 'eggs'],
  ['greek-yogurt', 'Greek yogurt', DAIRY, ['greek yogurt', 'yogurt', 'yoghurt'], 170, 245, [59, 10, 3.6, 0.4, 3.2, 0, 1, 0, 0, 0.75, 110, 0.1, 141, 11, 0.5, 0]],
  ['cottage-cheese', 'Cottage cheese', DAIRY, ['cottage cheese'], 113, 226, [81, 10.5, 4.8, 2.3, 4, 0, 28, 0, 0, 0.5, 111, 0.2, 125, 9, 0.5, 0.01]],
  ['milk', 'Milk', DAIRY, ['milk', 'fortified milk', 'whole milk', 'skim milk'], 244, 244, [50, 3.3, 4.8, 2, 5, 0, 55, 0, 1.2, 0.5, 120, 0, 150, 11, 0.4, 0]],
  ['cheddar', 'Cheddar cheese', DAIRY, ['cheese', 'cheddar', 'cheddar cheese', 'feta', 'feta cheese'], 28, 113, [403, 25, 1.3, 33, 0.5, 0, 265, 0, 0.6, 0.8, 721, 0.7, 98, 28, 3.1, 0.1]],
  ['oat-milk', 'Fortified oat milk', DAIRY, ['oat milk', 'oatmilk'], 240, 240, [48, 1, 6.7, 2, 2.9, 0.8, 0, 0, 1.1, 0.38, 120, 0.3, 160, 5, 0.1, 0.1]],
  ['almond-milk', 'Almond milk', DAIRY, ['almond milk'], 240, 240, [15, 0.6, 0.6, 1.1, 0, 0.2, 63, 0, 1, 0, 184, 0.3, 67, 7, 0.1, 0]],
  ['soy-milk', 'Fortified soy milk', DAIRY, ['soy milk', 'soymilk'], 243, 243, [43, 3.6, 1.7, 2.4, 1, 0.5, 63, 0, 1.1, 1.1, 123, 0.4, 148, 16, 0.3, 0.2]],
  ['coconut-yogurt', 'Coconut yogurt', DAIRY, ['coconut yogurt', 'dairy free yogurt'], 150, 245, [120, 0.5, 6, 10.5, 2, 0.5, 0, 0, 0, 0, 120, 0.2, 40, 5, 0.1, 0]],
  ['butter', 'Butter', DAIRY, ['butter'], 14, 227, [717, 0.9, 0.1, 81, 0.1, 0, 684, 0, 0, 0.2, 24, 0, 24, 2, 0.1, 0.3]],
  ['oats', 'Rolled oats', PANTRY, ['oats', 'rolled oats', 'oatmeal'], 40, 81, [379, 13, 68, 6.5, 1, 10, 0, 0, 0, 0, 52, 4.3, 362, 138, 3.6, 0.1]],
  ['brown-rice', 'Brown rice', PANTRY, ['rice', 'brown rice'], 45, 185, [367, 7.5, 76, 3.2, 0.9, 3.6, 0, 0, 0, 0, 9, 1.5, 250, 143, 2, 0.03]],
  ['quinoa', 'Quinoa', PANTRY, ['quinoa'], 45, 170, [368, 14, 64, 6, 0, 7, 1, 0, 0, 0, 47, 4.6, 563, 197, 3.1, 0.26]],
  ['bread', 'Whole wheat bread', PANTRY, ['bread', 'toast', 'whole wheat bread', 'tortilla', 'wrap'], 32, 45, [252, 12.5, 43, 3.5, 4.4, 6, 0, 0, 0, 0, 161, 2.5, 248, 76, 1.8, 0.1]],
  ['pasta', 'Whole wheat pasta', PANTRY, ['pasta', 'spaghetti', 'penne', 'noodle'], 56, 100, [348, 14.6, 72, 1.4, 2.7, 9, 0, 0, 0, 0, 40, 3.6, 215, 143, 2.4, 0.03]],
  ['lentils', 'Lentils', PANTRY, ['lentil', 'lentils', 'red lentils'], 50, 192, [352, 24.6, 63, 1.1, 2, 10.7, 2, 4.5, 0, 0, 35, 6.5, 677, 47, 3.3, 0.1]],
  ['black-beans', 'Black beans', PANTRY, ['beans', 'black beans', 'kidney beans'], 86, 172, [91, 6, 16.6, 0.3, 0.3, 6.9, 0, 0, 0, 0, 35, 1.9, 308, 48, 0.7, 0.1], 'cans', 240],
  ['chickpeas', 'Chickpeas', PANTRY, ['chickpea', 'chickpeas', 'garbanzo', 'garbanzo beans'], 82, 164, [139, 7, 22.5, 2.6, 0, 6.4, 1, 0.5, 0, 0, 43, 1.5, 172, 29, 1, 0.04], 'cans', 240],
  ['broth', 'Vegetable broth', PANTRY, ['broth', 'stock', 'vegetable broth', 'chicken broth', 'chicken stock', 'vegetable stock'], 240, 240, [6, 0.3, 1, 0.1, 0.5, 0, 10, 0, 0, 0, 4, 0.1, 30, 2, 0, 0]],
  ['olive-oil', 'Olive oil', PANTRY, ['oil', 'olive oil', 'extra virgin olive oil', 'avocado oil'], 14, 216, [884, 0, 0, 100, 0, 0, 0, 0, 0, 0, 1, 0.6, 1, 0, 0, 0.76]],
  ['almonds', 'Almonds', PANTRY, ['almond', 'almonds'], 28, 143, [579, 21, 21.6, 49.9, 4.4, 12.5, 0, 0, 0, 0, 269, 3.7, 733, 270, 3.1, 0]],
  ['walnuts', 'Walnuts', PANTRY, ['walnut', 'walnuts'], 28, 117, [654, 15.2, 13.7, 65.2, 2.6, 6.7, 1, 1.3, 0, 0, 98, 2.9, 441, 158, 3.1, 9.1]],
  ['chia', 'Chia seeds', PANTRY, ['chia', 'chia seeds'], 12, 192, [486, 16.5, 42, 30.7, 0, 34.4, 0, 1.6, 0, 0, 631, 7.7, 407, 335, 4.6, 17.8]],
  ['pumpkin-seeds', 'Pumpkin seeds', PANTRY, ['pumpkin seeds', 'pepitas'], 28, 129, [559, 30, 10.7, 49, 1.4, 6, 1, 1.9, 0, 0, 46, 8.8, 809, 592, 7.8, 0.12]],
  ['peanut-butter', 'Peanut butter', PANTRY, ['peanut butter'], 32, 256, [588, 25, 20, 50, 9.2, 6, 0, 0, 0, 0, 43, 1.9, 649, 154, 2.5, 0.03]],
  ['honey', 'Honey', PANTRY, ['honey', 'maple syrup'], 21, 339, [304, 0.3, 82, 0, 82, 0.2, 0, 0.5, 0, 0, 6, 0.4, 52, 2, 0.2, 0]],
  ['almond-butter', 'Almond butter', PANTRY, ['almond butter', 'cashew butter', 'nut butter'], 32, 256, [614, 21, 19, 56, 4.4, 10, 0, 0, 0, 0, 264, 3.5, 748, 279, 3.3, 0.4]],
  // Allergy-safe substitutes (see ALLERGY_SUBSTITUTES)
  ['sunflower-butter', 'Sunflower seed butter', PANTRY, ['sunflower seed butter', 'sunflower butter', 'sunbutter'], 32, 256, [617, 17.3, 23.3, 55.2, 3, 5.7, 0, 0.2, 0, 0, 64, 4.1, 576, 311, 5.3, 0.07]],
  ['sunflower-seeds', 'Sunflower seeds', PANTRY, ['sunflower seed', 'sunflower seeds'], 28, 140, [584, 20.8, 20, 51.5, 2.6, 8.6, 3, 1.4, 0, 0, 78, 5.3, 645, 325, 5, 0.07]],
  ['hemp-seeds', 'Hemp seeds', PANTRY, ['hemp seed', 'hemp seeds', 'hemp hearts'], 30, 160, [553, 31.6, 8.7, 48.8, 1.5, 4, 1, 0.5, 0, 0, 70, 8, 1200, 700, 9.9, 8.7]],
  ['nutritional-yeast', 'Nutritional yeast', PANTRY, ['nutritional yeast'], 5, 80, [400, 50, 33, 5, 0, 20, 0, 0, 0, 50, 40, 4, 2000, 160, 20, 0]],
  ['gf-oats', 'Certified gluten-free oats', PANTRY, ['gluten free oats', 'certified gluten free oats'], 40, 81, [379, 13, 68, 6.5, 1, 10, 0, 0, 0, 0, 52, 4.3, 362, 138, 3.6, 0.1]],
  ['gf-pasta', 'Gluten-free brown rice pasta', PANTRY, ['gluten free pasta', 'rice pasta', 'brown rice pasta'], 56, 100, [360, 7.5, 76, 2.7, 0.5, 3.4, 0, 0, 0, 0, 10, 1, 200, 90, 1.5, 0]],
  ['gf-bread', 'Gluten-free bread', PANTRY, ['gluten free bread'], 30, 45, [250, 4, 45, 6, 4, 4, 0, 0, 0, 0, 80, 2, 150, 30, 0.6, 0.1]],
  ['coconut-aminos', 'Coconut aminos', PANTRY, ['coconut aminos'], 15, 240, [33, 0, 7, 0, 7, 0, 0, 0, 0, 0, 0, 0, 180, 0, 0, 0]],
  ['soy-sauce', 'Soy sauce', PANTRY, ['soy sauce', 'shoyu'], 16, 255, [53, 8, 4.9, 0.6, 0.4, 0.8, 0, 0, 0, 0, 33, 1.5, 435, 74, 0.4, 0]],
  ['salt', 'Sea salt', SPICES, ['salt', 'sea salt'], 1, 288, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 0.3, 8, 1, 0.1, 0]],
  ['black-pepper', 'Black pepper', SPICES, ['pepper', 'black pepper'], 1, 110, [251, 10, 64, 3.3, 0.6, 25, 27, 0, 0, 0, 443, 9.7, 1329, 171, 1.2, 0.15]],
  ['cumin', 'Ground cumin', SPICES, ['cumin'], 2, 96, [375, 17.8, 44, 22, 2.3, 10.5, 64, 7.7, 0, 0, 931, 66, 1788, 366, 4.8, 0.2]],
  ['cinnamon', 'Cinnamon', SPICES, ['cinnamon'], 3, 125, [247, 4, 81, 1.2, 2.2, 53, 15, 3.8, 0, 0, 1002, 8.3, 431, 60, 1.8, 0.01]],
];

const FOOD_DB = Object.fromEntries(
  FOOD_ROWS.map(([id, name, aisle, aliases, gPerUnit, gPerCup, values, count, gPerCan]) => [
    id,
    {
      id,
      name,
      aisle,
      aliases,
      gPerUnit,
      gPerCup,
      count,
      gPerCan: gPerCan ?? 400,
      nutrients: Object.fromEntries(NUTRIENT_KEYS.map((key, i) => [key, values[i]])),
    },
  ]),
);

/* ---------- Allergens ---------- */

const ALLERGENS = [
  { id: 'peanuts', label: 'Peanuts', option: 'Peanut allergy' },
  { id: 'tree_nuts', label: 'Tree nuts', option: 'Tree nut allergy' },
  { id: 'dairy', label: 'Dairy', option: 'Lactose / dairy' },
  { id: 'gluten', label: 'Gluten', option: 'Gluten sensitivity' },
  { id: 'soy', label: 'Soy', option: 'Soy free' },
  { id: 'eggs', label: 'Eggs', option: 'Egg free' },
];
const ALLERGEN_BY_ID = Object.fromEntries(ALLERGENS.map((a) => [a.id, a]));

/** Allergens contained in dictionary foods (oats are flagged for gluten cross-contact). */
const FOOD_ALLERGENS = {
  'peanut-butter': ['peanuts'],
  'almond-butter': ['tree_nuts'],
  almonds: ['tree_nuts'],
  walnuts: ['tree_nuts'],
  'almond-milk': ['tree_nuts'],
  milk: ['dairy'],
  'greek-yogurt': ['dairy'],
  'cottage-cheese': ['dairy'],
  cheddar: ['dairy'],
  butter: ['dairy'],
  oats: ['gluten'],
  bread: ['gluten'],
  pasta: ['gluten'],
  'soy-sauce': ['soy', 'gluten'],
  tofu: ['soy'],
  'soy-milk': ['soy'],
  eggs: ['eggs'],
};
Object.entries(FOOD_ALLERGENS).forEach(([id, allergens]) => { FOOD_DB[id].allergens = allergens; });
Object.values(FOOD_DB).forEach((food) => { food.allergens ??= []; });

/** Fallback keywords for ingredients the dictionary does not recognize. */
const ALLERGEN_KEYWORDS = {
  peanuts: ['peanut', 'groundnut'],
  tree_nuts: ['cashew', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'pine nut', 'brazil nut', 'praline', 'marzipan', 'nutella'],
  dairy: ['cream', 'ghee', 'whey', 'casein', 'parmesan', 'mozzarella', 'ricotta', 'buttermilk', 'kefir', 'custard'],
  gluten: ['wheat', 'flour', 'barley', 'rye', 'couscous', 'semolina', 'bulgur', 'farro', 'spelt', 'seitan', 'breadcrumb', 'panko', 'cracker'],
  soy: ['soy', 'edamame', 'tempeh', 'miso'],
  eggs: ['egg', 'mayonnaise', 'mayo', 'meringue', 'aioli'],
};
const ALLERGEN_KEYWORD_PATTERNS = Object.fromEntries(Object.entries(ALLERGEN_KEYWORDS)
  .map(([id, words]) => [id, new RegExp(`\\b(?:${words.join('|')})(?:e?s)?\\b`)]));

/**
 * Safe, nutritionally similar substitutes per allergen. `foodId` links to the
 * dictionary so swaps keep accurate nutrition and reach the grocery list.
 * `replaces` limits an option to specific source foods; options without it are
 * generic fallbacks. `gramRatio` scales the original weight.
 */
const ALLERGY_SUBSTITUTES = {
  peanuts: [
    { foodId: 'sunflower-butter', ratio: '1:1', gramRatio: 1, replaces: ['peanut-butter'], note: 'Provides healthy fats and a similar creamy texture.' },
    { foodId: 'pumpkin-seeds', ratio: '1:1', gramRatio: 1, note: 'Matches the crunch and adds magnesium and zinc.' },
  ],
  tree_nuts: [
    { foodId: 'sunflower-butter', ratio: '1:1', gramRatio: 1, replaces: ['almond-butter'], note: 'Seed butter with the same spreadable texture and healthy fats.' },
    { foodId: 'oat-milk', ratio: '1:1', gramRatio: 1, replaces: ['almond-milk'], note: 'Fortified oat milk keeps calcium and vitamin D without nuts.' },
    { foodId: 'sunflower-seeds', ratio: '1:1', gramRatio: 1, note: 'Great substitute for walnuts or pine nuts in pestos and salads.' },
    { foodId: 'hemp-seeds', ratio: '1:1', gramRatio: 1, note: 'Rich in healthy fats, omega-3 and complete protein.' },
    { foodId: 'chickpeas', ratio: '1:1', gramRatio: 1, note: 'Roasted chickpeas offer crunch and protein without nut allergens.' },
  ],
  dairy: [
    { foodId: 'nutritional-yeast', ratio: '1 tbsp per 1/4 cup cheese', gramRatio: 0.18, replaces: ['cheddar'], note: 'Replaces cheesy, umami flavor in savory dishes and adds B12.' },
    { foodId: 'olive-oil', ratio: '3/4 the amount', gramRatio: 0.75, replaces: ['butter'], note: 'Heart-healthy fat for cooking and roasting.' },
    { foodId: 'coconut-yogurt', ratio: '1:1', gramRatio: 1, replaces: ['greek-yogurt', 'cottage-cheese'], note: 'Creamy, calcium-fortified yogurt; much lower in protein, so pair with seeds.' },
    { foodId: 'oat-milk', ratio: '1:1', gramRatio: 1, note: 'Fortified oat milk replaces milk while maintaining calcium and vitamin D.' },
    { foodId: 'soy-milk', ratio: '1:1', gramRatio: 1, note: 'Fortified soy milk is the closest match to dairy milk for protein.' },
  ],
  gluten: [
    { foodId: 'gf-oats', ratio: '1:1', gramRatio: 1, replaces: ['oats'], note: 'Certified gluten-free oats avoid wheat cross-contact with identical nutrition.' },
    { foodId: 'gf-bread', ratio: '1:1', gramRatio: 1, replaces: ['bread'], note: 'Gluten-free loaf for toast and sandwiches.' },
    { foodId: 'gf-pasta', ratio: '1:1', gramRatio: 1, replaces: ['pasta'], note: 'Brown rice pasta keeps complex carbohydrates high.' },
    { foodId: 'coconut-aminos', ratio: '1:1', gramRatio: 1, replaces: ['soy-sauce'], note: 'Wheat- and soy-free seasoning with a similar savory taste.' },
    { foodId: 'quinoa', ratio: '1:1', gramRatio: 1, note: 'Naturally gluten-free grain that keeps complex carbs and adds protein.' },
  ],
  soy: [
    { foodId: 'coconut-aminos', ratio: '1:1', gramRatio: 1, replaces: ['soy-sauce'], note: 'Soy-free seasoning with a similar savory taste.' },
    { foodId: 'oat-milk', ratio: '1:1', gramRatio: 1, replaces: ['soy-milk'], note: 'Fortified oat milk keeps calcium and vitamin D.' },
    { foodId: 'chickpeas', ratio: '1:1', gramRatio: 1, note: 'Plant protein that holds its shape like tofu in bowls and curries.' },
  ],
  eggs: [
    { foodId: 'tofu', ratio: '1:1 by weight', gramRatio: 1, replaces: ['eggs'], note: 'Crumbled firm tofu makes a protein-rich, egg-free scramble.' },
    { foodId: 'chia', ratio: '1 tbsp chia + 3 tbsp water per egg', gramRatio: 0.24, note: 'A “chia egg” binds baked goods and adds omega-3.' },
  ],
};

/** Alias index sorted longest-first so "peanut butter" wins over "butter". */
const ALIAS_INDEX = Object.values(FOOD_DB)
  .flatMap((food) => food.aliases.map((alias) => ({
    id: food.id,
    length: alias.length,
    pattern: new RegExp(`\\b${alias}(?:e?s)?\\b`),
  })))
  .sort((a, b) => b.length - a.length);

const UNIT_ALIASES = {
  g: ['g', 'gr', 'gram', 'grams'],
  kg: ['kg', 'kgs', 'kilogram', 'kilograms'],
  oz: ['oz', 'ounce', 'ounces'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  ml: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
  l: ['l', 'liter', 'liters', 'litre', 'litres'],
  cup: ['c', 'cup', 'cups'],
  tbsp: ['tbsp', 'tbsps', 'tbs', 'tablespoon', 'tablespoons'],
  tsp: ['tsp', 'tsps', 'teaspoon', 'teaspoons'],
  can: ['can', 'cans', 'tin', 'tins'],
  pinch: ['pinch', 'pinches', 'dash', 'dashes'],
  unit: ['piece', 'pieces', 'pc', 'pcs', 'whole', 'large', 'medium', 'small', 'clove', 'cloves',
    'slice', 'slices', 'fillet', 'fillets', 'bunch', 'bunches', 'head', 'heads', 'stalk', 'stalks', 'scoop', 'scoops'],
};
const UNIT_LOOKUP = Object.fromEntries(
  Object.entries(UNIT_ALIASES).flatMap(([unit, aliases]) => aliases.map((alias) => [alias, unit])),
);
const WEIGHT_GRAMS = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };
const UNICODE_FRACTIONS = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8' };
const LIST_MARKER = /^\s*(?:[-*•–]|\d+[.)](?=\s))\s*/;

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = Object.fromEntries(DAYS.map((d) => [d, d[0].toUpperCase() + d.slice(1)]));

const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast', time: '07:30', display: '7:30 AM' },
  { id: 'lunch', label: 'Lunch', time: '12:30', display: '12:30 PM' },
  { id: 'snack', label: 'Afternoon Snack', time: '16:00', display: '4:00 PM' },
  { id: 'dinner', label: 'Dinner', time: '19:00', display: '7:00 PM' },
];
const SLOT_BY_ID = Object.fromEntries(MEAL_SLOTS.map((s) => [s.id, s]));

const SUPPLEMENTS = [
  { id: 'vitaminD3', label: 'Vitamin D3', fatSoluble: true },
  { id: 'vitaminA', label: 'Vitamin A', fatSoluble: true },
  { id: 'vitaminE', label: 'Vitamin E', fatSoluble: true },
  { id: 'vitaminK', label: 'Vitamin K2', fatSoluble: true },
  { id: 'omega3', label: 'Omega-3 fish oil', fatSoluble: true },
  { id: 'multivitamin', label: 'Multivitamin', fatSoluble: true },
  { id: 'iron', label: 'Iron' },
  { id: 'vitaminC', label: 'Vitamin C' },
  { id: 'calcium', label: 'Calcium' },
  { id: 'magnesium', label: 'Magnesium glycinate' },
  { id: 'zinc', label: 'Zinc' },
  { id: 'vitaminB12', label: 'Vitamin B12' },
];
const SUPPLEMENT_BY_ID = Object.fromEntries(SUPPLEMENTS.map((s) => [s.id, s]));

const SEED_RECIPES = [
  {
    id: 'seed-oats', title: 'Berry Chia Overnight Oats', servings: 1,
    ingredientsText: '1/2 cup rolled oats\n1/2 cup milk\n1/2 cup greek yogurt\n1 tbsp chia seeds\n1/2 cup blueberries\n1 tsp honey',
    instructions: 'Stir everything together in a jar.\nRefrigerate overnight and serve cold.',
  },
  {
    id: 'seed-scramble', title: 'Garden Veggie Egg Scramble', servings: 1,
    ingredientsText: '3 large eggs\n1 cup spinach\n1/2 red bell pepper, diced\n1 slice whole wheat bread\n1 tsp olive oil',
    instructions: 'Sauté pepper in oil for 3 minutes.\nAdd spinach until wilted, then scramble in the eggs.\nServe with toast.',
  },
  {
    id: 'seed-salmon', title: 'Lemon Herb Salmon & Quinoa', servings: 2,
    ingredientsText: '2 salmon fillets\n1/2 cup quinoa\n2 cups broccoli\n1 tbsp olive oil\n1 lemon\n2 cloves garlic, minced',
    instructions: 'Cook quinoa in 1 cup water for 15 minutes.\nRoast salmon and broccoli with oil, garlic and lemon at 200°C for 14 minutes.',
  },
  {
    id: 'seed-soup', title: 'Lentil & Spinach Soup', servings: 4,
    ingredientsText: '1 cup red lentils\n4 cups vegetable broth\n1 onion, chopped\n2 carrots, diced\n3 cloves garlic\n3 cups spinach\n1 can diced tomatoes\n1 tsp cumin\n1 tbsp olive oil\n1/2 tsp salt',
    instructions: 'Soften onion, carrot and garlic in oil.\nAdd lentils, broth, tomatoes and cumin; simmer 20 minutes.\nStir in spinach and salt.',
  },
  {
    id: 'seed-chicken', title: 'Roast Chicken & Sweet Potato Plate', servings: 2,
    ingredientsText: '300 g chicken breast\n2 sweet potatoes, cubed\n2 cups broccoli\n1 tbsp olive oil\n1/2 tsp black pepper',
    instructions: 'Toss everything with oil and pepper.\nRoast at 210°C for 25 minutes.',
  },
  {
    id: 'seed-bowl', title: 'Black Bean Burrito Bowl', servings: 2,
    ingredientsText: '1 can black beans, drained\n1/2 cup brown rice\n1 avocado\n1 tomato, diced\n1/4 cup cheddar cheese\n1/2 onion\n1 tsp cumin\n1 lime',
    instructions: 'Cook rice.\nWarm beans with cumin.\nAssemble bowls with avocado, tomato, onion, cheese and lime.',
  },
  {
    id: 'seed-yogurt', title: 'Greek Yogurt Seed Crunch', servings: 1,
    ingredientsText: '1 cup greek yogurt\n1/2 cup strawberries\n1 tbsp pumpkin seeds\n1 tbsp walnuts',
    instructions: 'Layer yogurt, berries, seeds and walnuts in a bowl.',
  },
  {
    id: 'seed-apple', title: 'Apple & Peanut Butter', servings: 1,
    ingredientsText: '1 apple, sliced\n2 tbsp peanut butter\n1 pinch cinnamon',
    instructions: 'Slice apple and serve with peanut butter dusted with cinnamon.',
  },
];

const SEED_PLAN = (() => {
  const rotation = [
    ['seed-oats', 'seed-bowl', 'seed-yogurt', 'seed-salmon'],
    ['seed-scramble', 'seed-soup', 'seed-apple', 'seed-chicken'],
  ];
  return Object.fromEntries(DAYS.map((day, i) => {
    const row = rotation[i % 2];
    return [day, Object.fromEntries(MEAL_SLOTS.map((slot, j) => [slot.id, row[j]]))];
  }));
})();

/** Deterministic sample texts returned by the simulated OCR step. */
const OCR_SAMPLES = [
  'Title: Kale & Chickpea Power Salad\nServings: 2\nIngredients:\n- 3 cups kale\n- 1 can chickpeas, drained\n- 1/2 cup quinoa\n- 1 red bell pepper\n- 2 tbsp olive oil\n- 1 lemon\n- 2 tbsp pumpkin seeds\nInstructions:\n1. Cook quinoa and let it cool.\n2. Massage kale with oil and lemon.\n3. Toss with chickpeas, pepper, quinoa and seeds.',
  'Title: Sheet-Pan Salmon & Sweet Potato\nServes 2\nIngredients\n• 2 salmon fillets (6 oz each)\n• 2 sweet potatoes\n• 2 cups broccoli\n• 1 tbsp olive oil\n• 1/2 tsp black pepper\nDirections\n1. Cube the sweet potatoes and roast 15 minutes at 220°C.\n2. Add salmon and broccoli; roast 12 minutes more.',
  'Title: Peanut Butter Banana Oat Smoothie\nServings: 1\nIngredients:\n- 1 banana\n- 1 cup milk\n- 1/4 cup rolled oats\n- 1 tbsp peanut butter\n- 1 tsp chia seeds\nInstructions:\n1. Blend everything until smooth.',
];

const DEFAULT_PROFILE = {
  units: 'imperial', age: 32, gender: 'female', heightCm: 167.64, weightKg: 68.04,
  activity: 'moderate', goal: 'maintain', allergies: [], bodyFatPct: null, waistCm: null, hipCm: null, updatedAt: null,
};
const DEFAULT_SUPPLEMENTS = { selected: ['vitaminD3', 'iron', 'magnesium'], coffeeAtBreakfast: true };
const DEFAULT_GROCERY = { household: 1, checked: [] };

/* =========================================================
 * 2. Utilities & Storage
 * ======================================================= */

const $ = (selector, root = document) => root.querySelector(selector);

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

/** Formats numbers with sensible precision for display. */
const fmt = (value) => {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 1 : 2;
  return Number(value.toFixed(digits)).toLocaleString('en-US');
};

const emptyNutrients = () => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0]));
const addNutrients = (a, b) => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, a[k] + b[k]]));
const scaleNutrients = (n, factor) => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, n[k] * factor]));

const createId = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const todayKey = () => DAYS[(new Date().getDay() + 6) % 7];

/**
 * localStorage wrapper. User data keys are namespaced per signed-in account
 * ("ubecafe.user:<email>.plan"); guests use the bare keys. Device-wide keys
 * (theme, account registry, session) are never namespaced.
 */
const Storage = {
  KEYS: {
    profile: 'ubecafe.profile',
    recipes: 'ubecafe.recipes',
    plan: 'ubecafe.plan',
    supplements: 'ubecafe.supplements',
    grocery: 'ubecafe.grocery',
    theme: 'ubecafe.theme',
    accounts: 'ubecafe.accounts',
    session: 'ubecafe.session',
  },
  GLOBAL_KEYS: new Set(['ubecafe.theme', 'ubecafe.accounts', 'ubecafe.session']),
  scope: null,

  resolve(key) {
    return this.scope && !this.GLOBAL_KEYS.has(key) ? key.replace('ubecafe.', `ubecafe.user:${this.scope}.`) : key;
  },
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(this.resolve(key));
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(this.resolve(key), JSON.stringify(value));
    } catch {
      /* Storage blocked (private mode / quota): the app keeps working in memory. */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(this.resolve(key));
    } catch {
      /* Nothing to remove when storage is unavailable. */
    }
  },
  /** Deletes every key belonging to one account. */
  removeScope(scope) {
    try {
      const prefix = `ubecafe.user:${scope}.`;
      Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* Nothing to remove when storage is unavailable. */
    }
  },
};

/** Sends a short message to the global polite live region for screen readers. */
const announce = (message) => {
  const region = $('#app-status');
  region.textContent = '';
  window.setTimeout(() => { region.textContent = message; }, 50);
};

/* =========================================================
 * 3. BiometricsEngine
 * ======================================================= */

class BiometricsEngine {
  static ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 };

  static GOALS = {
    loss: { calorieFactor: 0.8, proteinPerKg: 1.8, fatShare: 0.3 },
    maintain: { calorieFactor: 1, proteinPerKg: 1.4, fatShare: 0.3 },
    gain: { calorieFactor: 1.1, proteinPerKg: 2.0, fatShare: 0.25 },
  };

  /** Mifflin-St Jeor: 10·kg + 6.25·cm − 5·age + s (s = +5 male, −161 female, −78 averaged). */
  static bmr({ weightKg, heightCm, age, gender }) {
    const sexOffset = { male: 5, female: -161, other: -78 }[gender];
    return 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  }

  static calculate(profile) {
    const bmr = this.bmr(profile);
    const tdee = bmr * this.ACTIVITY_FACTORS[profile.activity];
    const goal = this.GOALS[profile.goal];
    const calorieFloor = profile.gender === 'male' ? 1500 : 1200;
    const calories = Math.max(calorieFloor, Math.round(tdee * goal.calorieFactor));
    const protein = Math.round(profile.weightKg * goal.proteinPerKg);
    const fat = Math.round((calories * goal.fatShare) / 9);
    const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
    const sugar = Math.round((calories * 0.1) / 4); // WHO: free sugars < 10 % of energy

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targets: {
        calories, protein, carbs, fat, sugar,
        fiber: Math.round((14 * calories) / 1000), // IOM: 14 g per 1,000 kcal
        ...this.micronutrientRDA(profile.age, profile.gender),
      },
    };
  }

  /**
   * Optional body-composition indicators (WHO cut-offs).
   * BMI always; waist-to-hip and waist-to-height when tape measurements exist;
   * lean mass and Katch-McArdle BMR when body fat % is known.
   */
  static bodyComposition({ heightCm, weightKg, gender, bodyFatPct, waistCm, hipCm }) {
    const bmi = weightKg / (heightCm / 100) ** 2;
    let bmiCategory = 'Obesity';
    if (bmi < 18.5) bmiCategory = 'Underweight';
    else if (bmi < 25) bmiCategory = 'Healthy range';
    else if (bmi < 30) bmiCategory = 'Overweight';

    const result = { bmi, bmiCategory };
    if (waistCm && hipCm) {
      const whrLimit = { male: 0.9, female: 0.85, other: 0.875 }[gender];
      result.waistToHip = waistCm / hipCm;
      result.waistToHipRisk = result.waistToHip >= whrLimit ? 'Increased risk' : 'Low risk';
      result.waistToHipLimit = whrLimit;
    }
    if (waistCm) {
      result.waistToHeight = waistCm / heightCm;
      result.waistToHeightRisk = result.waistToHeight >= 0.5 ? 'Increased risk' : 'Low risk';
    }
    if (bodyFatPct) {
      result.leanMassKg = weightKg * (1 - bodyFatPct / 100);
      result.katchBmr = 370 + 21.6 * result.leanMassKg;
    }
    return result;
  }

  /** NIH Dietary Reference Intakes (RDA / AI) by age and sex. */
  static micronutrientRDA(age, gender) {
    const teen = age < 19;
    const senior = age > 70;
    const over50 = age > 50;
    const under31 = age < 31;
    const male = {
      vitaminA: 900, vitaminC: teen ? 75 : 90, vitaminD: senior ? 20 : 15, vitaminB12: 2.4,
      calcium: teen ? 1300 : senior ? 1200 : 1000, iron: teen ? 11 : 8, potassium: teen ? 3000 : 3400,
      magnesium: teen ? 410 : under31 ? 400 : 420, zinc: 11, omega3: 1.6,
    };
    const female = {
      vitaminA: 700, vitaminC: teen ? 65 : 75, vitaminD: senior ? 20 : 15, vitaminB12: 2.4,
      calcium: teen ? 1300 : over50 ? 1200 : 1000, iron: teen ? 15 : over50 ? 8 : 18, potassium: teen ? 2300 : 2600,
      magnesium: teen ? 360 : under31 ? 310 : 320, zinc: teen ? 9 : 8, omega3: 1.1,
    };
    if (gender === 'male') return male;
    if (gender === 'female') return female;
    return Object.fromEntries(Object.keys(male).map((k) => [k, Math.round(((male[k] + female[k]) / 2) * 10) / 10]));
  }
}

/* =========================================================
 * 4. RecipeParser
 * ======================================================= */

class RecipeParser {
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

/* =========================================================
 * 4b. AllergenGuard – detection and hard-exclusion substitution
 * ======================================================= */

class AllergenGuard {
  static #cache = new WeakMap();

  /** Allergens in one parsed ingredient: dictionary tags, else keyword scan. */
  static detect(ingredient) {
    if (ingredient.foodId) return FOOD_DB[ingredient.foodId].allergens;
    const name = ` ${ingredient.name.toLowerCase().replace(/[^a-z\s]/g, ' ')} `;
    return ALLERGENS.filter((a) => ALLERGEN_KEYWORD_PATTERNS[a.id].test(name)).map((a) => a.id);
  }

  /** A substitute that is itself free of every active allergen, preferring food-specific options. */
  static pickSubstitute(allergen, foodId, allergies) {
    const options = ALLERGY_SUBSTITUTES[allergen] ?? [];
    const isSafe = (option) => !FOOD_DB[option.foodId].allergens.some((a) => allergies.includes(a));
    return options.find((o) => o.replaces?.includes(foodId) && isSafe(o))
      ?? options.find((o) => !o.replaces && isSafe(o))
      ?? null;
  }

  /**
   * Returns the recipe analysis with every allergen ingredient swapped for a safe
   * substitute. `isSafe` is false when any allergen has no safe substitute; such
   * recipes are excluded from the plan, dashboard and grocery list.
   */
  static filterRecipeForUser(recipe, allergies) {
    const analysis = RecipeParser.analyze(recipe);
    if (!allergies.length) return { ...analysis, isSafe: true, flagged: [] };

    const key = [...allergies].sort().join('|');
    const byAllergies = this.#cache.get(recipe) ?? new Map();
    this.#cache.set(recipe, byAllergies);
    if (byAllergies.has(key)) return byAllergies.get(key);

    const flagged = [];
    const ingredients = analysis.ingredients.map((ing) => {
      const hits = this.detect(ing).filter((a) => allergies.includes(a));
      if (!hits.length) return ing;
      const original = ing.foodId ? FOOD_DB[ing.foodId].name : ing.name;
      const sub = hits.map((a) => this.pickSubstitute(a, ing.foodId, allergies)).find(Boolean) ?? null;
      flagged.push({
        raw: ing.raw,
        original,
        allergens: hits,
        substitute: sub && { name: FOOD_DB[sub.foodId].name, ratio: sub.ratio, note: sub.note },
      });
      if (!sub) return { ...ing, blocked: true, nutrients: emptyNutrients() };
      const grams = ing.grams * sub.gramRatio;
      return {
        ...ing,
        foodId: sub.foodId,
        grams,
        nutrients: scaleNutrients(FOOD_DB[sub.foodId].nutrients, grams / 100),
        swappedFrom: original,
      };
    });

    const totals = ingredients.reduce((sum, ing) => addNutrients(sum, ing.nutrients), emptyNutrients());
    const result = {
      ingredients,
      totals,
      perServing: scaleNutrients(totals, 1 / Math.max(1, Number(recipe.servings) || 1)),
      unmatched: analysis.unmatched,
      isSafe: flagged.every((f) => f.substitute),
      flagged,
    };
    byAllergies.set(key, result);
    return result;
  }

  /** Accessible allergen badge (icon + text, never color alone). */
  static badge(allergens, level = 'warn') {
    const labels = allergens.map((a) => ALLERGEN_BY_ID[a].label).join(', ');
    return `<span class="badge badge--${level}"><span aria-hidden="true">${level === 'danger' ? '✕' : '!'}</span><span class="sr-only">Allergen warning:</span> ${labels}</span>`;
  }
}

/* =========================================================
 * 5. RecommendationEngine – explicit if/else rules
 * ======================================================= */

class RecommendationEngine {
  /** Allergens carried by foods named in recommendations. */
  static FOOD_ALLERGENS = {
    'Oats with Nut Butter': ['gluten', 'peanuts', 'tree_nuts'],
    'Greek Yogurt': ['dairy'],
    'Cottage Cheese': ['dairy'],
    'Plain Yogurt': ['dairy'],
    'Fortified Milk': ['dairy'],
    Eggs: ['eggs'],
    'Firm Tofu': ['soy'],
    Almonds: ['tree_nuts'],
    Walnuts: ['tree_nuts'],
  };

  /** Removes foods containing active allergens; returns the safe names and the ones left out. */
  static safeFoods(foodList, allergies) {
    const names = foodList.split(' / ');
    const isSafe = (name) => !(this.FOOD_ALLERGENS[name] ?? []).some((a) => allergies.includes(a));
    return { safe: names.filter(isSafe), removed: names.filter((n) => !isSafe(n)) };
  }

  static recommend(intake, targets, mealsPlanned, allergies = []) {
    if (mealsPlanned === 0) {
      return [{
        food: 'Plan your first meal',
        reason: 'Add recipes to this day in the Weekly Meal Plan so the engine can compare your intake against your targets.',
        trigger: 'No meals planned',
        priority: 'info',
      }];
    }

    const recs = [];
    const ratio = (key) => (targets[key] > 0 ? intake[key] / targets[key] : 1);
    /** Adds a rule's output, swapping in `alternative` foods when every option conflicts with an allergy. */
    const add = (key, foods, reason, alternative) => {
      let { safe, removed } = this.safeFoods(foods, allergies);
      if (!safe.length && alternative) safe = this.safeFoods(alternative, allergies).safe;
      if (!safe.length) return;
      const r = ratio(key);
      recs.push({
        food: safe.join(' / '),
        reason,
        allergyNote: removed.length ? `Adjusted for your allergies: left out ${removed.join(', ')}.` : '',
        trigger: `${NUTRIENT_BY_KEY[key].label} at ${Math.round(r * 100)}% of ${NUTRIENT_BY_KEY[key].isLimit ? 'your daily limit' : 'target'}`,
        priority: r < 0.5 || r > 1.25 ? 'high' : 'medium',
      });
    };

    // Energy balance
    if (ratio('calories') < 0.8) {
      add('calories', 'Oats with Nut Butter / Avocado', 'Nutrient-dense calories with fiber and healthy fats close your energy gap without a sugar spike.');
    } else if (ratio('calories') > 1.1) {
      add('calories', 'Leafy Greens / Broth-Based Soups', 'High-volume, low-calorie foods keep you full while trimming the day back toward your energy target.');
    }

    // Protein, with carb context
    if (ratio('protein') < 0.8 && intake.carbs >= targets.carbs) {
      add('protein', 'Greek Yogurt / Cottage Cheese', 'High-protein, low-carb boost to meet muscle protein synthesis targets.', 'Hemp Seeds / Canned Tuna');
    } else if (ratio('protein') < 0.8) {
      add('protein', 'Chicken Breast / Eggs / Firm Tofu', 'Complete protein sources that close your protein deficit while leaving room for the carbohydrates you still need.');
    }

    // Limits
    if (intake.fat > targets.fat * 1.15) {
      add('fat', 'Lean Proteins / Steamed Vegetables', 'Swap fried or oil-heavy sides for lean, steamed options to bring total fat back within range.');
    }
    if (intake.sugar > targets.sugar) {
      add('sugar', 'Fresh Berries / Plain Yogurt', 'Replace sweetened snacks with whole fruit and unsweetened dairy to cut added sugar while keeping sweetness.');
    }

    // Micronutrients
    if (ratio('fiber') < 0.7) {
      add('fiber', 'Chia Seeds / Black Beans', 'Soluble and insoluble fiber support digestion, cholesterol and steady blood sugar.');
    }
    if (ratio('iron') < 0.7) {
      add('iron', 'Spinach / Lentils', 'Provides plant-based bioavailable iron to close your current deficit without excess saturated fat.');
    }
    if (ratio('vitaminC') < 0.7) {
      add('vitaminC', 'Red Bell Pepper / Kiwi / Strawberries', 'Vitamin C supports immunity and multiplies non-heme iron absorption when eaten in the same meal.');
    }
    if (ratio('vitaminD') < 0.7) {
      add('vitaminD', 'Salmon / Sardines / Fortified Milk', 'Few foods contain vitamin D; oily fish and fortified dairy are the most reliable dietary sources.');
    }
    if (ratio('vitaminB12') < 0.7) {
      add('vitaminB12', 'Eggs / Salmon / Greek Yogurt', 'B12 is found almost only in animal foods and is essential for nerve function and red blood cells.');
    }
    if (ratio('calcium') < 0.7) {
      add('calcium', 'Greek Yogurt / Kale / Firm Tofu', 'Calcium-rich foods protect bone density; calcium-set tofu and kale are strong dairy-free options.');
    }
    if (ratio('potassium') < 0.7) {
      add('potassium', 'Banana / Sweet Potato / Avocado', 'Potassium balances sodium to support healthy blood pressure and muscle contraction.');
    }
    if (ratio('magnesium') < 0.7) {
      add('magnesium', 'Pumpkin Seeds / Almonds', 'Among the densest magnesium sources, supporting sleep quality, muscle relaxation and energy metabolism.');
    }
    if (ratio('zinc') < 0.7) {
      add('zinc', 'Pumpkin Seeds / Lean Beef / Chickpeas', 'Zinc supports immune function and wound healing; pair plant sources with protein for better absorption.');
    }
    if (ratio('omega3') < 0.7) {
      add('omega3', 'Salmon / Chia Seeds / Walnuts', 'Omega-3 fatty acids support heart and brain health and help moderate inflammation.');
    }
    if (ratio('vitaminA') < 0.7) {
      add('vitaminA', 'Sweet Potato / Carrots', 'Beta-carotene converts to vitamin A for vision and immunity; eat with a little fat for absorption.');
    }

    if (recs.length === 0) {
      return [{
        food: 'Keep doing what you are doing',
        reason: 'Every tracked macro and micronutrient is within range for this day. Maintain variety across the week.',
        trigger: 'All targets met',
        priority: 'info',
      }];
    }
    const order = { high: 0, medium: 1 };
    return recs.sort((a, b) => order[a.priority] - order[b.priority]);
  }
}

/* =========================================================
 * 6. ScheduleOptimizer – supplement timing rules
 * ======================================================= */

class ScheduleOptimizer {
  /**
   * @param {Object<string, {recipe, nutrients}|null>} meals – keyed by slot id
   * @param {string[]} selected – supplement ids
   * @param {boolean} coffeeAtBreakfast
   */
  static build(meals, selected, coffeeAtBreakfast) {
    const plan = Object.fromEntries(MEAL_SLOTS.map((s) => [s.id, []]));
    const has = (id) => selected.includes(id);
    const n = (slotId, key) => meals[slotId]?.nutrients[key] ?? 0;

    // Rule 1: fat-soluble nutrients go with the highest-fat meal (Dinner on ties / empty days).
    const fatSlot = [...MEAL_SLOTS].reverse()
      .reduce((best, slot) => (n(slot.id, 'fat') > n(best, 'fat') ? slot.id : best), 'dinner');
    const fatGrams = fmt(n(fatSlot, 'fat'));
    selected.filter((id) => SUPPLEMENT_BY_ID[id].fatSoluble).forEach((id) => {
      plan[fatSlot].push({
        id,
        reason: `Fat-soluble: taken with your highest-fat meal (${fatGrams} g fat) so it is absorbed with dietary fat.`,
      });
    });

    // Rule 2: iron goes with the most vitamin C, away from coffee and calcium.
    let ironSlot = null;
    if (has('iron')) {
      const candidates = MEAL_SLOTS.filter((s) => !(coffeeAtBreakfast && s.id === 'breakfast'));
      ironSlot = candidates.reduce((best, slot) => {
        const score = (id) => n(id, 'vitaminC') - n(id, 'calcium') / 10;
        return score(slot.id) > score(best.id) ? slot : best;
      }, candidates.find((s) => s.id === 'lunch')).id;
      const coffeeNote = coffeeAtBreakfast ? ' Kept away from breakfast coffee, whose polyphenols block absorption.' : '';
      plan[ironSlot].push({
        id: 'iron',
        reason: `Paired with ${fmt(n(ironSlot, 'vitaminC'))} mg vitamin C and only ${fmt(n(ironSlot, 'calcium'))} mg calcium in this meal; vitamin C boosts non-heme iron uptake.${coffeeNote}`,
      });
    }

    // Rule 3: vitamin C rides along with iron when both are taken.
    if (has('vitaminC')) {
      const slot = ironSlot ?? 'breakfast';
      plan[slot].push({
        id: 'vitaminC',
        reason: ironSlot ? 'Taken alongside iron to maximize iron absorption.' : 'Water-soluble; morning dosing with food is easy on the stomach.',
      });
    }

    // Rule 4: calcium is separated from iron.
    let calciumSlot = null;
    if (has('calcium')) {
      calciumSlot = ['snack', 'lunch', 'breakfast', 'dinner'].find((id) => id !== ironSlot);
      plan[calciumSlot].push({
        id: 'calcium',
        reason: ironSlot
          ? `Separated from iron (${SLOT_BY_ID[ironSlot].label}) because calcium competes for the same absorption pathway.`
          : 'Split from your largest meals to improve absorption of smaller calcium doses.',
      });
    }

    // Rule 5: magnesium in the evening for sleep and recovery.
    if (has('magnesium')) {
      plan.dinner.push({ id: 'magnesium', reason: 'Evening dose supports muscle recovery and relaxation before sleep.' });
    }

    // Rule 6: zinc away from both iron and calcium.
    if (has('zinc')) {
      const slot = ['lunch', 'dinner', 'breakfast', 'snack'].find((id) => id !== ironSlot && id !== calciumSlot);
      plan[slot].push({ id: 'zinc', reason: 'Kept apart from iron and calcium, which compete with zinc for absorption; taken with food to avoid nausea.' });
    }

    // Rule 7: B12 in the morning.
    if (has('vitaminB12')) {
      plan.breakfast.push({ id: 'vitaminB12', reason: 'Water-soluble and involved in energy metabolism, so it fits best in the morning.' });
    }

    return plan;
  }

  /** Food-based synergy tips for a single meal. */
  static mealTips(slotId, meal, coffeeAtBreakfast) {
    if (!meal) return [];
    const tips = [];
    const { iron, vitaminC, fat, vitaminA } = meal.nutrients;
    if (iron >= 3 && vitaminC < 25) tips.push('Iron-rich meal: add bell pepper, citrus or strawberries to boost absorption.');
    if (slotId === 'breakfast' && coffeeAtBreakfast && iron >= 3) tips.push('Wait about an hour after this meal before drinking coffee.');
    if (vitaminA >= 300 && fat < 5) tips.push('Add a little olive oil or avocado to absorb the vitamin A in this meal.');
    return tips;
  }
}

/* =========================================================
 * 7. GroceryAggregator
 * ======================================================= */

class GroceryAggregator {
  /**
   * @param {(recipe) => {isSafe: boolean, ingredients: Array}} analyze – allergy-aware analyzer;
   *   unsafe recipes are skipped and substituted ingredients are bought instead of the originals.
   */
  static aggregate(plan, recipesById, household, supplementIds, analyze) {
    const items = new Map();

    DAYS.forEach((day) => MEAL_SLOTS.forEach((slot) => {
      const recipe = recipesById.get(plan[day]?.[slot.id]);
      if (!recipe) return;
      const analysis = analyze(recipe);
      if (!analysis.isSafe) return;
      const factor = household / Math.max(1, recipe.servings);
      analysis.ingredients.forEach((ing) => {
        if (ing.foodId) {
          const food = FOOD_DB[ing.foodId];
          const entry = items.get(food.id) ?? { key: food.id, name: food.name, aisle: food.aisle, grams: 0, food, replaces: new Set() };
          entry.grams += ing.grams * factor;
          if (ing.swappedFrom) entry.replaces.add(ing.swappedFrom.toLowerCase());
          items.set(food.id, entry);
        } else {
          const key = `x:${ing.name.toLowerCase().replace(/[^a-z]+/g, '-')}:${ing.unit ?? 'unit'}`;
          const entry = items.get(key) ?? { key, name: ing.name, aisle: PANTRY, qty: 0, unit: ing.unit };
          entry.qty += ing.qty * factor;
          items.set(key, entry);
        }
      });
    }));

    supplementIds.forEach((id) => {
      items.set(`s:${id}`, { key: `s:${id}`, name: SUPPLEMENT_BY_ID[id].label, aisle: SPICES, note: 'check supply' });
    });

    return AISLES.map((aisle) => ({
      aisle,
      items: [...items.values()]
        .filter((item) => item.aisle === aisle)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({ ...item, amount: this.formatAmount(item) })),
    })).filter((group) => group.items.length > 0);
  }

  static formatAmount(item) {
    if (item.note) return item.note;
    if (item.grams === undefined) {
      const qty = Math.round(item.qty * 100) / 100;
      return item.unit && item.unit !== 'unit' ? `${qty} ${item.unit}` : `${qty}×`;
    }
    const grams = item.grams > 50 ? Math.round(item.grams / 5) * 5 : Math.max(1, Math.round(item.grams));
    const weight = grams >= 1000 ? `${fmt(grams / 1000)} kg` : `${grams} g`;
    if (item.food.count) {
      const size = item.food.count === 'cans' ? item.food.gPerCan : item.food.gPerUnit;
      return `${Math.ceil(item.grams / size - 0.15)} ${item.food.count} (${weight})`;
    }
    return weight;
  }
}

/* =========================================================
 * 8. AccountManager – local, per-device user accounts
 *
 * Accounts let several people share one browser with separate profiles,
 * recipes and plans. Credentials never leave the device: each password is
 * salted and stretched with PBKDF2-SHA-256 (Web Crypto) and only the hash is
 * stored. This is privacy separation, not server-grade security: anyone with
 * access to the browser's storage can read the (unencrypted) nutrition data.
 * ======================================================= */

class AccountManager {
  static ITERATIONS = 210000; // OWASP 2023 recommendation for PBKDF2-HMAC-SHA256

  static normalize(email) {
    return email.trim().toLowerCase();
  }

  static registry() {
    return Storage.load(Storage.KEYS.accounts, {});
  }

  static toBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  static fromBase64(text) {
    return Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
  }

  static async derive(password, salt, iterations) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
    return this.toBase64(bits);
  }

  /**
   * Signs in to an existing account (verifying the password) or creates a new one.
   * @returns {Promise<{email: string, created: boolean}>}
   * @throws {Error} message 'unsupported' | 'wrong-password'
   */
  static async signInOrCreate(rawEmail, password) {
    if (!window.crypto?.subtle) throw new Error('unsupported');
    const email = this.normalize(rawEmail);
    const accounts = this.registry();
    const existing = accounts[email];

    if (existing) {
      const hash = await this.derive(password, this.fromBase64(existing.salt), existing.iterations);
      if (hash !== existing.hash) throw new Error('wrong-password');
      return { email, created: false };
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    accounts[email] = {
      salt: this.toBase64(salt),
      hash: await this.derive(password, salt, this.ITERATIONS),
      iterations: this.ITERATIONS,
      createdAt: new Date().toISOString(),
    };
    Storage.save(Storage.KEYS.accounts, accounts);
    return { email, created: true };
  }

  static restoreSession() {
    const email = Storage.load(Storage.KEYS.session, null);
    return email && this.registry()[email] ? email : null;
  }

  static deleteAccount(email) {
    const accounts = this.registry();
    delete accounts[email];
    Storage.save(Storage.KEYS.accounts, accounts);
    Storage.removeScope(email);
  }
}

/* =========================================================
 * 9. Application state & UI controllers
 * ======================================================= */

/** Reads the active scope's (guest or account) data, falling back to seeds. */
const loadUserData = () => ({
  profile: { ...DEFAULT_PROFILE, ...Storage.load(Storage.KEYS.profile, {}) },
  recipes: Storage.load(Storage.KEYS.recipes, SEED_RECIPES),
  plan: Storage.load(Storage.KEYS.plan, SEED_PLAN),
  supplements: Storage.load(Storage.KEYS.supplements, DEFAULT_SUPPLEMENTS),
  grocery: Storage.load(Storage.KEYS.grocery, DEFAULT_GROCERY),
});

/** Writes all user data to the active scope (used when a new account adopts guest data). */
const saveUserData = () => {
  ['profile', 'recipes', 'plan', 'supplements', 'grocery'].forEach((key) => Storage.save(Storage.KEYS[key], state[key]));
};

const state = {
  ...loadUserData(),
  viewDay: todayKey(),
  editingId: null,
};

const recipesById = () => new Map(state.recipes.map((r) => [r.id, r]));
const currentTargets = () => BiometricsEngine.calculate(state.profile);

/** Returns each slot's planned recipe and per-serving nutrients for a day. */
/** Recipe analysis with the active user's allergy substitutions applied. */
const analyzeForUser = (recipe) => AllergenGuard.filterRecipeForUser(recipe, state.profile.allergies);

/**
 * Returns each slot's planned recipe and per-serving nutrients for a day.
 * Recipes that cannot be made allergy-safe are marked `blocked` and contribute nothing.
 */
const mealsForDay = (day) => {
  const byId = recipesById();
  return Object.fromEntries(MEAL_SLOTS.map((slot) => {
    const recipe = byId.get(state.plan[day]?.[slot.id]);
    if (!recipe) return [slot.id, null];
    const analysis = analyzeForUser(recipe);
    return [slot.id, {
      recipe,
      blocked: !analysis.isSafe,
      flagged: analysis.flagged,
      nutrients: analysis.isSafe ? analysis.perServing : emptyNutrients(),
    }];
  }));
};

/* ---------- Profile & targets ---------- */

const ProfileUI = {
  form: null,
  /** Tape-measure limits per unit system (waist & hip share the same range). */
  LENGTH_LIMITS: { metric: { min: 40, max: 200, step: 0.1, label: 'cm' }, imperial: { min: 16, max: 80, step: 0.1, label: 'in' } },

  init() {
    this.form = $('#profile-form');
    $('#allergy-options').innerHTML = ALLERGENS.map((a) => `
      <div class="check">
        <input type="checkbox" id="allergy-${a.id}" name="allergy" value="${a.id}">
        <label for="allergy-${a.id}">${a.option}</label>
      </div>`).join('');
    this.fill(state.profile);
    this.form.addEventListener('change', (e) => {
      if (e.target.name === 'units') this.switchUnits(e.target.value);
      if (e.target.name === 'allergy') this.applyAllergies();
    });
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
  },

  fill(profile) {
    const f = this.form.elements;
    const toLength = (cm) => (cm ? Math.round((profile.units === 'metric' ? cm : cm / 2.54) * 10) / 10 : '');
    f.units.value = profile.units;
    f.age.value = profile.age;
    f.gender.value = profile.gender;
    f.activity.value = profile.activity;
    f.goal.value = profile.goal;
    f['height-cm'].value = Math.round(profile.heightCm * 10) / 10;
    f['weight-kg'].value = Math.round(profile.weightKg * 10) / 10;
    const totalInches = profile.heightCm / 2.54;
    f['height-ft'].value = Math.floor(totalInches / 12);
    f['height-in'].value = Math.round((totalInches % 12) * 10) / 10;
    f['weight-lb'].value = Math.round((profile.weightKg / 0.45359237) * 10) / 10;
    f['body-fat'].value = profile.bodyFatPct ?? '';
    this.form.querySelectorAll('input[name="allergy"]').forEach((box) => { box.checked = profile.allergies.includes(box.value); });
    f.waist.value = toLength(profile.waistCm);
    f.hip.value = toLength(profile.hipCm);
    this.toggleUnitFields(profile.units);
    this.renderSavedNote(profile);
  },

  toggleUnitFields(units) {
    this.form.querySelectorAll('[data-units]').forEach((group) => {
      group.hidden = group.dataset.units !== units;
    });
    const limits = this.LENGTH_LIMITS[units];
    this.form.querySelectorAll('[data-length]').forEach((input) => {
      Object.assign(input, { min: limits.min, max: limits.max, step: limits.step });
    });
    this.form.querySelectorAll('[data-length-unit]').forEach((el) => { el.textContent = `(${limits.label})`; });
  },

  /** Converts the visible values so switching units never loses data. */
  switchUnits(units) {
    const f = this.form.elements;
    const convertLength = (input, factor) => {
      if (Number(input.value) > 0) input.value = Math.round(Number(input.value) * factor * 10) / 10;
    };
    if (units === 'metric') {
      const inches = Number(f['height-ft'].value) * 12 + Number(f['height-in'].value);
      if (inches > 0) f['height-cm'].value = Math.round(inches * 25.4) / 10;
      if (Number(f['weight-lb'].value) > 0) f['weight-kg'].value = Math.round(Number(f['weight-lb'].value) * 4.5359237) / 10;
      [f.waist, f.hip].forEach((input) => convertLength(input, 2.54));
    } else {
      const cm = Number(f['height-cm'].value);
      if (cm > 0) {
        const inches = cm / 2.54;
        f['height-ft'].value = Math.floor(inches / 12);
        f['height-in'].value = Math.round((inches % 12) * 10) / 10;
      }
      if (Number(f['weight-kg'].value) > 0) f['weight-lb'].value = Math.round((Number(f['weight-kg'].value) / 0.45359237) * 10) / 10;
      [f.waist, f.hip].forEach((input) => convertLength(input, 1 / 2.54));
    }
    this.toggleUnitFields(units);
  },

  /** Validates visible numeric fields; optional fields may be left blank. */
  validate() {
    const inputs = [...this.form.querySelectorAll('input[type="number"]')]
      .filter((input) => !input.closest('[hidden]'));
    let firstInvalid = null;
    inputs.forEach((input) => {
      const error = $(`#${input.id}-error`);
      const value = Number(input.value);
      const blankOptional = input.value === '' && !input.required;
      const valid = blankOptional || (input.value !== '' && value >= Number(input.min) && value <= Number(input.max));
      input.setAttribute('aria-invalid', String(!valid));
      error.textContent = valid ? '' : `Enter a number between ${input.min} and ${input.max}${input.required ? '' : ', or leave it blank'}.`;
      if (!valid && !firstInvalid) firstInvalid = input;
    });
    return firstInvalid;
  },

  submit() {
    const invalid = this.validate();
    if (invalid) {
      invalid.focus();
      announce('Please fix the highlighted fields.');
      return;
    }
    const f = this.form.elements;
    const units = f.units.value;
    const optional = (input, factor = 1) => (input.value === '' ? null : Math.round(Number(input.value) * factor * 10) / 10);
    const lengthFactor = units === 'metric' ? 1 : 2.54;
    state.profile = {
      units,
      age: Number(f.age.value),
      gender: f.gender.value,
      activity: f.activity.value,
      goal: f.goal.value,
      heightCm: units === 'metric'
        ? Number(f['height-cm'].value)
        : (Number(f['height-ft'].value) * 12 + Number(f['height-in'].value)) * 2.54,
      weightKg: units === 'metric' ? Number(f['weight-kg'].value) : Number(f['weight-lb'].value) * 0.45359237,
      allergies: this.readAllergies(),
      bodyFatPct: optional(f['body-fat']),
      waistCm: optional(f.waist, lengthFactor),
      hipCm: optional(f.hip, lengthFactor),
      updatedAt: new Date().toISOString(),
    };
    Storage.save(Storage.KEYS.profile, state.profile);
    this.renderSavedNote(state.profile);
    App.renderNutrition();
    const where = AccountUI.email ? ` to ${AccountUI.email}` : ' on this device';
    announce(`Profile saved${where}. Targets updated: ${fmt(currentTargets().targets.calories)} calories per day.`);
  },

  readAllergies() {
    return [...this.form.querySelectorAll('input[name="allergy"]:checked')].map((box) => box.value);
  },

  /** Allergy toggles apply immediately: re-screens every recipe, the plan and the grocery list. */
  applyAllergies() {
    state.profile = { ...state.profile, allergies: this.readAllergies() };
    Storage.save(Storage.KEYS.profile, state.profile);
    App.renderRecipesChanged();
    const results = state.recipes.map(analyzeForUser);
    const swapped = results.filter((r) => r.isSafe && r.flagged.length).length;
    const blocked = results.filter((r) => !r.isSafe).length;
    const labels = state.profile.allergies.map((a) => ALLERGEN_BY_ID[a].label.toLowerCase());
    announce(labels.length
      ? `Allergies set: ${labels.join(', ')}. ${swapped} recipe${swapped === 1 ? '' : 's'} adjusted with safe swaps${blocked ? `, ${blocked} excluded` : ''}.`
      : 'All allergy filters cleared.');
  },

  renderSavedNote(profile) {
    const note = $('#profile-saved');
    if (!profile.updatedAt) {
      note.textContent = '';
      return;
    }
    const when = new Date(profile.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    note.textContent = `Last saved ${when}${AccountUI.email ? ` to ${AccountUI.email}` : ' as guest'}.`;
  },

  renderBodyComposition() {
    const c = BiometricsEngine.bodyComposition(state.profile);
    const metric = state.profile.units === 'metric';
    const rows = [['BMI', fmt(c.bmi), c.bmiCategory]];
    if (c.waistToHip) rows.push(['Waist-to-hip ratio', c.waistToHip.toFixed(2), `${c.waistToHipRisk} (WHO cut-off ${c.waistToHipLimit})`]);
    if (c.waistToHeight) rows.push(['Waist-to-height ratio', c.waistToHeight.toFixed(2), `${c.waistToHeightRisk} (cut-off 0.5)`]);
    if (c.leanMassKg) {
      const lean = metric ? `${fmt(c.leanMassKg)} kg` : `${fmt(c.leanMassKg / 0.45359237)} lb`;
      rows.push(['Lean body mass', lean, `From ${fmt(state.profile.bodyFatPct)}% body fat`]);
      rows.push(['BMR (Katch-McArdle)', `${fmt(c.katchBmr)} kcal`, 'Lean-mass estimate, for comparison']);
    }
    return `
      <div class="table-wrap">
        <table class="data-table">
          <caption>Body composition</caption>
          <thead><tr><th scope="col">Measure</th><th scope="col">Value</th><th scope="col">Interpretation</th></tr></thead>
          <tbody>${rows.map(([label, value, note]) => `<tr><th scope="row">${label}</th><td>${value}</td><td>${note}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      ${rows.length === 1 ? '<p class="field__hint">Add body fat %, waist and hip measurements for more indicators.</p>' : ''}`;
  },

  renderTargets() {
    const { bmr, tdee, targets } = currentTargets();
    const rows = NUTRIENTS.map((meta) => `
      <tr>
        <th scope="row">${meta.label}${meta.isLimit ? ' (max)' : ''}</th>
        <td>${fmt(targets[meta.key])} ${meta.unit}</td>
      </tr>`).join('');
    $('#targets-output').innerHTML = `
      <div class="stat-row">
        <p class="stat"><span class="stat__value">${fmt(targets.calories)}</span><span class="stat__label">Daily calories</span></p>
        <p class="stat"><span class="stat__value">${fmt(bmr)}</span><span class="stat__label">BMR (kcal)</span></p>
        <p class="stat"><span class="stat__value">${fmt(tdee)}</span><span class="stat__label">TDEE (kcal)</span></p>
      </div>
      ${this.renderBodyComposition()}
      <div class="table-wrap">
        <table class="data-table">
          <caption>Your daily nutrition targets</caption>
          <thead><tr><th scope="col">Nutrient</th><th scope="col">Daily target</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },
};

/* ---------- Dashboard ---------- */

const DashboardUI = {
  init() {
    const select = $('#view-day');
    select.innerHTML = DAYS.map((d) => `<option value="${d}">${DAY_LABELS[d]}${d === todayKey() ? ' (today)' : ''}</option>`).join('');
    select.value = state.viewDay;
    select.addEventListener('change', () => {
      state.viewDay = select.value;
      App.renderNutrition();
    });
  },

  status(meta, pct) {
    if (meta.isLimit) return pct <= 100 ? ['ok', 'Within limit'] : ['danger', 'Over limit'];
    if (meta.key === 'calories') {
      if (pct < 80) return ['warn', 'Under target'];
      return pct > 110 ? ['warn', 'Over target'] : ['ok', 'On target'];
    }
    if (meta.group === 'macro') {
      if (pct < 80) return ['warn', 'Low'];
      return pct > 125 && meta.key !== 'protein' ? ['warn', 'High'] : ['ok', 'On target'];
    }
    if (pct < 50) return ['danger', 'Deficient'];
    return pct < 80 ? ['warn', 'Low'] : ['ok', 'Met'];
  },

  row(meta, value, target) {
    const pct = target > 0 ? Math.round((value / target) * 100) : 0;
    const width = Math.min(pct, 100);
    const [level, text] = this.status(meta, pct);
    const icon = { ok: '✓', warn: '!', danger: '✕' }[level];
    const labelId = `nutrient-${meta.key}`;
    return `
      <li class="nutrient">
        <div class="nutrient__head">
          <span class="nutrient__label" id="${labelId}">${meta.label}</span>
          <span class="nutrient__value">${fmt(value)} / ${fmt(target)} ${meta.unit}</span>
          <span class="badge badge--${level}"><span aria-hidden="true">${icon}</span><span class="sr-only">Status:</span> ${text}</span>
        </div>
        <div class="bar" role="progressbar" aria-labelledby="${labelId}" aria-valuemin="0" aria-valuemax="100"
             aria-valuenow="${width}" aria-valuetext="${fmt(value)} of ${fmt(target)} ${meta.unit}, ${pct}% of ${meta.isLimit ? 'limit' : 'target'}">
          <span class="bar__fill bar__fill--${level}" style="width:${width}%"></span>
        </div>
      </li>`;
  },

  render() {
    const meals = mealsForDay(state.viewDay);
    const planned = Object.values(meals).filter((meal) => meal && !meal.blocked);
    const intake = planned.reduce((sum, m) => addNutrients(sum, m.nutrients), emptyNutrients());
    const { targets } = currentTargets();
    const lowCount = NUTRIENTS.filter((m) => m.group === 'micro' && intake[m.key] < targets[m.key] * 0.8).length;

    $('#dashboard-summary').textContent =
      `${DAY_LABELS[state.viewDay]}: ${planned.length} of ${MEAL_SLOTS.length} meals planned, ${fmt(intake.calories)} kcal. ` +
      `${lowCount} micronutrient${lowCount === 1 ? '' : 's'} below 80% of target.`;
    $('#macro-list').innerHTML = NUTRIENTS.filter((m) => m.group === 'macro').map((m) => this.row(m, intake[m.key], targets[m.key])).join('');
    $('#micro-list').innerHTML = NUTRIENTS.filter((m) => m.group === 'micro').map((m) => this.row(m, intake[m.key], targets[m.key])).join('');
    document.querySelectorAll('[data-day-label]').forEach((el) => { el.textContent = DAY_LABELS[state.viewDay]; });

    return { intake, targets, plannedCount: planned.length, meals };
  },
};

/* ---------- Recommendations ---------- */

const RecommendationsUI = {
  render({ intake, targets, plannedCount }) {
    const recs = RecommendationEngine.recommend(intake, targets, plannedCount, state.profile.allergies);
    const label = { high: 'High priority', medium: 'Suggested', info: 'Note' };
    $('#recommendation-list').innerHTML = recs.map((rec) => `
      <li>
        <article class="card rec rec--${rec.priority}">
          <p class="rec__priority"><span class="badge badge--${rec.priority === 'high' ? 'danger' : rec.priority === 'medium' ? 'warn' : 'ok'}">${label[rec.priority]}</span></p>
          <h3 class="rec__food">${escapeHTML(rec.food)}</h3>
          <p class="rec__trigger"><strong>Why now:</strong> ${escapeHTML(rec.trigger)}</p>
          <p>${escapeHTML(rec.reason)}</p>
          ${rec.allergyNote ? `<p class="rec__allergy">${escapeHTML(rec.allergyNote)}</p>` : ''}
        </article>
      </li>`).join('');
  },
};

/* ---------- Schedule & supplements ---------- */

const ScheduleUI = {
  init() {
    this.syncForm();
    $('#supplement-form').addEventListener('change', () => {
      state.supplements = {
        selected: [...document.querySelectorAll('input[name="supplements"]:checked')].map((i) => i.value),
        coffeeAtBreakfast: $('#coffee-breakfast').checked,
      };
      Storage.save(Storage.KEYS.supplements, state.supplements);
      this.render(mealsForDay(state.viewDay));
      GroceryUI.render();
    });
  },

  /** Reflects the active user's supplement choices in the form. */
  syncForm() {
    $('#supplement-options').innerHTML = SUPPLEMENTS.map((s) => `
      <div class="check">
        <input type="checkbox" id="supp-${s.id}" name="supplements" value="${s.id}" ${state.supplements.selected.includes(s.id) ? 'checked' : ''}>
        <label for="supp-${s.id}">${s.label}</label>
      </div>`).join('');
    $('#coffee-breakfast').checked = state.supplements.coffeeAtBreakfast;
  },

  render(meals) {
    const { selected, coffeeAtBreakfast } = state.supplements;
    const schedule = ScheduleOptimizer.build(meals, selected, coffeeAtBreakfast);
    $('#timeline').innerHTML = MEAL_SLOTS.map((slot) => {
      const meal = meals[slot.id];
      const tips = ScheduleOptimizer.mealTips(slot.id, meal, coffeeAtBreakfast);
      let mealText = '<p class="timeline__meal timeline__meal--empty">No meal planned</p>';
      if (meal?.blocked) {
        const allergens = [...new Set(meal.flagged.filter((f) => !f.substitute).flatMap((f) => f.allergens))];
        mealText = `<p class="timeline__meal">${escapeHTML(meal.recipe.title)}</p>
           <p class="allergy-note">${AllergenGuard.badge(allergens, 'danger')} No safe substitute, so this meal is excluded. Choose another recipe.</p>`;
      } else if (meal) {
        const swaps = meal.flagged.map((f) => `${f.substitute.name} for ${f.original.toLowerCase()}`);
        mealText = `<p class="timeline__meal">${escapeHTML(meal.recipe.title)}</p>
           <p class="timeline__meta">${fmt(meal.nutrients.calories)} kcal · ${fmt(meal.nutrients.protein)} g protein · ${fmt(meal.nutrients.fat)} g fat · ${fmt(meal.nutrients.vitaminC)} mg vitamin C</p>
           ${swaps.length ? `<p class="allergy-note">Allergy-safe swaps: ${escapeHTML(swaps.join('; '))}.</p>` : ''}`;
      }
      const supps = schedule[slot.id].length
        ? `<ul class="supp-list">${schedule[slot.id].map((s) => `
            <li><strong>${SUPPLEMENT_BY_ID[s.id].label}</strong>: ${escapeHTML(s.reason)}</li>`).join('')}</ul>`
        : '';
      const tipList = tips.length ? `<ul class="tip-list">${tips.map((t) => `<li>${t}</li>`).join('')}</ul>` : '';
      return `
        <li class="timeline__item">
          <article class="card timeline__card">
            <h3><time datetime="${slot.time}">${slot.display}</time> <span class="timeline__slot">${slot.label}</span></h3>
            ${mealText}${supps}${tipList}
          </article>
        </li>`;
    }).join('');
  },
};

/* ---------- Recipe importer ---------- */

const RecipeUI = {
  form: null,
  previewUrl: null,

  init() {
    this.form = $('#recipe-form');

    $('#parse-raw').addEventListener('click', () => this.parseRaw());
    $('#analyze-recipe').addEventListener('click', () => this.renderAnalysis(this.readForm()));
    $('#cancel-edit').addEventListener('click', () => this.resetForm());
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });

    // Custom drop zone: role="button" + Enter/Space keyboard support.
    const zone = $('#ocr-dropzone');
    const fileInput = $('#ocr-file');
    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('is-dragging');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('is-dragging');
      this.handleImage(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => this.handleImage(fileInput.files[0]));

    $('#recipe-library').addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      if (button.dataset.action === 'edit') this.edit(button.dataset.id);
      if (button.dataset.action === 'delete') this.remove(button.dataset.id);
    });
  },

  readForm() {
    const f = this.form.elements;
    return {
      id: state.editingId ?? createId(),
      title: f['recipe-title'].value.trim(),
      servings: Number(f['recipe-servings'].value),
      ingredientsText: f['recipe-ingredients'].value.trim(),
      instructions: f['recipe-instructions'].value.trim(),
    };
  },

  fillForm(recipe) {
    const f = this.form.elements;
    f['recipe-title'].value = recipe.title;
    f['recipe-servings'].value = recipe.servings;
    f['recipe-ingredients'].value = recipe.ingredientsText;
    f['recipe-instructions'].value = recipe.instructions;
  },

  parseRaw() {
    const raw = $('#raw-recipe').value;
    if (!raw.trim()) {
      announce('Paste recipe text first.');
      $('#raw-recipe').focus();
      return;
    }
    const parsed = RecipeParser.parseRecipeText(raw);
    this.fillForm(parsed);
    this.renderAnalysis(this.readForm());
    const count = parsed.ingredientsText ? parsed.ingredientsText.split('\n').length : 0;
    announce(`Recipe parsed: “${parsed.title || 'Untitled'}” with ${count} ingredients. Review the form below.`);
    $('#recipe-title').focus();
  },

  /** Simulated OCR: deterministic sample text chosen from the file size, revealed in progress steps. */
  handleImage(file) {
    const status = $('#ocr-status');
    const progress = $('#ocr-progress');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      status.textContent = 'That file is not an image. Choose a JPG, PNG, WebP or HEIC photo.';
      return;
    }
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(file);
    const preview = $('#ocr-preview');
    preview.src = this.previewUrl;
    preview.alt = `Uploaded recipe photo: ${file.name}`;
    preview.hidden = false;

    const steps = [[20, 'Detecting text regions…'], [55, 'Recognizing characters…'], [85, 'Structuring recipe sections…'], [100, 'Done']];
    progress.hidden = false;
    steps.forEach(([value, label], i) => {
      window.setTimeout(() => {
        progress.value = value;
        status.textContent = `${label} ${value}%`;
        if (value === 100) {
          $('#raw-recipe').value = OCR_SAMPLES[file.size % OCR_SAMPLES.length];
          progress.hidden = true;
          status.textContent = 'Text extracted (simulated). Fields have been pre-filled below for review.';
          this.parseRaw();
        }
      }, (i + 1) * 400);
    });
  },

  renderAnalysis(recipe) {
    const out = $('#analysis-output');
    if (!recipe.ingredientsText) {
      out.innerHTML = '<p>Add at least one ingredient to analyze.</p>';
      return;
    }
    const temp = { ...recipe, servings: recipe.servings || 1 };
    const { ingredients: parsed } = RecipeParser.analyze(temp);
    const { ingredients, perServing, unmatched, isSafe, flagged } = analyzeForUser(temp);
    const active = state.profile.allergies;
    const allergyCell = (ing, i) => {
      const hits = AllergenGuard.detect(parsed[i]).filter((a) => active.includes(a));
      if (!hits.length) return active.length ? 'Safe' : '—';
      if (ing.blocked) return `${AllergenGuard.badge(hits, 'danger')} No safe substitute`;
      const sub = flagged.find((f) => f.raw === ing.raw).substitute;
      return `${AllergenGuard.badge(hits)} Swapped for <strong>${escapeHTML(sub.name)}</strong> (${escapeHTML(sub.ratio)}). ${escapeHTML(sub.note)}`;
    };
    const rows = ingredients.map((ing, i) => `
      <tr>
        <td>${escapeHTML(ing.raw)}</td>
        <td>${ing.foodId ? escapeHTML(FOOD_DB[ing.foodId].name) : '<span class="badge badge--warn"><span aria-hidden="true">!</span> Not recognized</span>'}</td>
        <td>${ing.foodId ? `${fmt(ing.grams)} g` : '—'}</td>
        <td>${fmt(ing.nutrients.calories)}</td>
        <td>${allergyCell(ing, i)}</td>
      </tr>`).join('');
    const blockedAllergens = [...new Set(flagged.filter((f) => !f.substitute).flatMap((f) => f.allergens))];
    out.innerHTML = `
      <p class="analysis__summary">Per serving: <strong>${fmt(perServing.calories)} kcal</strong> ·
        ${fmt(perServing.protein)} g protein · ${fmt(perServing.carbs)} g carbs · ${fmt(perServing.fat)} g fat ·
        ${fmt(perServing.fiber)} g fiber · ${fmt(perServing.iron)} mg iron</p>
      ${!isSafe ? `<p class="analysis__danger">${AllergenGuard.badge(blockedAllergens, 'danger')} This recipe contains an allergen with no safe substitute. It will be excluded from your meal plan and grocery list.</p>` : ''}
      ${isSafe && flagged.length ? `<p class="analysis__warn">Nutrition reflects ${flagged.length} allergy-safe swap${flagged.length === 1 ? '' : 's'} for your profile.</p>` : ''}
      ${unmatched ? `<p class="analysis__warn">${unmatched} ingredient${unmatched === 1 ? ' was' : 's were'} not found in the nutrition dictionary and ${unmatched === 1 ? 'is' : 'are'} excluded from totals.</p>` : ''}
      <div class="table-wrap">
        <table class="data-table">
          <caption>Ingredient matches for the whole recipe</caption>
          <thead><tr><th scope="col">Ingredient</th><th scope="col">Matched food</th><th scope="col">Weight</th><th scope="col">kcal</th><th scope="col">Allergy check</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  validate(recipe) {
    const checks = [
      ['recipe-title', recipe.title.length > 0, 'Enter a recipe title.'],
      ['recipe-servings', recipe.servings >= 1 && recipe.servings <= 50, 'Enter servings between 1 and 50.'],
      ['recipe-ingredients', recipe.ingredientsText.length > 0, 'Add at least one ingredient.'],
    ];
    let firstInvalid = null;
    checks.forEach(([id, ok, message]) => {
      $(`#${id}`).setAttribute('aria-invalid', String(!ok));
      $(`#${id}-error`).textContent = ok ? '' : message;
      if (!ok && !firstInvalid) firstInvalid = $(`#${id}`);
    });
    return firstInvalid;
  },

  save() {
    const recipe = this.readForm();
    const invalid = this.validate(recipe);
    if (invalid) {
      invalid.focus();
      announce('Please fix the highlighted recipe fields.');
      return;
    }
    const existing = state.recipes.findIndex((r) => r.id === recipe.id);
    if (existing >= 0) state.recipes.splice(existing, 1, recipe);
    else state.recipes.push(recipe);
    Storage.save(Storage.KEYS.recipes, state.recipes);
    this.resetForm();
    App.renderRecipesChanged();
    announce(`${existing >= 0 ? 'Updated' : 'Saved'} “${recipe.title}”. It is now available in the weekly meal plan.`);
  },

  edit(id) {
    const recipe = state.recipes.find((r) => r.id === id);
    state.editingId = id;
    this.fillForm(recipe);
    this.renderAnalysis(recipe);
    $('#cancel-edit').hidden = false;
    $('#save-recipe').textContent = 'Update recipe';
    $('#recipe-title').focus();
    announce(`Editing “${recipe.title}”.`);
  },

  remove(id) {
    const recipe = state.recipes.find((r) => r.id === id);
    if (!window.confirm(`Delete “${recipe.title}”? It will also be removed from your meal plan.`)) return;
    state.recipes = state.recipes.filter((r) => r.id !== id);
    DAYS.forEach((day) => MEAL_SLOTS.forEach((slot) => {
      if (state.plan[day][slot.id] === id) state.plan[day][slot.id] = '';
    }));
    Storage.save(Storage.KEYS.recipes, state.recipes);
    Storage.save(Storage.KEYS.plan, state.plan);
    if (state.editingId === id) this.resetForm();
    App.renderRecipesChanged();
    $('#library-heading').focus();
    announce(`Deleted “${recipe.title}”.`);
  },

  resetForm() {
    state.editingId = null;
    this.form.reset();
    this.form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    this.form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
    $('#cancel-edit').hidden = true;
    $('#save-recipe').textContent = 'Save recipe';
    $('#analysis-output').innerHTML = '';
  },

  renderLibrary() {
    $('#recipe-count').textContent = String(state.recipes.length);
    const list = $('#recipe-library');
    if (!state.recipes.length) {
      list.innerHTML = '<li class="empty">No recipes yet. Import one above to get started.</li>';
      return;
    }
    list.innerHTML = state.recipes.map((recipe) => {
      const { perServing: p, flagged, isSafe } = analyzeForUser(recipe);
      const title = escapeHTML(recipe.title);
      const allergyList = flagged.length ? `
            <ul class="allergy-list" aria-label="Allergy check for ${title}">
              ${flagged.map((f) => (f.substitute
                ? `<li>${AllergenGuard.badge(f.allergens)} ${escapeHTML(f.original)} → <strong>${escapeHTML(f.substitute.name)}</strong></li>`
                : `<li>${AllergenGuard.badge(f.allergens, 'danger')} ${escapeHTML(f.original)}: no safe substitute; excluded from your plan</li>`)).join('')}
            </ul>` : '';
      return `
        <li>
          <article class="card recipe-card">
            <h3>${title}</h3>
            <p class="recipe-card__meta">${recipe.servings} serving${recipe.servings === 1 ? '' : 's'} · per serving</p>
            <dl class="macro-chips">
              <div><dt>kcal</dt><dd>${fmt(p.calories)}</dd></div>
              <div><dt>Protein</dt><dd>${fmt(p.protein)} g</dd></div>
              <div><dt>Carbs</dt><dd>${fmt(p.carbs)} g</dd></div>
              <div><dt>Fat</dt><dd>${fmt(p.fat)} g</dd></div>
            </dl>${isSafe && flagged.length ? '\n            <p class="recipe-card__meta">Nutrition shown with allergy-safe swaps.</p>' : ''}${allergyList}
            <div class="button-row">
              <button type="button" class="btn btn--ghost" data-action="edit" data-id="${recipe.id}" aria-label="Edit ${title}">Edit</button>
              <button type="button" class="btn btn--ghost btn--danger" data-action="delete" data-id="${recipe.id}" aria-label="Delete ${title}">Delete</button>
            </div>
          </article>
        </li>`;
    }).join('');
  },
};

/* ---------- Weekly planner ---------- */

const PlannerUI = {
  init() {
    const grid = $('#planner-grid');
    grid.addEventListener('change', (e) => {
      const { day, slot } = e.target.dataset;
      state.plan[day][slot] = e.target.value;
      Storage.save(Storage.KEYS.plan, state.plan);
      App.renderNutrition();
      GroceryUI.render();
    });
    $('#clear-week').addEventListener('click', () => {
      if (!window.confirm('Clear every meal from this week?')) return;
      DAYS.forEach((day) => MEAL_SLOTS.forEach((slot) => { state.plan[day][slot.id] = ''; }));
      Storage.save(Storage.KEYS.plan, state.plan);
      this.render();
      App.renderNutrition();
      GroceryUI.render();
      announce('Weekly plan cleared.');
    });
  },

  render() {
    const labels = new Map(state.recipes.map((r) => {
      const { isSafe, flagged } = analyzeForUser(r);
      const allergens = [...new Set(flagged.filter((f) => !f.substitute).flatMap((f) => f.allergens))]
        .map((a) => ALLERGEN_BY_ID[a].label.toLowerCase());
      let suffix = '';
      if (!isSafe) suffix = ` (contains ${allergens.join(', ')})`;
      else if (flagged.length) suffix = ' (allergy-safe swaps)';
      return [r.id, { text: `${r.title}${suffix}`, disabled: !isSafe }];
    }));
    const options = (selected) => ['<option value="">— No meal —</option>',
      ...state.recipes.map((r) => {
        const { text, disabled } = labels.get(r.id);
        return `<option value="${r.id}" ${r.id === selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${escapeHTML(text)}</option>`;
      })].join('');
    $('#planner-grid').innerHTML = DAYS.map((day) => `
      <fieldset class="card day-card">
        <legend>${DAY_LABELS[day]}${day === todayKey() ? ' <span class="pill">Today</span>' : ''}</legend>
        ${MEAL_SLOTS.map((slot) => `
          <div class="field">
            <label for="plan-${day}-${slot.id}">${slot.label} <span class="field__hint">${slot.display}</span></label>
            <select id="plan-${day}-${slot.id}" data-day="${day}" data-slot="${slot.id}">${options(state.plan[day]?.[slot.id])}</select>
          </div>`).join('')}
      </fieldset>`).join('');
  },
};

/* ---------- Grocery list ---------- */

const GroceryUI = {
  init() {
    const household = $('#household-size');
    this.syncForm();
    household.addEventListener('change', () => {
      const value = Math.min(12, Math.max(1, Math.round(Number(household.value) || 1)));
      household.value = value;
      state.grocery.household = value;
      Storage.save(Storage.KEYS.grocery, state.grocery);
      this.render();
      announce(`Grocery quantities updated for ${value} ${value === 1 ? 'person' : 'people'}.`);
    });

    $('#grocery-list').addEventListener('change', (e) => {
      const checked = new Set(state.grocery.checked);
      if (e.target.checked) checked.add(e.target.value);
      else checked.delete(e.target.value);
      state.grocery.checked = [...checked];
      Storage.save(Storage.KEYS.grocery, state.grocery);
      this.updateProgress();
    });

    $('#uncheck-all').addEventListener('click', () => {
      state.grocery.checked = [];
      Storage.save(Storage.KEYS.grocery, state.grocery);
      document.querySelectorAll('#grocery-list input[type="checkbox"]').forEach((box) => { box.checked = false; });
      this.updateProgress();
      announce('All grocery items unchecked.');
    });

    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + ((7 - now.getDay()) % 7));
    $('#shopping-day').textContent = now.getDay() === 0
      ? 'Today is Sunday: your list is ready to shop.'
      : `Next shopping day: ${sunday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
  },

  /** Reflects the active user's household size in the form. */
  syncForm() {
    $('#household-size').value = state.grocery.household;
  },

  render() {
    const groups = GroceryAggregator.aggregate(state.plan, recipesById(), state.grocery.household, state.supplements.selected, analyzeForUser);
    const checked = new Set(state.grocery.checked);
    const list = $('#grocery-list');
    if (!groups.length) {
      list.innerHTML = '<p class="empty">Your list is empty. Plan some meals for the week to generate it.</p>';
      this.updateProgress();
      return;
    }
    list.innerHTML = groups.map((group) => `
      <fieldset class="card aisle">
        <legend>${group.aisle} <span class="aisle__count">(${group.items.length})</span></legend>
        <ul class="aisle__items">
          ${group.items.map((item) => {
            const id = `g-${item.key.replace(/[^a-z0-9-]/gi, '-')}`;
            return `
              <li class="check check--grocery">
                <input type="checkbox" id="${id}" value="${escapeHTML(item.key)}" ${checked.has(item.key) ? 'checked' : ''}>
                <label for="${id}"><span class="grocery__name">${escapeHTML(item.name)}${item.replaces?.size ? ` <span class="grocery__swap">allergy-safe swap for ${escapeHTML([...item.replaces].join(', '))}</span>` : ''}</span> <span class="grocery__qty">${escapeHTML(item.amount)}</span></label>
              </li>`;
          }).join('')}
        </ul>
      </fieldset>`).join('');
    this.updateProgress();
  },

  updateProgress() {
    const boxes = [...document.querySelectorAll('#grocery-list input[type="checkbox"]')];
    const done = boxes.filter((b) => b.checked).length;
    $('#grocery-progress').textContent = boxes.length ? `${done} of ${boxes.length} items in your basket.` : '';
  },
};

/* ---------- Account ---------- */

const AccountUI = {
  email: null,

  /** Restores a saved session before other controllers read state. */
  init() {
    const restored = AccountManager.restoreSession();
    if (restored) {
      this.email = restored;
      Storage.scope = restored;
      Object.assign(state, loadUserData());
    }
    this.renderState();

    $('#account-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    $('#btn-logout').addEventListener('click', () => this.signOut());
    $('#btn-delete-account').addEventListener('click', () => this.deleteAccount());

    const toggle = $('#toggle-password');
    toggle.addEventListener('click', () => {
      const show = toggle.getAttribute('aria-pressed') !== 'true';
      $('#user-password').type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
    });
  },

  setError(id, message) {
    $(`#${id}`).setAttribute('aria-invalid', String(Boolean(message)));
    $(`#${id}-error`).textContent = message;
  },

  validate() {
    const email = $('#user-email');
    const password = $('#user-password');
    const emailOk = email.value.trim() !== '' && email.validity.valid;
    const passwordOk = password.value.length >= 8;
    this.setError('user-email', emailOk ? '' : 'Enter an email address like you@example.com.');
    this.setError('user-password', passwordOk ? '' : 'Use at least 8 characters.');
    if (!emailOk) return email;
    return passwordOk ? null : password;
  },

  async submit() {
    const invalid = this.validate();
    if (invalid) {
      invalid.focus();
      announce('Please fix the highlighted account fields.');
      return;
    }
    const button = $('#btn-create-account');
    const password = $('#user-password');
    button.disabled = true;
    button.textContent = 'Checking…';
    try {
      const { email, created } = await AccountManager.signInOrCreate($('#user-email').value, password.value);
      if (created) {
        Storage.scope = email;
        saveUserData(); // the new account starts with the guest's current plan
      }
      Storage.save(Storage.KEYS.session, email);
      $('#account-form').reset();
      this.activate(email);
      announce(created
        ? `Account created for ${email}. Your current profile and meal plan were copied into it.`
        : `Signed in as ${email}. Your saved profile and meal plan are loaded.`);
    } catch (error) {
      if (error.message === 'wrong-password') {
        this.setError('user-password', 'That password does not match this email. Try again.');
        password.select();
        password.focus();
      } else {
        this.setError('user-email', 'Accounts need a secure (https) connection and a modern browser.');
      }
    } finally {
      button.disabled = false;
      button.textContent = 'Create account / Sign in';
      password.type = 'password';
      $('#toggle-password').setAttribute('aria-pressed', 'false');
    }
  },

  activate(email) {
    this.email = email;
    Storage.scope = email;
    App.reloadUserData();
    this.renderState();
    $('#account-status').focus();
  },

  signOut(message) {
    Storage.remove(Storage.KEYS.session);
    const previous = this.email;
    this.email = null;
    Storage.scope = null;
    App.reloadUserData();
    this.renderState();
    $('#user-email').focus();
    announce(message ?? `Signed out of ${previous}. You are now browsing as a guest.`);
  },

  deleteAccount() {
    const { email } = this;
    if (!window.confirm(`Permanently delete the account ${email} and all of its saved data on this device?`)) return;
    AccountManager.deleteAccount(email);
    this.signOut(`Account ${email} and its data were deleted.`);
  },

  renderState() {
    const signedIn = Boolean(this.email);
    $('#logged-out-view').hidden = signedIn;
    $('#logged-in-view').hidden = !signedIn;
    $('#display-user-email').textContent = this.email ?? '';
    $('#account-chip-label').textContent = signedIn ? this.email : 'Sign in';
  },
};

/* ---------- Theme ---------- */

const ThemeUI = {
  init() {
    const button = $('#theme-toggle');
    const stored = Storage.load(Storage.KEYS.theme, null);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    if (stored) document.documentElement.dataset.theme = stored;
    const isDark = () => (document.documentElement.dataset.theme ?? (media.matches ? 'dark' : 'light')) === 'dark';
    const sync = () => button.setAttribute('aria-pressed', String(isDark()));
    sync();
    media.addEventListener('change', sync);
    button.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      Storage.save(Storage.KEYS.theme, next);
      sync();
      announce(`${next === 'dark' ? 'Dark' : 'Light'} theme on.`);
    });
  },
};

/* ---------- App bootstrap ---------- */

const App = {
  init() {
    ThemeUI.init();
    AccountUI.init();
    ProfileUI.init();
    DashboardUI.init();
    ScheduleUI.init();
    RecipeUI.init();
    PlannerUI.init();
    GroceryUI.init();
    $('#year').textContent = String(new Date().getFullYear());
    this.renderRecipesChanged();
  },

  /** Swaps in the active scope's data (after sign-in / sign-out) and refreshes every view. */
  reloadUserData() {
    Object.assign(state, loadUserData(), { editingId: null });
    RecipeUI.resetForm();
    ProfileUI.fill(state.profile);
    ScheduleUI.syncForm();
    GroceryUI.syncForm();
    this.renderRecipesChanged();
  },

  /** Re-renders everything derived from profile targets and the viewed day. */
  renderNutrition() {
    ProfileUI.renderTargets();
    const day = DashboardUI.render();
    RecommendationsUI.render(day);
    ScheduleUI.render(day.meals);
  },

  /** Re-renders views that list recipes, then everything downstream. */
  renderRecipesChanged() {
    RecipeUI.renderLibrary();
    PlannerUI.render();
    this.renderNutrition();
    GroceryUI.render();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
