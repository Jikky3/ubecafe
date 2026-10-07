import { DAIRY, MEAT, NUTRIENT_KEYS, PANTRY, PRODUCE, SPICES } from './nutrients.js';

/**
 * Food dictionary. Values are per 100 g, in NUTRIENT_KEYS order:
 * kcal, protein, carbs, fat, sugar, fiber, vitA(mcg RAE), vitC(mg), vitD(mcg),
 * B12(mcg), calcium(mg), iron(mg), potassium(mg), magnesium(mg), zinc(mg), omega-3(g).
 * gPerUnit = grams for one "piece/clove/slice"; gPerCup = grams in one US cup.
 * count = label used on the grocery list for countable produce.
 */
export const FOOD_ROWS = [
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
  ['honey', 'Honey', PANTRY, ['honey'], 21, 339, [304, 0.3, 82, 0, 82, 0.2, 0, 0.5, 0, 0, 6, 0.4, 52, 2, 0.2, 0]],
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
  ['maple-syrup', 'Maple syrup', PANTRY, ['maple syrup', 'agave'], 20, 315, [260, 0, 67, 0.1, 60, 0, 0, 0, 0, 0, 102, 0.1, 212, 21, 1.5, 0]],
  ['cauliflower', 'Cauliflower', PRODUCE, ['cauliflower', 'cauliflower rice', 'riced cauliflower'], 575, 107, [25, 1.9, 5, 0.3, 1.9, 2, 0, 48, 0, 0, 22, 0.4, 299, 15, 0.3, 0.04], 'heads'],
  ['zucchini', 'Zucchini', PRODUCE, ['zucchini', 'courgette', 'zucchini noodles', 'zoodles'], 200, 124, [17, 1.2, 3.1, 0.3, 2.5, 1, 10, 18, 0, 0, 16, 0.4, 261, 18, 0.3, 0.03], 'pcs'],
  ['romaine', 'Romaine lettuce', PRODUCE, ['romaine', 'lettuce', 'lettuce leaves'], 10, 47, [17, 1.2, 3.3, 0.3, 1.2, 2.1, 436, 4, 0, 0, 33, 1, 247, 14, 0.2, 0.1]],
];

export const FOOD_DB = Object.fromEntries(
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

/** Restriction tags on dictionary foods (oats are tagged gluten for cross-contact). */
export const FOOD_TAGS = {
  'peanut-butter': ['peanuts', 'legumes'],
  'almond-butter': ['tree_nuts'],
  almonds: ['tree_nuts'],
  walnuts: ['tree_nuts'],
  'almond-milk': ['tree_nuts'],
  milk: ['dairy'],
  'greek-yogurt': ['dairy'],
  'cottage-cheese': ['dairy'],
  cheddar: ['dairy'],
  butter: ['dairy'],
  oats: ['gluten', 'grains'],
  'gf-oats': ['grains'],
  'oat-milk': ['grains'],
  bread: ['gluten', 'grains'],
  'gf-bread': ['grains'],
  pasta: ['gluten', 'grains'],
  'gf-pasta': ['grains'],
  'brown-rice': ['grains'],
  quinoa: ['grains'],
  'soy-sauce': ['soy', 'gluten', 'legumes'],
  tofu: ['soy', 'legumes'],
  'soy-milk': ['soy', 'legumes'],
  eggs: ['eggs'],
  chicken: ['meat'],
  beef: ['meat'],
  salmon: ['fish'],
  tuna: ['fish'],
  sardines: ['fish'],
  shrimp: ['shellfish'],
  lentils: ['legumes'],
  'black-beans': ['legumes'],
  chickpeas: ['legumes'],
  honey: ['honey', 'sugar'],
  'maple-syrup': ['sugar'],
  'sweet-potato': ['starch'],
  banana: ['high_carb_fruit'],
  apple: ['high_carb_fruit'],
  orange: ['high_carb_fruit'],
};

Object.values(FOOD_DB).forEach((food) => { food.tags = FOOD_TAGS[food.id] ?? []; });

/** Alias index sorted longest-first so "peanut butter" wins over "butter". */
export const ALIAS_INDEX = Object.values(FOOD_DB)
  .flatMap((food) => food.aliases.map((alias) => ({
    id: food.id,
    length: alias.length,
    pattern: new RegExp(`\\b${alias}(?:e?s)?\\b`),
  })))
  .sort((a, b) => b.length - a.length);

export const UNIT_ALIASES = {
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

export const UNIT_LOOKUP = Object.fromEntries(
  Object.entries(UNIT_ALIASES).flatMap(([unit, aliases]) => aliases.map((alias) => [alias, unit])),
);

export const WEIGHT_GRAMS = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };

export const UNICODE_FRACTIONS = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8' };

export const LIST_MARKER = /^\s*(?:[-*•–]|\d+[.)](?=\s))\s*/;
