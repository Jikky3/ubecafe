import { NUTRIENT_KEYS, PRODUCE, MEAT, DAIRY, PANTRY, SPICES } from './nutrients.js';

/**
 * Food table — schema
 * ===================
 * Every row in FOOD_ROWS is a plain object. Values are per 100 g of edible portion.
 *
 *   id        string   Stable, unique kebab-case key. Saved recipes reference it (recipe.matches), so never rename one.
 *   name      string   Display name, including the state where it matters ("Brown rice, cooked").
 *   aisle     string   Grocery aisle (see AISLES in nutrients.js).
 *   aliases   string[] Lower-case phrases matched against ingredient lines. Unique across the whole table.
 *                      The longest alias found in a line wins; plurals (+s / +es) match automatically.
 *   excludes  string[] Optional. Phrases that veto this row when present in the line ("butter beans" vetoes butter).
 *   tags      string[] Restriction ids from DIET_TAGS (the allergy / diet-pattern ids used by the
 *                      substitution engine). Poultry counts as 'meat'; oats carry 'gluten' for cross-contact.
 *   state     string   One of FOOD_STATES: raw | dry | cooked | canned.
 *   group     string   Optional. Rows sharing a group are state variants of one food (dry and cooked rice).
 *                      The row an alias points to is the default; words such as "cooked", "dry" or "canned"
 *                      in the line (or a "can" unit) switch to the matching variant.
 *   g         object   Portion weights in grams: unit (one piece / clove / slice / fillet / stick / block),
 *                      cup (one US cup), can (one can, drained where usually drained). Missing values fall back
 *                      to 100 g per unit, 240 g per cup and 400 g per can.
 *   count     string   Optional grocery-list counting label ("pcs", "cans", "cloves" …).
 *   source    string   The USDA food description the values come from (SR Legacy unless stated otherwise).
 *                      FoodData Central IDs are deliberately omitted until they can be verified against the API.
 *   note      string   Optional caveat about the values (brand variation, estimated fields).
 *   alcohol   number   Optional grams of alcohol per 100 g (energy not explained by protein, carbs and fat).
 *   n         number[] Nutrients per 100 g, in VALUE_KEYS order.
 */
export const VALUE_KEYS = [
  'calories', // kcal
  'protein', 'carbs', 'fat', 'saturatedFat', 'sugar', 'fiber', // g
  'sodium', // mg
  'vitaminA', // mcg RAE
  'vitaminC', // mg
  'vitaminD', 'vitaminB12', // mcg
  'calcium', 'iron', 'potassium', 'magnesium', 'zinc', // mg
  'omega3', // g, total n-3 fatty acids (ALA + EPA + DPA + DHA)
];

export const FOOD_STATES = ['raw', 'dry', 'cooked', 'canned'];
export const DIET_TAGS = ['peanuts', 'tree_nuts', 'dairy', 'gluten', 'soy', 'eggs', 'shellfish', 'meat', 'fish', 'honey',
  'grains', 'legumes', 'starch', 'sugar', 'high_carb_fruit'];

const SR = 'USDA SR Legacy: ';

/* eslint-disable max-len */
export const FOOD_ROWS = [
  // ---------- Vegetables ----------
  { id: 'spinach', name: 'Spinach, raw', aisle: PRODUCE, aliases: ['spinach', 'baby spinach'], state: 'raw', g: { unit: 30, cup: 30 },
    source: `${SR}Spinach, raw`, n: [23, 2.86, 3.63, 0.39, 0.063, 0.42, 2.2, 79, 469, 28.1, 0, 0, 99, 2.71, 558, 79, 0.53, 0.138] },
  { id: 'kale', name: 'Kale, raw', aisle: PRODUCE, aliases: ['kale', 'lacinato kale', 'curly kale'], state: 'raw', g: { unit: 35, cup: 21 },
    source: `${SR}Kale, raw`, n: [35, 2.92, 4.42, 1.49, 0.178, 0.99, 4.1, 53, 241, 93.4, 0, 0, 254, 1.6, 348, 33, 0.39, 0.18] },
  { id: 'broccoli', name: 'Broccoli, raw', aisle: PRODUCE, aliases: ['broccoli', 'broccoli florets', 'broccoli floret'], state: 'raw', g: { unit: 150, cup: 91 },
    source: `${SR}Broccoli, raw`, n: [34, 2.82, 6.64, 0.37, 0.039, 1.7, 2.6, 33, 31, 89.2, 0, 0, 47, 0.73, 316, 21, 0.41, 0.021] },
  { id: 'bell-pepper', name: 'Bell pepper, red', aisle: PRODUCE, aliases: ['bell pepper', 'red bell pepper', 'red pepper', 'red capsicum', 'capsicum', 'roasted red pepper'], state: 'raw', g: { unit: 119, cup: 149 }, count: 'pcs',
    source: `${SR}Peppers, sweet, red, raw`, n: [31, 0.99, 6.03, 0.3, 0.027, 4.2, 2.1, 4, 157, 127.7, 0, 0, 7, 0.43, 211, 12, 0.25, 0.025] },
  { id: 'bell-pepper-green', name: 'Bell pepper, green', aisle: PRODUCE, aliases: ['green bell pepper', 'green pepper', 'green capsicum'], state: 'raw', g: { unit: 119, cup: 149 }, count: 'pcs',
    source: `${SR}Peppers, sweet, green, raw`, n: [20, 0.86, 4.64, 0.17, 0.058, 2.4, 1.7, 3, 18, 80.4, 0, 0, 10, 0.34, 175, 10, 0.13, 0.008] },
  { id: 'jalapeno', name: 'Jalapeño pepper', aisle: PRODUCE, aliases: ['jalapeno', 'jalapeno pepper', 'jalapeno chile'], state: 'raw', g: { unit: 14, cup: 90 }, count: 'pcs',
    source: `${SR}Peppers, jalapeno, raw`, n: [29, 0.91, 6.5, 0.37, 0.092, 4.12, 2.8, 3, 54, 118.6, 0, 0, 12, 0.25, 248, 15, 0.14, 0.03] },
  { id: 'sweet-potato', tags: ['starch'], name: 'Sweet potato, raw', aisle: PRODUCE, aliases: ['sweet potato', 'yam'], state: 'raw', g: { unit: 130, cup: 133 }, count: 'pcs',
    source: `${SR}Sweet potato, raw, unprepared`, n: [86, 1.57, 20.12, 0.05, 0.018, 4.18, 3, 55, 709, 2.4, 0, 0, 30, 0.61, 337, 25, 0.3, 0.001] },
  { id: 'potato', tags: ['starch'], name: 'Potato, raw', aisle: PRODUCE, aliases: ['potato', 'russet potato', 'yukon gold potato', 'baking potato'], excludes: ['sweet potato', 'potato chip'], state: 'raw', g: { unit: 213, cup: 150 }, count: 'pcs',
    source: `${SR}Potatoes, flesh and skin, raw`, n: [77, 2.05, 17.49, 0.09, 0.025, 0.82, 2.1, 6, 0, 19.7, 0, 0, 12, 0.81, 425, 23, 0.3, 0.01] },
  { id: 'carrot', name: 'Carrot, raw', aisle: PRODUCE, aliases: ['carrot', 'baby carrot'], state: 'raw', g: { unit: 61, cup: 128 }, count: 'pcs',
    source: `${SR}Carrots, raw`, n: [41, 0.93, 9.58, 0.24, 0.037, 4.74, 2.8, 69, 835, 5.9, 0, 0, 33, 0.3, 320, 12, 0.24, 0.002] },
  { id: 'tomato', name: 'Tomato, raw', aisle: PRODUCE, aliases: ['tomato', 'diced tomato', 'cherry tomato', 'grape tomato', 'roma tomato', 'plum tomato'], excludes: ['sun dried', 'sundried', 'tomato sauce', 'tomato soup', 'tomato juice'], group: 'tomato', state: 'raw', g: { unit: 123, cup: 180, can: 411 }, count: 'pcs',
    source: `${SR}Tomatoes, red, ripe, raw, year round average`, n: [18, 0.88, 3.89, 0.2, 0.028, 2.63, 1.2, 5, 42, 13.7, 0, 0, 10, 0.27, 237, 11, 0.17, 0.003] },
  { id: 'tomato-canned', name: 'Tomatoes, canned', aisle: PANTRY, aliases: ['canned tomato', 'crushed tomato', 'tinned tomato', 'canned diced tomato', 'whole peeled tomato'], group: 'tomato', state: 'canned', g: { unit: 123, cup: 240, can: 411 }, count: 'cans',
    source: `${SR}Tomatoes, red, ripe, canned, packed in tomato juice`, note: 'Regular canned tomatoes; no-salt-added versions have about 10 mg sodium per 100 g.',
    n: [16, 0.79, 3.47, 0.25, 0.036, 2.35, 1.9, 115, 7, 12.6, 0, 0, 33, 0.57, 191, 10, 0.14, 0.004] },
  { id: 'tomato-paste', name: 'Tomato paste', aisle: PANTRY, aliases: ['tomato paste'], state: 'canned', g: { unit: 16, cup: 262, can: 170 },
    source: `${SR}Tomato products, canned, paste, without salt added`, n: [82, 4.32, 18.91, 0.47, 0.1, 12.18, 4.1, 59, 76, 21.9, 0, 0, 36, 2.98, 1014, 42, 0.63, 0.01] },
  { id: 'onion', name: 'Onion, raw', aisle: PRODUCE, aliases: ['onion', 'red onion', 'yellow onion', 'white onion', 'sweet onion'], excludes: ['green onion', 'spring onion', 'onion powder'], state: 'raw', g: { unit: 110, cup: 160 }, count: 'pcs',
    source: `${SR}Onions, raw`, n: [40, 1.1, 9.34, 0.1, 0.042, 4.24, 1.7, 4, 0, 7.4, 0, 0, 23, 0.21, 146, 10, 0.17, 0.004] },
  { id: 'green-onion', name: 'Green onion (scallion)', aisle: PRODUCE, aliases: ['green onion', 'scallion', 'spring onion'], state: 'raw', g: { unit: 15, cup: 100 },
    source: `${SR}Onions, spring or scallions (includes tops and bulb), raw`, n: [32, 1.83, 7.34, 0.19, 0.032, 2.33, 2.6, 16, 50, 18.8, 0, 0, 72, 1.48, 276, 20, 0.39, 0] },
  { id: 'garlic', name: 'Garlic, raw', aisle: PRODUCE, aliases: ['garlic', 'garlic clove'], excludes: ['garlic powder', 'garlic salt'], state: 'raw', g: { unit: 3, cup: 136 }, count: 'cloves',
    source: `${SR}Garlic, raw`, n: [149, 6.36, 33.06, 0.5, 0.089, 1, 2.1, 17, 0, 31.2, 0, 0, 181, 1.7, 401, 25, 1.16, 0.02] },
  { id: 'ginger', name: 'Ginger root, raw', aisle: PRODUCE, aliases: ['ginger', 'ginger root', 'fresh ginger'], excludes: ['ground ginger', 'ginger ale'], state: 'raw', g: { unit: 11, cup: 96 },
    source: `${SR}Ginger root, raw`, n: [80, 1.82, 17.77, 0.75, 0.203, 1.7, 2, 13, 0, 5, 0, 0, 16, 0.6, 415, 43, 0.34, 0.034] },
  { id: 'cucumber', name: 'Cucumber, with peel', aisle: PRODUCE, aliases: ['cucumber', 'english cucumber'], state: 'raw', g: { unit: 301, cup: 120 }, count: 'pcs',
    source: `${SR}Cucumber, with peel, raw`, n: [15, 0.65, 3.63, 0.11, 0.037, 1.67, 0.5, 2, 5, 2.8, 0, 0, 16, 0.28, 147, 13, 0.2, 0.005] },
  { id: 'mushroom', name: 'Mushrooms, white', aisle: PRODUCE, aliases: ['mushroom', 'white mushroom', 'button mushroom'], state: 'raw', g: { unit: 18, cup: 70 },
    source: `${SR}Mushrooms, white, raw`, n: [22, 3.09, 3.26, 0.34, 0.05, 1.98, 1, 5, 0, 2.1, 0.2, 0.04, 3, 0.5, 318, 9, 0.52, 0] },
  { id: 'zucchini', name: 'Zucchini, raw', aisle: PRODUCE, aliases: ['zucchini', 'courgette'], state: 'raw', g: { unit: 196, cup: 124 }, count: 'pcs',
    source: `${SR}Squash, summer, zucchini, includes skin, raw`, n: [17, 1.21, 3.11, 0.32, 0.084, 2.5, 1, 8, 10, 17.9, 0, 0, 16, 0.37, 261, 18, 0.32, 0.07] },
  { id: 'cauliflower', name: 'Cauliflower, raw', aisle: PRODUCE, aliases: ['cauliflower', 'cauliflower floret', 'cauliflower rice', 'riced cauliflower'], state: 'raw', g: { unit: 588, cup: 107 }, count: 'heads',
    source: `${SR}Cauliflower, raw`, n: [25, 1.92, 4.97, 0.28, 0.13, 1.91, 2, 30, 0, 48.2, 0, 0, 22, 0.42, 299, 15, 0.27, 0.01] },
  { id: 'cabbage', name: 'Cabbage, green, raw', aisle: PRODUCE, aliases: ['cabbage', 'green cabbage'], excludes: ['red cabbage', 'napa cabbage'], state: 'raw', g: { unit: 908, cup: 89 }, count: 'heads',
    source: `${SR}Cabbage, raw`, n: [25, 1.28, 5.8, 0.1, 0.034, 3.2, 2.5, 18, 5, 36.6, 0, 0, 40, 0.47, 170, 12, 0.18, 0.017] },
  { id: 'celery', name: 'Celery, raw', aisle: PRODUCE, aliases: ['celery', 'celery stalk', 'celery rib'], excludes: ['celery salt', 'celery seed'], state: 'raw', g: { unit: 40, cup: 101 }, count: 'stalks',
    source: `${SR}Celery, raw`, n: [14, 0.69, 2.97, 0.17, 0.042, 1.34, 1.6, 80, 22, 3.1, 0, 0, 40, 0.2, 260, 11, 0.13, 0] },
  { id: 'romaine', name: 'Romaine lettuce', aisle: PRODUCE, aliases: ['romaine', 'romaine lettuce', 'romaine heart', 'cos lettuce'], state: 'raw', g: { unit: 626, cup: 47 }, count: 'heads',
    source: `${SR}Lettuce, cos or romaine, raw`, n: [17, 1.23, 3.29, 0.3, 0.039, 1.19, 2.1, 8, 436, 4, 0, 0, 33, 0.97, 247, 14, 0.23, 0.113] },
  { id: 'arugula', name: 'Arugula, raw', aisle: PRODUCE, aliases: ['arugula', 'rocket', 'baby arugula'], state: 'raw', g: { unit: 2, cup: 20 },
    source: `${SR}Arugula, raw`, n: [25, 2.58, 3.65, 0.66, 0.086, 2.05, 1.6, 27, 119, 15, 0, 0, 160, 1.46, 369, 47, 0.47, 0.17] },
  { id: 'bok-choy', name: 'Bok choy, raw', aisle: PRODUCE, aliases: ['bok choy', 'pak choi', 'baby bok choy'], state: 'raw', g: { unit: 120, cup: 70 },
    source: `${SR}Cabbage, chinese (pak-choi), raw`, n: [13, 1.5, 2.18, 0.2, 0.027, 1.18, 1, 65, 223, 45, 0, 0, 105, 0.8, 252, 19, 0.19, 0.055] },
  { id: 'peas', tags: ['legumes'], name: 'Green peas, raw', aisle: PRODUCE, aliases: ['peas', 'green peas', 'frozen peas', 'sweet peas', 'garden peas'], excludes: ['snow pea', 'snap pea', 'split pea', 'black eyed pea'], state: 'raw', g: { unit: 145, cup: 145 },
    source: `${SR}Peas, green, raw`, n: [81, 5.42, 14.45, 0.4, 0.071, 5.67, 5.1, 5, 38, 40, 0, 0, 25, 1.47, 244, 33, 1.24, 0.035] },
  { id: 'corn', tags: ['starch'], name: 'Sweet corn, yellow, raw', aisle: PRODUCE, aliases: ['corn', 'sweet corn', 'corn kernel', 'corn on the cob'], state: 'raw', g: { unit: 102, cup: 145 }, count: 'ears',
    source: `${SR}Corn, sweet, yellow, raw`, n: [86, 3.27, 18.7, 1.35, 0.325, 6.26, 2, 15, 9, 6.8, 0, 0, 2, 0.52, 270, 37, 0.46, 0.018] },
  { id: 'green-beans', name: 'Green beans, raw', aisle: PRODUCE, aliases: ['green beans', 'string beans', 'haricots verts', 'snap beans'], state: 'raw', g: { unit: 5, cup: 110 },
    source: `${SR}Beans, snap, green, raw`, n: [31, 1.83, 6.97, 0.22, 0.05, 3.26, 2.7, 6, 35, 12.2, 0, 0, 37, 1.03, 211, 25, 0.24, 0.039] },
  { id: 'asparagus', name: 'Asparagus, raw', aisle: PRODUCE, aliases: ['asparagus', 'asparagus spear'], state: 'raw', g: { unit: 16, cup: 134 },
    source: `${SR}Asparagus, raw`, n: [20, 2.2, 3.88, 0.12, 0.04, 1.88, 2.1, 2, 38, 5.6, 0, 0, 24, 2.14, 202, 14, 0.54, 0.01] },
  { id: 'eggplant', name: 'Eggplant, raw', aisle: PRODUCE, aliases: ['eggplant', 'aubergine'], state: 'raw', g: { unit: 548, cup: 82 }, count: 'pcs',
    source: `${SR}Eggplant, raw`, n: [25, 0.98, 5.88, 0.18, 0.034, 3.53, 3, 2, 1, 2.2, 0, 0, 9, 0.23, 229, 14, 0.16, 0.004] },
  { id: 'butternut-squash', tags: ['starch'], name: 'Butternut squash, raw', aisle: PRODUCE, aliases: ['butternut squash', 'butternut'], state: 'raw', g: { unit: 900, cup: 140 }, count: 'pcs',
    source: `${SR}Squash, winter, butternut, raw`, n: [45, 1, 11.69, 0.1, 0.021, 2.2, 2, 4, 532, 21, 0, 0, 48, 0.7, 352, 34, 0.15, 0] },
  { id: 'pumpkin-puree', name: 'Pumpkin purée, canned', aisle: PANTRY, aliases: ['pumpkin', 'pumpkin puree', 'canned pumpkin'], state: 'canned', g: { unit: 245, cup: 245, can: 425 }, count: 'cans',
    source: `${SR}Pumpkin, canned, without salt`, n: [34, 1.1, 8.09, 0.28, 0.146, 3.3, 2.9, 5, 953, 4.2, 0, 0, 26, 1.39, 206, 23, 0.17, 0] },
  { id: 'beet', name: 'Beets, raw', aisle: PRODUCE, aliases: ['beet', 'beetroot'], excludes: ['beet greens'], state: 'raw', g: { unit: 82, cup: 136 }, count: 'pcs',
    source: `${SR}Beets, raw`, n: [43, 1.61, 9.56, 0.17, 0.027, 6.76, 2.8, 78, 2, 4.9, 0, 0, 16, 0.8, 325, 23, 0.35, 0.005] },
  { id: 'brussels-sprouts', name: 'Brussels sprouts, raw', aisle: PRODUCE, aliases: ['brussels sprout', 'brussel sprout'], state: 'raw', g: { unit: 19, cup: 88 },
    source: `${SR}Brussels sprouts, raw`, n: [43, 3.38, 8.95, 0.3, 0.062, 2.2, 3.8, 25, 38, 85, 0, 0, 42, 1.4, 389, 23, 0.42, 0.099] },
  { id: 'olives', name: 'Olives, ripe, canned', aisle: PANTRY, aliases: ['olive', 'black olive', 'ripe olive', 'kalamata olive'], state: 'canned', g: { unit: 4, cup: 134 },
    source: `${SR}Olives, ripe, canned (small-extra large)`, n: [115, 0.84, 6.26, 10.68, 1.415, 0, 3.2, 735, 20, 0.9, 0, 0, 88, 3.31, 8, 4, 0.22, 0.06] },

  // ---------- Fresh herbs ----------
  { id: 'cilantro', name: 'Cilantro (coriander leaves)', aisle: PRODUCE, aliases: ['cilantro', 'fresh coriander', 'coriander leaves'], state: 'raw', g: { unit: 5, cup: 16 },
    source: `${SR}Coriander (cilantro) leaves, raw`, n: [23, 2.13, 3.67, 0.52, 0.014, 0.87, 2.8, 46, 337, 27, 0, 0, 67, 1.77, 521, 26, 0.5, 0] },
  { id: 'parsley', name: 'Parsley, fresh', aisle: PRODUCE, aliases: ['parsley', 'flat leaf parsley', 'italian parsley'], excludes: ['dried parsley', 'parsley flakes'], state: 'raw', g: { unit: 5, cup: 60 },
    source: `${SR}Parsley, fresh`, n: [36, 2.97, 6.33, 0.79, 0.132, 0.85, 3.3, 56, 421, 133, 0, 0, 138, 6.2, 554, 50, 1.07, 0.008] },
  { id: 'basil', name: 'Basil, fresh', aisle: PRODUCE, aliases: ['basil', 'fresh basil', 'basil leaf', 'basil leaves'], excludes: ['dried basil'], state: 'raw', g: { unit: 0.5, cup: 24 },
    source: `${SR}Basil, fresh`, n: [23, 3.15, 2.65, 0.64, 0.041, 0.3, 1.6, 4, 264, 18, 0, 0, 177, 3.17, 295, 64, 0.81, 0.316] },

  // ---------- Fruit ----------
  { id: 'avocado', name: 'Avocado', aisle: PRODUCE, aliases: ['avocado'], excludes: ['avocado oil'], state: 'raw', g: { unit: 150, cup: 150 }, count: 'pcs',
    source: `${SR}Avocados, raw, all commercial varieties`, n: [160, 2, 8.53, 14.66, 2.126, 0.66, 6.7, 7, 7, 10, 0, 0, 12, 0.55, 485, 29, 0.64, 0.111] },
  { id: 'banana', tags: ['high_carb_fruit'], name: 'Banana', aisle: PRODUCE, aliases: ['banana'], state: 'raw', g: { unit: 118, cup: 150 }, count: 'pcs',
    source: `${SR}Bananas, raw`, n: [89, 1.09, 22.84, 0.33, 0.112, 12.23, 2.6, 1, 3, 8.7, 0, 0, 5, 0.26, 358, 27, 0.15, 0.027] },
  { id: 'apple', tags: ['high_carb_fruit'], name: 'Apple, with skin', aisle: PRODUCE, aliases: ['apple', 'green apple', 'red apple'], state: 'raw', g: { unit: 182, cup: 125 }, count: 'pcs',
    source: `${SR}Apples, raw, with skin`, n: [52, 0.26, 13.81, 0.17, 0.028, 10.39, 2.4, 1, 3, 4.6, 0, 0, 6, 0.12, 107, 5, 0.04, 0.009] },
  { id: 'orange', tags: ['high_carb_fruit'], name: 'Orange', aisle: PRODUCE, aliases: ['orange', 'navel orange'], excludes: ['orange pepper', 'orange bell'], state: 'raw', g: { unit: 131, cup: 180 }, count: 'pcs',
    source: `${SR}Oranges, raw, all commercial varieties`, n: [47, 0.94, 11.75, 0.12, 0.015, 9.35, 2.4, 0, 11, 53.2, 0, 0, 40, 0.1, 181, 10, 0.07, 0.011] },
  { id: 'orange-juice', tags: ['high_carb_fruit', 'sugar'], name: 'Orange juice', aisle: PRODUCE, aliases: ['orange juice'], state: 'raw', g: { unit: 248, cup: 248 },
    source: `${SR}Orange juice, raw`, n: [45, 0.7, 10.4, 0.2, 0.024, 8.4, 0.2, 1, 10, 50, 0, 0, 11, 0.2, 200, 11, 0.05, 0.011] },
  { id: 'kiwi', name: 'Kiwifruit, green', aisle: PRODUCE, aliases: ['kiwi', 'kiwifruit', 'kiwi fruit'], state: 'raw', g: { unit: 69, cup: 180 }, count: 'pcs',
    source: `${SR}Kiwifruit, green, raw`, n: [61, 1.14, 14.66, 0.52, 0.029, 8.99, 3, 3, 4, 92.7, 0, 0, 34, 0.31, 312, 17, 0.14, 0.042] },
  { id: 'lemon', name: 'Lemon', aisle: PRODUCE, aliases: ['lemon'], state: 'raw', g: { unit: 58, cup: 212 }, count: 'pcs',
    source: `${SR}Lemons, raw, without peel`, n: [29, 1.1, 9.32, 0.3, 0.039, 2.5, 2.8, 2, 1, 53, 0, 0, 26, 0.6, 138, 8, 0.06, 0.026] },
  { id: 'lemon-juice', name: 'Lemon juice', aisle: PRODUCE, aliases: ['lemon juice'], state: 'raw', g: { unit: 48, cup: 244 },
    source: `${SR}Lemon juice, raw`, n: [22, 0.35, 6.9, 0.24, 0.04, 2.52, 0.3, 1, 1, 38.7, 0, 0, 6, 0.08, 103, 6, 0.05, 0] },
  { id: 'lime', name: 'Lime', aisle: PRODUCE, aliases: ['lime', 'key lime'], excludes: ['kaffir lime leaves', 'lime leaves'], state: 'raw', g: { unit: 67, cup: 200 }, count: 'pcs',
    source: `${SR}Limes, raw`, n: [30, 0.7, 10.54, 0.2, 0.022, 1.69, 2.8, 2, 2, 29.1, 0, 0, 33, 0.6, 102, 6, 0.11, 0.017] },
  { id: 'lime-juice', name: 'Lime juice', aisle: PRODUCE, aliases: ['lime juice'], state: 'raw', g: { unit: 44, cup: 242 },
    source: `${SR}Lime juice, raw`, n: [25, 0.42, 8.42, 0.07, 0.008, 1.69, 0.4, 2, 2, 30, 0, 0, 14, 0.09, 117, 8, 0.08, 0] },
  { id: 'blueberries', name: 'Blueberries', aisle: PRODUCE, aliases: ['blueberry', 'blueberries'], state: 'raw', g: { unit: 148, cup: 148 },
    source: `${SR}Blueberries, raw`, n: [57, 0.74, 14.49, 0.33, 0.028, 9.96, 2.4, 1, 3, 9.7, 0, 0, 6, 0.28, 77, 6, 0.16, 0.058] },
  { id: 'strawberries', name: 'Strawberries', aisle: PRODUCE, aliases: ['strawberry', 'strawberries'], state: 'raw', g: { unit: 12, cup: 152 },
    source: `${SR}Strawberries, raw`, n: [32, 0.67, 7.68, 0.3, 0.015, 4.89, 2, 1, 1, 58.8, 0, 0, 16, 0.41, 153, 13, 0.14, 0.065] },
  { id: 'raspberries', name: 'Raspberries', aisle: PRODUCE, aliases: ['raspberry', 'raspberries'], state: 'raw', g: { unit: 123, cup: 123 },
    source: `${SR}Raspberries, raw`, n: [52, 1.2, 11.94, 0.65, 0.019, 4.42, 6.5, 1, 2, 26.2, 0, 0, 25, 0.69, 151, 22, 0.42, 0.126] },
  { id: 'blackberries', name: 'Blackberries', aisle: PRODUCE, aliases: ['blackberry', 'blackberries'], state: 'raw', g: { unit: 144, cup: 144 },
    source: `${SR}Blackberries, raw`, n: [43, 1.39, 9.61, 0.49, 0.014, 4.88, 5.3, 1, 11, 21, 0, 0, 29, 0.62, 162, 20, 0.53, 0.094] },
  { id: 'grapes', tags: ['high_carb_fruit'], name: 'Grapes, red or green', aisle: PRODUCE, aliases: ['grape', 'red grape', 'green grape', 'seedless grape'], state: 'raw', g: { unit: 5, cup: 151 },
    source: `${SR}Grapes, red or green (European type, such as Thompson seedless), raw`, n: [69, 0.72, 18.1, 0.16, 0.054, 15.48, 0.9, 2, 3, 3.2, 0, 0, 10, 0.36, 191, 7, 0.07, 0.011] },
  { id: 'mango', tags: ['high_carb_fruit'], name: 'Mango', aisle: PRODUCE, aliases: ['mango'], state: 'raw', g: { unit: 200, cup: 165 }, count: 'pcs',
    source: `${SR}Mangos, raw`, n: [60, 0.82, 14.98, 0.38, 0.092, 13.66, 1.6, 1, 54, 36.4, 0, 0, 11, 0.16, 168, 10, 0.09, 0.051] },
  { id: 'pineapple', tags: ['high_carb_fruit'], name: 'Pineapple', aisle: PRODUCE, aliases: ['pineapple', 'pineapple chunk'], state: 'raw', g: { unit: 905, cup: 165 }, count: 'pcs',
    source: `${SR}Pineapple, raw, all varieties`, n: [50, 0.54, 13.12, 0.12, 0.009, 9.85, 1.4, 1, 3, 47.8, 0, 0, 13, 0.29, 109, 12, 0.12, 0.017] },
  { id: 'peach', name: 'Peach', aisle: PRODUCE, aliases: ['peach'], state: 'raw', g: { unit: 150, cup: 154 }, count: 'pcs',
    source: `${SR}Peaches, yellow, raw`, n: [39, 0.91, 9.54, 0.25, 0.019, 8.39, 1.5, 0, 16, 6.6, 0, 0, 6, 0.25, 190, 9, 0.17, 0.002] },
  { id: 'pear', tags: ['high_carb_fruit'], name: 'Pear', aisle: PRODUCE, aliases: ['pear'], state: 'raw', g: { unit: 178, cup: 140 }, count: 'pcs',
    source: `${SR}Pears, raw`, n: [57, 0.36, 15.23, 0.14, 0.022, 9.75, 3.1, 1, 1, 4.3, 0, 0, 9, 0.18, 116, 7, 0.1, 0] },
  { id: 'watermelon', name: 'Watermelon', aisle: PRODUCE, aliases: ['watermelon'], state: 'raw', g: { unit: 286, cup: 152 },
    source: `${SR}Watermelon, raw`, n: [30, 0.61, 7.55, 0.15, 0.016, 6.2, 0.4, 1, 28, 8.1, 0, 0, 7, 0.24, 112, 10, 0.1, 0] },
  { id: 'cantaloupe', name: 'Cantaloupe', aisle: PRODUCE, aliases: ['cantaloupe', 'rockmelon', 'muskmelon'], state: 'raw', g: { unit: 552, cup: 160 }, count: 'pcs',
    source: `${SR}Melons, cantaloupe, raw`, n: [34, 0.84, 8.16, 0.19, 0.051, 7.86, 0.9, 16, 169, 36.7, 0, 0, 9, 0.21, 267, 12, 0.18, 0.046] },
  { id: 'cherries', tags: ['high_carb_fruit'], name: 'Cherries, sweet', aisle: PRODUCE, aliases: ['cherry', 'cherries', 'sweet cherries'], state: 'raw', g: { unit: 8, cup: 138 },
    source: `${SR}Cherries, sweet, raw`, n: [63, 1.06, 16.01, 0.2, 0.038, 12.82, 2.1, 0, 3, 7, 0, 0, 13, 0.36, 222, 11, 0.07, 0.026] },
  { id: 'raisins', tags: ['high_carb_fruit', 'sugar'], name: 'Raisins', aisle: PANTRY, aliases: ['raisin', 'golden raisin'], state: 'dry', g: { unit: 1, cup: 145 },
    source: `${SR}Raisins, seedless`, n: [299, 3.07, 79.18, 0.46, 0.058, 59.19, 3.7, 11, 0, 2.3, 0, 0, 50, 1.88, 749, 32, 0.22, 0.008] },

  // ---------- Dairy, eggs & alternatives ----------
  { id: 'milk', tags: ['dairy'], name: 'Milk, 2% reduced fat', aisle: DAIRY, aliases: ['milk', 'cow milk', 'cows milk', 'dairy milk', 'reduced fat milk', 'fortified milk', 'low fat milk', 'skim milk'],
    excludes: ['rice milk', 'cashew milk', 'hemp milk', 'pea milk', 'macadamia milk', 'flax milk', 'coconut milk', 'almond milk', 'oat milk', 'soy milk', 'condensed milk', 'evaporated milk', 'powdered milk', 'milk powder', 'chocolate milk', 'goat milk', 'milk chocolate'],
    state: 'raw', g: { unit: 244, cup: 244 },
    source: `${SR}Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D`, note: 'Sugar capped at total carbohydrate (SR lists 5.06 g).',
    n: [50, 3.3, 4.8, 1.98, 1.257, 4.8, 0, 47, 55, 0.2, 1.2, 0.53, 120, 0.03, 140, 11, 0.48, 0.01] },
  { id: 'whole-milk', tags: ['dairy'], name: 'Milk, whole', aisle: DAIRY, aliases: ['whole milk', 'full fat milk', 'full cream milk'], state: 'raw', g: { unit: 244, cup: 244 },
    source: `${SR}Milk, whole, 3.25% milkfat, with added vitamin D`, note: 'Sugar capped at total carbohydrate (SR lists 5.05 g).',
    n: [61, 3.15, 4.8, 3.25, 1.865, 4.8, 0, 43, 46, 0, 1.3, 0.45, 113, 0.03, 132, 10, 0.37, 0.075] },
  { id: 'almond-milk', tags: ['tree_nuts'], name: 'Almond milk, unsweetened', aisle: DAIRY, aliases: ['almond milk', 'almond beverage', 'unsweetened almond milk'], state: 'raw', g: { unit: 240, cup: 240 },
    source: `${SR}Beverages, almond milk, unsweetened, shelf stable`, note: 'Calcium and vitamin D are fortification levels; vitamin A and B12 fortification varies by brand and is not counted.',
    n: [15, 0.59, 0.58, 1.1, 0.09, 0, 0.2, 72, 0, 0, 1, 0, 184, 0.28, 67, 6, 0.07, 0] },
  { id: 'soy-milk', tags: ['soy', 'legumes'], name: 'Soy milk, original', aisle: DAIRY, aliases: ['soy milk', 'soymilk', 'soya milk'], state: 'raw', g: { unit: 243, cup: 243 },
    source: `${SR}Soymilk, original and vanilla, with added calcium, vitamins A and D`, note: 'Vitamin B12 fortification varies by brand and is not counted.',
    n: [54, 3.27, 6.28, 1.75, 0.205, 3.99, 0.6, 51, 64, 0, 1.1, 0, 123, 0.64, 118, 25, 0.12, 0.1] },
  { id: 'oat-milk', tags: ['grains'], name: 'Oat milk, fortified', aisle: DAIRY, aliases: ['oat milk', 'oat beverage', 'oatmilk'], state: 'raw', g: { unit: 240, cup: 240 },
    source: 'Not in SR Legacy. Typical fortified oat beverage label (per 240 ml: 120 kcal, 3 g protein, 16 g carbs, 5 g fat, 7 g sugar, 100 mg sodium, 350 mg calcium, 3.6 mcg vitamin D, 1.2 mcg B12); compare FNDDS "Oat milk".',
    note: 'Label-derived estimate; varies by brand.',
    n: [48, 1.25, 6.67, 2.08, 0.21, 2.92, 0.8, 42, 0, 0, 1.5, 0.5, 146, 0.12, 162, 0, 0, 0] },
  { id: 'coconut-milk', name: 'Coconut milk, canned', aisle: PANTRY, aliases: ['coconut milk', 'full fat coconut milk', 'canned coconut milk'], excludes: ['light coconut milk', 'coconut milk beverage', 'lite coconut milk'], state: 'canned', g: { unit: 226, cup: 226, can: 390 }, count: 'cans',
    source: `${SR}Nuts, coconut milk, canned (liquid expressed from grated meat and water)`, note: 'SR Legacy reports no sugar or fiber for this item; both are set to 0.',
    n: [197, 2.02, 2.81, 21.33, 18.915, 0, 0, 13, 0, 1, 0, 0, 18, 3.3, 220, 46, 0.56, 0] },
  { id: 'greek-yogurt', tags: ['dairy'], name: 'Greek yogurt, plain, nonfat', aisle: DAIRY, aliases: ['greek yogurt', 'greek yoghurt', 'nonfat greek yogurt'], state: 'raw', g: { unit: 170, cup: 245 },
    source: `${SR}Yogurt, Greek, plain, nonfat`, n: [59, 10.19, 3.6, 0.39, 0.117, 3.24, 0, 36, 1, 0, 0, 0.75, 110, 0.07, 141, 11, 0.52, 0] },
  { id: 'yogurt', tags: ['dairy'], name: 'Yogurt, plain, whole milk', aisle: DAIRY, aliases: ['yogurt', 'yoghurt', 'plain yogurt', 'natural yogurt', 'whole milk yogurt'], excludes: ['coconut yogurt', 'soy yogurt', 'almond yogurt', 'oat yogurt', 'frozen yogurt', 'dairy free yogurt'], state: 'raw', g: { unit: 170, cup: 245 },
    source: `${SR}Yogurt, plain, whole milk`, n: [61, 3.47, 4.66, 3.25, 2.096, 4.66, 0, 46, 27, 0.5, 0.1, 0.37, 121, 0.05, 155, 12, 0.59, 0.027] },
  { id: 'cottage-cheese', tags: ['dairy'], name: 'Cottage cheese, 2%', aisle: DAIRY, aliases: ['cottage cheese'], state: 'raw', g: { unit: 113, cup: 226 },
    source: `${SR}Cheese, cottage, lowfat, 2% milkfat`, n: [81, 10.45, 4.76, 2.27, 1.235, 4, 0, 308, 21, 0, 0, 0.47, 111, 0.16, 125, 9, 0.51, 0.01] },
  { id: 'cheddar', tags: ['dairy'], name: 'Cheddar cheese', aisle: DAIRY, aliases: ['cheddar', 'cheddar cheese', 'sharp cheddar'], state: 'raw', g: { unit: 28, cup: 113 },
    source: `${SR}Cheese, cheddar`, n: [403, 24.9, 1.28, 33.14, 21.092, 0.52, 0, 621, 265, 0, 0.6, 0.83, 721, 0.68, 98, 28, 3.11, 0.365] },
  { id: 'feta', tags: ['dairy'], name: 'Feta cheese', aisle: DAIRY, aliases: ['feta', 'feta cheese', 'crumbled feta'], state: 'raw', g: { unit: 28, cup: 150 },
    source: `${SR}Cheese, feta`, n: [264, 14.21, 4.09, 21.28, 14.946, 4.09, 0, 1116, 125, 0, 0.4, 1.69, 493, 0.65, 62, 19, 2.88, 0.265] },
  { id: 'mozzarella', tags: ['dairy'], name: 'Mozzarella, whole milk', aisle: DAIRY, aliases: ['mozzarella', 'mozzarella cheese', 'fresh mozzarella'], state: 'raw', g: { unit: 28, cup: 112 },
    source: `${SR}Cheese, mozzarella, whole milk`, n: [300, 22.17, 2.19, 22.35, 13.152, 1.03, 0, 627, 179, 0, 0.4, 2.28, 505, 0.44, 76, 20, 2.92, 0.372] },
  { id: 'parmesan', tags: ['dairy'], name: 'Parmesan cheese', aisle: DAIRY, aliases: ['parmesan', 'parmesan cheese', 'parmigiano reggiano', 'grated parmesan'], state: 'raw', g: { unit: 5, cup: 100 },
    source: `${SR}Cheese, parmesan, hard`, n: [392, 35.75, 3.22, 25.83, 16.41, 0.8, 0, 1602, 207, 0, 0.5, 1.2, 1184, 0.82, 92, 44, 2.75, 0.19] },
  { id: 'cream-cheese', tags: ['dairy'], name: 'Cream cheese', aisle: DAIRY, aliases: ['cream cheese'], state: 'raw', g: { unit: 29, cup: 232 },
    source: `${SR}Cheese, cream`, n: [350, 6.15, 5.52, 34.44, 20.213, 3.76, 0, 314, 308, 0, 0, 0.22, 97, 0.11, 132, 9, 0.5, 0.24] },
  { id: 'ricotta', tags: ['dairy'], name: 'Ricotta, whole milk', aisle: DAIRY, aliases: ['ricotta', 'ricotta cheese'], state: 'raw', g: { unit: 30, cup: 246 },
    source: `${SR}Cheese, ricotta, whole milk`, n: [174, 11.26, 3.04, 12.98, 8.295, 0.27, 0, 84, 120, 0, 0.2, 0.34, 207, 0.38, 105, 11, 1.16, 0.18] },
  { id: 'butter', tags: ['dairy'], name: 'Butter, salted', aisle: DAIRY, aliases: ['butter', 'salted butter'],
    excludes: ['butter bean', 'nut butter', 'peanut butter', 'almond butter', 'cashew butter', 'sunflower butter', 'seed butter', 'apple butter', 'cocoa butter', 'shea butter', 'butter lettuce', 'unsalted butter', 'butter flavored', 'vegan butter', 'plant based butter', 'dairy free butter'],
    state: 'raw', g: { unit: 113, cup: 227 },
    source: `${SR}Butter, salted`, n: [717, 0.85, 0.06, 81.11, 51.368, 0.06, 0, 643, 684, 0, 1.5, 0.17, 24, 0.02, 24, 2, 0.09, 0.315] },
  { id: 'butter-unsalted', tags: ['dairy'], name: 'Butter, unsalted', aisle: DAIRY, aliases: ['unsalted butter', 'sweet cream butter'], state: 'raw', g: { unit: 113, cup: 227 },
    source: `${SR}Butter, without salt`, n: [717, 0.85, 0.06, 81.11, 51.368, 0.06, 0, 11, 684, 0, 1.5, 0.17, 24, 0.02, 24, 2, 0.09, 0.315] },
  { id: 'heavy-cream', tags: ['dairy'], name: 'Heavy whipping cream', aisle: DAIRY, aliases: ['heavy cream', 'heavy whipping cream', 'whipping cream', 'double cream'], state: 'raw', g: { unit: 15, cup: 238 },
    source: `${SR}Cream, fluid, heavy whipping`, note: 'Sugar capped at total carbohydrate.',
    n: [345, 2.05, 2.79, 37, 23.032, 2.79, 0, 38, 411, 0.6, 1.6, 0.18, 65, 0.03, 75, 7, 0.23, 0.21] },
  { id: 'eggs', tags: ['eggs'], name: 'Egg, whole', aisle: DAIRY, aliases: ['egg', 'large egg', 'whole egg'], excludes: ['egg white', 'egg yolk', 'egg noodle', 'egg roll'], state: 'raw', g: { unit: 50, cup: 243 }, count: 'eggs',
    source: `${SR}Egg, whole, raw, fresh`, n: [143, 12.56, 0.72, 9.51, 3.126, 0.37, 0, 142, 160, 0, 2, 0.89, 56, 1.75, 138, 12, 1.29, 0.09] },
  { id: 'egg-white', tags: ['eggs'], name: 'Egg white', aisle: DAIRY, aliases: ['egg white', 'liquid egg white'], state: 'raw', g: { unit: 33, cup: 243 },
    source: `${SR}Egg, white, raw, fresh`, n: [52, 10.9, 0.73, 0.17, 0, 0.71, 0, 166, 0, 0, 0, 0.09, 7, 0.08, 163, 11, 0.03, 0] },

  // ---------- Meat, poultry, fish & soy protein ----------
  { id: 'chicken', tags: ['meat'], name: 'Chicken breast, raw', aisle: MEAT, aliases: ['chicken', 'chicken breast', 'boneless chicken breast', 'skinless chicken breast', 'chicken tender'], excludes: ['chicken sausage', 'chicken nugget', 'chicken bouillon'], group: 'chicken-breast', state: 'raw', g: { unit: 200, cup: 140 },
    source: `${SR}Chicken, broilers or fryers, breast, meat only, raw`, n: [120, 22.5, 0, 2.62, 0.563, 0, 0, 45, 9, 0, 0.1, 0.21, 5, 0.37, 334, 28, 0.68, 0.03] },
  { id: 'chicken-cooked', tags: ['meat'], name: 'Chicken breast, roasted', aisle: MEAT, aliases: ['shredded chicken', 'rotisserie chicken'], group: 'chicken-breast', state: 'cooked', g: { unit: 140, cup: 140 },
    source: `${SR}Chicken, broilers or fryers, breast, meat only, cooked, roasted`, n: [165, 31.02, 0, 3.57, 1.01, 0, 0, 74, 6, 0, 0.1, 0.34, 15, 1.04, 256, 29, 1, 0.07] },
  { id: 'chicken-thigh', tags: ['meat'], name: 'Chicken thigh, raw', aisle: MEAT, aliases: ['chicken thigh', 'boneless chicken thigh', 'skinless chicken thigh'], state: 'raw', g: { unit: 115, cup: 140 },
    source: `${SR}Chicken, broilers or fryers, thigh, meat only, raw`, n: [121, 19.66, 0, 4.12, 1.04, 0, 0, 95, 8, 0, 0.1, 0.56, 7, 0.81, 230, 23, 1.59, 0.03] },
  { id: 'ground-turkey', tags: ['meat'], name: 'Ground turkey, 93% lean, raw', aisle: MEAT, aliases: ['ground turkey', 'turkey mince', 'minced turkey', 'lean ground turkey'], state: 'raw', g: { unit: 113, cup: 225 },
    source: `${SR}Turkey, ground, 93% lean, 7% fat, raw`, n: [150, 18.73, 0, 8.34, 2.17, 0, 0, 69, 0, 0, 0.3, 1.24, 21, 1.17, 213, 21, 2.27, 0.08] },
  { id: 'beef', tags: ['meat'], name: 'Ground beef, 90% lean, raw', aisle: MEAT, aliases: ['ground beef', 'lean ground beef', 'beef mince', 'minced beef', 'extra lean ground beef'], state: 'raw', g: { unit: 113, cup: 225 },
    source: `${SR}Beef, ground, 90% lean meat / 10% fat, raw`, n: [176, 20, 0, 10, 3.9, 0, 0, 66, 0, 0, 0.1, 2.14, 12, 2.21, 321, 20, 4.79, 0.04] },
  { id: 'pork-tenderloin', tags: ['meat'], name: 'Pork tenderloin, raw', aisle: MEAT, aliases: ['pork tenderloin', 'pork loin'], state: 'raw', g: { unit: 450, cup: 140 },
    source: `${SR}Pork, fresh, loin, tenderloin, separable lean only, raw`, n: [109, 20.65, 0, 2.17, 0.73, 0, 0, 53, 0, 0, 0.5, 0.51, 5, 0.98, 399, 27, 1.89, 0.01] },
  { id: 'salmon', tags: ['fish'], name: 'Salmon, Atlantic, farmed, raw', aisle: MEAT, aliases: ['salmon', 'salmon fillet', 'atlantic salmon'], excludes: ['smoked salmon', 'canned salmon'], state: 'raw', g: { unit: 170, cup: 140 }, count: 'fillets',
    source: `${SR}Fish, salmon, Atlantic, farmed, raw`, n: [208, 20.42, 0, 13.42, 3.05, 0, 0, 59, 58, 0, 11, 3.23, 9, 0.34, 363, 27, 0.36, 2.44] },
  { id: 'tuna', tags: ['fish'], name: 'Tuna, light, canned in water', aisle: MEAT, aliases: ['tuna', 'canned tuna', 'light tuna', 'tuna in water'], excludes: ['tuna steak', 'ahi'], state: 'canned', g: { unit: 120, cup: 154, can: 120 }, count: 'cans',
    source: `${SR}Fish, tuna, light, canned in water, drained solids`, n: [116, 25.51, 0, 0.82, 0.234, 0, 0, 338, 17, 0, 1.7, 2.99, 11, 1.53, 237, 27, 0.77, 0.27] },
  { id: 'sardines', tags: ['fish'], name: 'Sardines, canned in oil, drained', aisle: MEAT, aliases: ['sardine'], state: 'canned', g: { unit: 12, cup: 149, can: 92 }, count: 'cans',
    source: `${SR}Fish, sardine, Atlantic, canned in oil, drained solids with bone`, n: [208, 24.62, 0, 11.45, 1.528, 0, 0, 307, 32, 0, 4.8, 8.94, 382, 2.92, 397, 39, 1.31, 1.48] },
  { id: 'shrimp', tags: ['shellfish'], name: 'Shrimp, raw', aisle: MEAT, aliases: ['shrimp', 'prawn', 'jumbo shrimp'], state: 'raw', g: { unit: 7, cup: 145 },
    source: `${SR}Crustaceans, shrimp, raw`, note: 'Sodium is higher in brined or previously frozen shrimp.',
    n: [85, 20.1, 0, 0.51, 0.101, 0, 0, 119, 0, 0, 0, 1.11, 64, 0.21, 264, 35, 1.34, 0.2] },
  { id: 'cod', tags: ['fish'], name: 'Cod, Atlantic, raw', aisle: MEAT, aliases: ['cod', 'cod fillet', 'atlantic cod'], state: 'raw', g: { unit: 180, cup: 140 }, count: 'fillets',
    source: `${SR}Fish, cod, Atlantic, raw`, n: [82, 17.81, 0, 0.67, 0.131, 0, 0, 54, 12, 1, 0.9, 0.91, 16, 0.38, 413, 32, 0.45, 0.2] },
  { id: 'tilapia', tags: ['fish'], name: 'Tilapia, raw', aisle: MEAT, aliases: ['tilapia', 'tilapia fillet'], state: 'raw', g: { unit: 116, cup: 140 }, count: 'fillets',
    source: `${SR}Fish, tilapia, raw`, n: [96, 20.08, 0, 1.7, 0.585, 0, 0, 52, 0, 0, 3.1, 1.58, 10, 0.56, 302, 27, 0.33, 0.14] },
  { id: 'tofu', tags: ['soy', 'legumes'], name: 'Tofu, firm (calcium-set)', aisle: PRODUCE, aliases: ['tofu', 'firm tofu', 'extra firm tofu'], excludes: ['silken tofu'], state: 'raw', g: { unit: 397, cup: 248 },
    source: `${SR}Tofu, raw, firm, prepared with calcium sulfate`, n: [144, 17.27, 2.78, 8.72, 1.261, 0.6, 2.3, 14, 0, 0.2, 0, 0, 683, 2.66, 237, 58, 1.57, 0.582] },

  // ---------- Grains: dry and cooked ----------
  { id: 'white-rice-dry', tags: ['grains'], name: 'White rice, long-grain, dry', aisle: PANTRY, aliases: ['rice', 'white rice', 'long grain rice', 'jasmine rice', 'basmati rice', 'long grain white rice'], excludes: ['wild rice', 'brown rice', 'cauliflower rice', 'rice cake'], group: 'white-rice', state: 'dry', g: { unit: 45, cup: 185 },
    source: `${SR}Rice, white, long-grain, regular, raw, enriched`, n: [365, 7.13, 79.95, 0.66, 0.18, 0.12, 1.3, 5, 0, 0, 0, 0, 28, 4.31, 115, 25, 1.09, 0.01] },
  { id: 'white-rice-cooked', tags: ['grains'], name: 'White rice, long-grain, cooked', aisle: PANTRY, aliases: ['steamed rice'], group: 'white-rice', state: 'cooked', g: { unit: 158, cup: 158 },
    source: `${SR}Rice, white, long-grain, regular, enriched, cooked`, n: [130, 2.69, 28.17, 0.28, 0.077, 0.05, 0.4, 1, 0, 0, 0, 0, 10, 1.2, 35, 12, 0.49, 0.01] },
  { id: 'brown-rice', tags: ['grains'], name: 'Brown rice, long-grain, dry', aisle: PANTRY, aliases: ['brown rice', 'long grain brown rice'], group: 'brown-rice', state: 'dry', g: { unit: 45, cup: 185 },
    source: `${SR}Rice, brown, long-grain, raw`, n: [370, 7.94, 77.24, 2.92, 0.584, 0.85, 3.5, 7, 0, 0, 0, 0, 23, 1.47, 223, 143, 2.02, 0.04] },
  { id: 'brown-rice-cooked', tags: ['grains'], name: 'Brown rice, long-grain, cooked', aisle: PANTRY, aliases: [], group: 'brown-rice', state: 'cooked', g: { unit: 195, cup: 195 },
    source: `${SR}Rice, brown, long-grain, cooked`, n: [111, 2.58, 22.96, 0.9, 0.18, 0.35, 1.8, 5, 0, 0, 0, 0, 10, 0.42, 43, 43, 0.63, 0.01] },
  { id: 'oats', tags: ['gluten', 'grains'], name: 'Rolled oats, dry', aisle: PANTRY, aliases: ['oats', 'rolled oats', 'oatmeal', 'old fashioned oats', 'quick oats', 'porridge oats'], excludes: ['oat milk', 'oat flour', 'steel cut', 'gluten free'], group: 'oats', state: 'dry', g: { unit: 40, cup: 81 },
    source: `${SR}Cereals, oats, regular and quick, not fortified, dry`, note: 'Oats are naturally gluten-free but often cross-contaminated; not tagged gluten.',
    n: [379, 13.15, 67.7, 6.52, 1.11, 0.99, 10.1, 6, 0, 0, 0, 0, 52, 4.25, 362, 138, 3.64, 0.11] },
  { id: 'oats-cooked', tags: ['gluten', 'grains'], name: 'Oatmeal, cooked with water', aisle: PANTRY, aliases: ['porridge'], group: 'oats', state: 'cooked', g: { unit: 234, cup: 234 },
    source: `${SR}Cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt`,
    n: [71, 2.54, 12, 1.52, 0.31, 0.27, 1.7, 4, 0, 0, 0, 0, 9, 0.9, 70, 27, 1, 0.02] },
  { id: 'quinoa', tags: ['grains'], name: 'Quinoa, dry', aisle: PANTRY, aliases: ['quinoa'], group: 'quinoa', state: 'dry', g: { unit: 45, cup: 170 },
    source: `${SR}Quinoa, uncooked`, note: 'SR Legacy reports no sugar value for uncooked quinoa; set to 0.',
    n: [368, 14.12, 64.16, 6.07, 0.706, 0, 7, 5, 1, 0, 0, 0, 47, 4.57, 563, 197, 3.1, 0.26] },
  { id: 'quinoa-cooked', tags: ['grains'], name: 'Quinoa, cooked', aisle: PANTRY, aliases: [], group: 'quinoa', state: 'cooked', g: { unit: 185, cup: 185 },
    source: `${SR}Quinoa, cooked`, n: [120, 4.4, 21.3, 1.92, 0.231, 0.87, 2.8, 7, 0, 0, 0, 0, 17, 1.49, 172, 64, 1.09, 0.084] },
  { id: 'pasta', tags: ['gluten', 'grains'], name: 'Pasta, enriched, dry', aisle: PANTRY, aliases: ['pasta', 'spaghetti', 'penne', 'macaroni', 'fusilli', 'linguine', 'fettuccine', 'rigatoni', 'elbow macaroni', 'whole wheat pasta'], excludes: ['pasta sauce', 'rice noodle', 'egg noodle', 'gluten free', 'rice pasta'], group: 'pasta', state: 'dry', g: { unit: 56, cup: 100 },
    source: `${SR}Pasta, dry, enriched`, note: 'Whole-wheat pasta is matched here too: similar energy, but it has roughly 2–3× the fiber.',
    n: [371, 13.04, 74.67, 1.51, 0.277, 2.67, 3.2, 6, 0, 0, 0, 0, 21, 3.3, 223, 53, 1.41, 0.03] },
  { id: 'pasta-cooked', tags: ['gluten', 'grains'], name: 'Pasta, enriched, cooked', aisle: PANTRY, aliases: [], group: 'pasta', state: 'cooked', g: { unit: 140, cup: 140 },
    source: `${SR}Pasta, cooked, enriched, without added salt`, n: [158, 5.8, 30.86, 0.93, 0.176, 0.56, 1.8, 1, 0, 0, 0, 0, 7, 1.28, 44, 18, 0.51, 0.02] },
  { id: 'couscous-dry', tags: ['gluten', 'grains'], name: 'Couscous, dry', aisle: PANTRY, aliases: ['couscous'], excludes: ['pearl couscous', 'israeli couscous'], group: 'couscous', state: 'dry', g: { unit: 45, cup: 173 },
    source: `${SR}Couscous, dry`, note: 'SR Legacy reports no sugar value; set to 0.',
    n: [376, 12.76, 77.43, 0.64, 0.117, 0, 5, 10, 0, 0, 0, 0, 24, 1.08, 166, 44, 0.83, 0.01] },
  { id: 'couscous-cooked', tags: ['gluten', 'grains'], name: 'Couscous, cooked', aisle: PANTRY, aliases: [], group: 'couscous', state: 'cooked', g: { unit: 157, cup: 157 },
    source: `${SR}Couscous, cooked`, n: [112, 3.79, 23.22, 0.16, 0.029, 0.1, 1.4, 5, 0, 0, 0, 0, 8, 0.38, 58, 8, 0.26, 0.003] },
  { id: 'barley-dry', tags: ['gluten', 'grains'], name: 'Barley, pearled, dry', aisle: PANTRY, aliases: ['barley', 'pearl barley', 'pearled barley'], group: 'barley', state: 'dry', g: { unit: 45, cup: 200 },
    source: `${SR}Barley, pearled, raw`, n: [352, 9.91, 77.72, 1.16, 0.244, 0.8, 15.6, 9, 1, 0, 0, 0, 29, 2.5, 280, 79, 2.13, 0.077] },
  { id: 'barley-cooked', tags: ['gluten', 'grains'], name: 'Barley, pearled, cooked', aisle: PANTRY, aliases: [], group: 'barley', state: 'cooked', g: { unit: 157, cup: 157 },
    source: `${SR}Barley, pearled, cooked`, n: [123, 2.26, 28.22, 0.44, 0.093, 0.28, 3.8, 3, 0, 0, 0, 0, 11, 1.33, 93, 22, 0.82, 0.03] },
  { id: 'bread', tags: ['gluten', 'grains'], name: 'Whole wheat bread', aisle: PANTRY, aliases: ['bread', 'toast', 'whole wheat bread', 'wholemeal bread', 'whole grain bread', 'whole wheat toast'], excludes: ['bread crumb', 'breadcrumb', 'banana bread', 'corn bread', 'cornbread', 'white bread', 'gluten free'], state: 'cooked', g: { unit: 32, cup: 45 }, count: 'slices',
    source: `${SR}Bread, whole-wheat, commercially prepared`, n: [252, 12.45, 42.71, 3.5, 0.719, 4.41, 6, 450, 0, 0, 0, 0, 161, 2.47, 248, 76, 1.77, 0.07] },
  { id: 'corn-tortilla', tags: ['grains'], name: 'Corn tortilla', aisle: PANTRY, aliases: ['corn tortilla'], state: 'cooked', g: { unit: 26, cup: 26 }, count: 'pcs',
    source: `${SR}Tortillas, ready-to-bake or -fry, corn`, n: [218, 5.7, 44.64, 2.85, 0.394, 0.88, 6.3, 45, 0, 0, 0, 0, 81, 1.23, 186, 72, 1.31, 0.03] },
  { id: 'flour', tags: ['gluten', 'grains'], name: 'All-purpose flour, enriched', aisle: PANTRY, aliases: ['flour', 'all purpose flour', 'plain flour', 'white flour', 'wheat flour'], excludes: ['almond flour', 'coconut flour', 'rice flour', 'oat flour', 'chickpea flour', 'whole wheat flour', 'corn flour', 'cornflour', 'buckwheat flour', 'tapioca flour'], state: 'dry', g: { unit: 8, cup: 125 },
    source: `${SR}Wheat flour, white, all-purpose, enriched, bleached`, n: [364, 10.33, 76.31, 0.98, 0.155, 0.27, 2.7, 2, 0, 0, 0, 0, 15, 4.64, 107, 22, 0.7, 0.022] },
  { id: 'flour-whole-wheat', tags: ['gluten', 'grains'], name: 'Whole wheat flour', aisle: PANTRY, aliases: ['whole wheat flour', 'wholemeal flour'], state: 'dry', g: { unit: 8, cup: 120 },
    source: `${SR}Flour, whole wheat, unenriched`, n: [340, 13.21, 71.97, 2.5, 0.43, 0.41, 10.7, 2, 0, 0, 0, 0, 34, 3.6, 363, 137, 2.6, 0.07] },

  // ---------- Legumes: dry, cooked ----------
  { id: 'lentils', tags: ['legumes'], name: 'Lentils, dry', aisle: PANTRY, aliases: ['lentil', 'red lentil', 'green lentil', 'brown lentil', 'split red lentil'], group: 'lentils', state: 'dry', g: { unit: 50, cup: 192 },
    source: `${SR}Lentils, raw`, note: 'Red lentils also match here; SR "Lentils, pink or red, raw" is within about 5% for energy and protein.',
    n: [352, 24.63, 63.35, 1.06, 0.154, 2.03, 10.7, 6, 2, 4.5, 0, 0, 35, 6.51, 677, 47, 3.27, 0.11] },
  { id: 'lentils-cooked', tags: ['legumes'], name: 'Lentils, cooked', aisle: PANTRY, aliases: [], group: 'lentils', state: 'cooked', g: { unit: 198, cup: 198, can: 240 },
    source: `${SR}Lentils, mature seeds, cooked, boiled, without salt`, n: [116, 9.02, 20.13, 0.38, 0.053, 1.8, 7.9, 2, 0, 1.5, 0, 0, 19, 3.33, 369, 36, 1.27, 0.037] },
  { id: 'black-beans-dry', tags: ['legumes'], name: 'Black beans, dry', aisle: PANTRY, aliases: [], group: 'black-beans', state: 'dry', g: { unit: 50, cup: 194 },
    source: `${SR}Beans, black, mature seeds, raw`, n: [341, 21.6, 62.36, 1.42, 0.366, 2.12, 15.5, 5, 1, 0, 0, 0, 123, 5.02, 1483, 171, 3.65, 0.1] },
  { id: 'black-beans', tags: ['legumes'], name: 'Black beans, cooked', aisle: PANTRY, aliases: ['black beans', 'black bean', 'black turtle beans'], group: 'black-beans', state: 'cooked', g: { unit: 172, cup: 172, can: 240 }, count: 'cans',
    source: `${SR}Beans, black, mature seeds, cooked, boiled, without salt`, note: 'Canned beans match here too; canned versions add roughly 100–400 mg sodium per 100 g (less when rinsed).',
    n: [132, 8.86, 23.71, 0.54, 0.139, 0.32, 8.7, 1, 0, 0, 0, 0, 27, 2.1, 355, 70, 1.12, 0.1] },
  { id: 'kidney-beans-cooked', tags: ['legumes'], name: 'Kidney beans, cooked', aisle: PANTRY, aliases: ['kidney beans', 'kidney bean', 'red kidney beans'], state: 'cooked', g: { unit: 177, cup: 177, can: 240 }, count: 'cans',
    source: `${SR}Beans, kidney, red, mature seeds, cooked, boiled, without salt`, note: 'Canned kidney beans add sodium not reflected here.',
    n: [127, 8.67, 22.8, 0.5, 0.073, 0.32, 6.4, 1, 0, 1.2, 0, 0, 28, 2.94, 405, 45, 1.07, 0.1] },
  { id: 'chickpeas-dry', tags: ['legumes'], name: 'Chickpeas, dry', aisle: PANTRY, aliases: [], group: 'chickpeas', state: 'dry', g: { unit: 50, cup: 200 },
    source: `${SR}Chickpeas (garbanzo beans, bengal gram), mature seeds, raw`, n: [378, 20.47, 62.95, 6.04, 0.603, 10.7, 12.2, 24, 3, 4, 0, 0, 57, 4.31, 718, 79, 2.76, 0.1] },
  { id: 'chickpeas', tags: ['legumes'], name: 'Chickpeas, cooked', aisle: PANTRY, aliases: ['chickpea', 'chickpeas', 'garbanzo', 'garbanzo beans', 'garbanzo bean'], excludes: ['chickpea flour'], group: 'chickpeas', state: 'cooked', g: { unit: 164, cup: 164, can: 240 }, count: 'cans',
    source: `${SR}Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt`, note: 'Canned chickpeas match here too; canned versions add sodium.',
    n: [164, 8.86, 27.42, 2.59, 0.269, 4.8, 7.6, 7, 1, 1.3, 0, 0, 49, 2.89, 291, 48, 1.53, 0.043] },
  { id: 'pinto-beans-cooked', tags: ['legumes'], name: 'Pinto beans, cooked', aisle: PANTRY, aliases: ['pinto beans', 'pinto bean'], state: 'cooked', g: { unit: 171, cup: 171, can: 240 }, count: 'cans',
    source: `${SR}Beans, pinto, mature seeds, cooked, boiled, without salt`, n: [143, 9.01, 26.22, 0.65, 0.136, 0.34, 9, 1, 0, 0.8, 0, 0, 46, 2.09, 436, 50, 0.98, 0.14] },
  { id: 'lima-beans-dry', tags: ['legumes'], name: 'Lima (butter) beans, dry', aisle: PANTRY, aliases: [], group: 'lima-beans', state: 'dry', g: { unit: 50, cup: 178 },
    source: `${SR}Lima beans, large, mature seeds, raw`, n: [338, 21.46, 63.38, 0.69, 0.161, 8.5, 19, 18, 0, 0, 0, 0, 81, 7.51, 1724, 224, 2.83, 0.05] },
  { id: 'lima-beans-cooked', tags: ['legumes'], name: 'Lima (butter) beans, cooked', aisle: PANTRY, aliases: ['butter beans', 'butter bean', 'lima beans', 'lima bean'], group: 'lima-beans', state: 'cooked', g: { unit: 188, cup: 188, can: 240 }, count: 'cans',
    source: `${SR}Lima beans, large, mature seeds, cooked, boiled, without salt`, n: [115, 7.8, 20.88, 0.38, 0.089, 2.9, 7, 2, 0, 0, 0, 0, 17, 2.39, 508, 43, 0.95, 0.02] },
  { id: 'white-beans-cooked', tags: ['legumes'], name: 'White beans, cooked', aisle: PANTRY, aliases: ['white beans', 'white bean', 'cannellini beans', 'cannellini bean', 'cannellini'], state: 'cooked', g: { unit: 179, cup: 179, can: 240 }, count: 'cans',
    source: `${SR}Beans, white, mature seeds, cooked, boiled, without salt`, n: [139, 9.73, 25.09, 0.35, 0.091, 0.34, 6.3, 6, 0, 0, 0, 0, 90, 3.7, 561, 63, 1.38, 0.05] },
  { id: 'hummus', tags: ['legumes'], name: 'Hummus', aisle: PANTRY, aliases: ['hummus', 'houmous'], state: 'cooked', g: { unit: 15, cup: 246 },
    source: `${SR}Hummus, commercial`, n: [166, 7.9, 14.29, 9.6, 1.437, 0.27, 6, 379, 1, 0, 0, 0, 38, 2.44, 228, 71, 1.83, 0.17] },
  { id: 'peanuts', tags: ['peanuts', 'legumes'], name: 'Peanuts', aisle: PANTRY, aliases: ['peanut', 'raw peanut'], state: 'raw', g: { unit: 1, cup: 146 },
    source: `${SR}Peanuts, all types, raw`, n: [567, 25.8, 16.13, 49.24, 6.279, 4.72, 8.5, 18, 0, 0, 0, 0, 92, 4.58, 705, 168, 3.27, 0.003] },
  { id: 'peanut-butter', tags: ['peanuts', 'legumes'], name: 'Peanut butter, smooth', aisle: PANTRY, aliases: ['peanut butter', 'creamy peanut butter', 'smooth peanut butter'], state: 'raw', g: { unit: 32, cup: 258 },
    source: `${SR}Peanut butter, smooth style, with salt`, n: [588, 25.09, 19.56, 50.39, 10.29, 9.22, 6, 459, 0, 0, 0, 0, 43, 1.87, 649, 154, 2.91, 0.03] },

  // ---------- Nuts & seeds ----------
  { id: 'almonds', tags: ['tree_nuts'], name: 'Almonds', aisle: PANTRY, aliases: ['almond', 'sliced almond', 'slivered almond'], state: 'raw', g: { unit: 1.2, cup: 143 },
    source: `${SR}Nuts, almonds`, n: [579, 21.15, 21.55, 49.93, 3.802, 4.35, 12.5, 1, 0, 0, 0, 0, 269, 3.71, 733, 270, 3.12, 0.003] },
  { id: 'almond-butter', tags: ['tree_nuts'], name: 'Almond butter', aisle: PANTRY, aliases: ['almond butter'], state: 'raw', g: { unit: 16, cup: 256 },
    source: `${SR}Nuts, almond butter, plain, without salt added`, n: [614, 20.96, 18.82, 55.5, 4.152, 4.43, 10.3, 7, 0, 0, 0, 0, 347, 3.49, 748, 279, 3.29, 0.003] },
  { id: 'walnuts', tags: ['tree_nuts'], name: 'Walnuts', aisle: PANTRY, aliases: ['walnut', 'english walnut'], state: 'raw', g: { unit: 4, cup: 117 },
    source: `${SR}Nuts, walnuts, english`, n: [654, 15.23, 13.71, 65.21, 6.126, 2.61, 6.7, 2, 1, 1.3, 0, 0, 98, 2.91, 441, 158, 3.09, 9.08] },
  { id: 'cashews', tags: ['tree_nuts'], name: 'Cashews', aisle: PANTRY, aliases: ['cashew', 'raw cashew'], state: 'raw', g: { unit: 1.5, cup: 137 },
    source: `${SR}Nuts, cashew nuts, raw`, n: [553, 18.22, 30.19, 43.85, 7.783, 5.91, 3.3, 12, 0, 0.5, 0, 0, 37, 6.68, 660, 292, 5.78, 0.062] },
  { id: 'pecans', tags: ['tree_nuts'], name: 'Pecans', aisle: PANTRY, aliases: ['pecan', 'pecan half'], state: 'raw', g: { unit: 1.4, cup: 109 },
    source: `${SR}Nuts, pecans`, n: [691, 9.17, 13.86, 71.97, 6.18, 3.97, 9.6, 0, 3, 1.1, 0, 0, 70, 2.53, 410, 121, 4.53, 0.986] },
  { id: 'pistachios', tags: ['tree_nuts'], name: 'Pistachios', aisle: PANTRY, aliases: ['pistachio'], state: 'raw', g: { unit: 0.7, cup: 123 },
    source: `${SR}Nuts, pistachio nuts, raw`, n: [560, 20.16, 27.17, 45.32, 5.907, 7.66, 10.6, 1, 26, 5.6, 0, 0, 105, 3.92, 1025, 121, 2.2, 0.254] },
  { id: 'chia', name: 'Chia seeds', aisle: PANTRY, aliases: ['chia', 'chia seed'], state: 'dry', g: { unit: 12, cup: 192 },
    source: `${SR}Seeds, chia seeds, dried`, n: [486, 16.54, 42.12, 30.74, 3.33, 0, 34.4, 16, 0, 1.6, 0, 0, 631, 7.72, 407, 335, 4.58, 17.83] },
  { id: 'flaxseed', name: 'Flaxseed', aisle: PANTRY, aliases: ['flaxseed', 'flax seed', 'ground flaxseed', 'flax meal', 'linseed', 'ground flax'], state: 'dry', g: { unit: 10, cup: 168 },
    source: `${SR}Seeds, flaxseed`, n: [534, 18.29, 28.88, 42.16, 3.663, 1.55, 27.3, 30, 0, 0.6, 0, 0, 255, 5.73, 813, 392, 4.34, 22.81] },
  { id: 'sesame-seeds', name: 'Sesame seeds', aisle: PANTRY, aliases: ['sesame seed', 'sesame', 'toasted sesame seed'], state: 'dry', g: { unit: 9, cup: 144 },
    source: `${SR}Seeds, sesame seeds, whole, dried`, n: [573, 17.73, 23.45, 49.67, 6.957, 0.3, 11.8, 11, 0, 0, 0, 0, 975, 14.55, 468, 351, 7.75, 0.376] },
  { id: 'pumpkin-seeds', name: 'Pumpkin seeds (pepitas)', aisle: PANTRY, aliases: ['pumpkin seed', 'pepitas', 'pepita'], state: 'dry', g: { unit: 9, cup: 129 },
    source: `${SR}Seeds, pumpkin and squash seed kernels, dried`, n: [559, 30.23, 10.71, 49.05, 8.659, 1.4, 6, 7, 1, 1.9, 0, 0, 46, 8.82, 809, 592, 7.81, 0.121] },
  { id: 'sunflower-seeds', name: 'Sunflower seeds', aisle: PANTRY, aliases: ['sunflower seed', 'sunflower kernel'], state: 'dry', g: { unit: 9, cup: 140 },
    source: `${SR}Seeds, sunflower seed kernels, dried`, n: [584, 20.78, 20, 51.46, 4.455, 2.62, 8.6, 9, 3, 1.4, 0, 0, 78, 5.25, 645, 325, 5, 0.062] },
  { id: 'tahini', name: 'Tahini', aisle: PANTRY, aliases: ['tahini', 'tahina', 'sesame paste'], state: 'raw', g: { unit: 15, cup: 240 },
    source: `${SR}Seeds, sesame butter, tahini, from roasted and toasted kernels (most common type)`, n: [595, 17, 21.19, 53.76, 7.529, 0.49, 9.3, 115, 3, 0, 0, 0, 426, 8.95, 414, 95, 4.62, 0.37] },

  // ---------- Oils ----------
  { id: 'olive-oil', name: 'Olive oil', aisle: PANTRY, aliases: ['oil', 'olive oil', 'extra virgin olive oil', 'light olive oil'], excludes: ['oil spray', 'cooking spray'], state: 'raw', g: { unit: 14, cup: 216 },
    source: `${SR}Oil, olive, salad or cooking`, note: 'Unspecified "oil" is matched to olive oil.',
    n: [884, 0, 0, 100, 13.808, 0, 0, 2, 0, 0, 0, 0, 1, 0.56, 1, 0, 0, 0.761] },
  { id: 'canola-oil', name: 'Canola oil', aisle: PANTRY, aliases: ['canola oil', 'rapeseed oil'], state: 'raw', g: { unit: 14, cup: 218 },
    source: `${SR}Oil, canola`, n: [884, 0, 0, 100, 7.365, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9.137] },
  { id: 'vegetable-oil', name: 'Vegetable (soybean) oil', aisle: PANTRY, aliases: ['vegetable oil', 'soybean oil'], state: 'raw', g: { unit: 14, cup: 218 },
    source: `${SR}Oil, soybean, salad or cooking`, note: 'Most US "vegetable oil" is soybean oil.',
    n: [884, 0, 0, 100, 15.65, 0, 0, 0, 0, 0, 0, 0, 0, 0.05, 0, 0, 0, 6.789] },
  { id: 'coconut-oil', name: 'Coconut oil', aisle: PANTRY, aliases: ['coconut oil'], state: 'raw', g: { unit: 14, cup: 218 },
    source: `${SR}Oil, coconut`, n: [892, 0, 0, 99.06, 82.475, 0, 0, 0, 0, 0, 0, 0, 1, 0.05, 0, 0, 0.02, 0.019] },
  { id: 'sesame-oil', name: 'Sesame oil', aisle: PANTRY, aliases: ['sesame oil', 'toasted sesame oil'], state: 'raw', g: { unit: 14, cup: 218 },
    source: `${SR}Oil, sesame, salad or cooking`, n: [884, 0, 0, 100, 14.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3] },
  { id: 'avocado-oil', name: 'Avocado oil', aisle: PANTRY, aliases: ['avocado oil'], state: 'raw', g: { unit: 14, cup: 218 },
    source: `${SR}Oil, avocado`, n: [884, 0, 0, 100, 11.56, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.957] },

  // ---------- Condiments, sweeteners & baking ----------
  { id: 'soy-sauce', tags: ['soy', 'gluten', 'legumes'], name: 'Soy sauce', aisle: PANTRY, aliases: ['soy sauce', 'shoyu'], excludes: ['low sodium soy sauce', 'reduced sodium soy sauce', 'lite soy sauce'], state: 'raw', g: { unit: 16, cup: 255 },
    source: `${SR}Soy sauce made from soy and wheat (shoyu)`, n: [53, 8.14, 4.93, 0.57, 0.073, 0.4, 0.8, 5493, 0, 0, 0, 0, 33, 1.45, 435, 74, 0.43, 0] },
  { id: 'ketchup', tags: ['sugar'], name: 'Ketchup', aisle: PANTRY, aliases: ['ketchup', 'catsup', 'tomato ketchup'], state: 'raw', g: { unit: 17, cup: 272 },
    source: `${SR}Catsup`, n: [101, 1.04, 27.4, 0.1, 0.014, 22.77, 0.3, 907, 26, 4.1, 0, 0, 15, 0.35, 281, 13, 0.17, 0] },
  { id: 'mustard', name: 'Mustard, prepared yellow', aisle: PANTRY, aliases: ['mustard', 'yellow mustard', 'prepared mustard', 'dijon mustard', 'dijon'], excludes: ['mustard seed', 'mustard powder', 'dry mustard', 'mustard green', 'honey mustard'], state: 'raw', g: { unit: 5, cup: 250 },
    source: `${SR}Mustard, prepared, yellow`, n: [60, 3.74, 5.83, 3.34, 0.214, 0.92, 4, 1104, 2, 0.3, 0, 0, 63, 1.61, 138, 48, 0.64, 0.05] },
  { id: 'vinegar', name: 'Vinegar, distilled', aisle: PANTRY, aliases: ['vinegar', 'white vinegar', 'distilled vinegar', 'rice vinegar', 'white wine vinegar', 'red wine vinegar'], state: 'raw', g: { unit: 15, cup: 238 },
    source: `${SR}Vinegar, distilled`, note: 'Energy comes from acetic acid, not from protein, carbohydrate or fat.',
    n: [18, 0, 0.04, 0, 0, 0.04, 0, 2, 0, 0, 0, 0, 6, 0.03, 2, 1, 0.01, 0] },
  { id: 'cider-vinegar', name: 'Apple cider vinegar', aisle: PANTRY, aliases: ['apple cider vinegar', 'cider vinegar'], state: 'raw', g: { unit: 15, cup: 239 },
    source: `${SR}Vinegar, cider`, note: 'Energy comes mostly from acetic acid.',
    n: [21, 0, 0.93, 0, 0, 0.4, 0, 5, 0, 0, 0, 0, 7, 0.2, 73, 5, 0.04, 0] },
  { id: 'balsamic-vinegar', name: 'Balsamic vinegar', aisle: PANTRY, aliases: ['balsamic vinegar', 'balsamic'], state: 'raw', g: { unit: 16, cup: 255 },
    source: `${SR}Vinegar, balsamic`, n: [88, 0.49, 17.03, 0, 0, 14.95, 0, 23, 0, 0, 0, 0, 27, 0.72, 112, 12, 0.08, 0] },
  { id: 'honey', tags: ['honey', 'sugar'], name: 'Honey', aisle: PANTRY, aliases: ['honey', 'raw honey'], excludes: ['honey mustard'], state: 'raw', g: { unit: 21, cup: 339 },
    source: `${SR}Honey`, n: [304, 0.3, 82.4, 0, 0, 82.12, 0.2, 4, 0, 0.5, 0, 0, 6, 0.42, 52, 2, 0.22, 0] },
  { id: 'maple-syrup', tags: ['sugar'], name: 'Maple syrup', aisle: PANTRY, aliases: ['maple syrup', 'pure maple syrup'], state: 'raw', g: { unit: 20, cup: 315 },
    source: `${SR}Syrups, maple`, n: [260, 0.04, 67.04, 0.06, 0.007, 60.46, 0, 12, 0, 0, 0, 0, 102, 0.11, 212, 21, 1.47, 0] },
  { id: 'sugar', tags: ['sugar'], name: 'Sugar, granulated', aisle: PANTRY, aliases: ['sugar', 'white sugar', 'granulated sugar', 'caster sugar', 'cane sugar'], excludes: ['brown sugar', 'powdered sugar', 'icing sugar', 'coconut sugar', 'sugar snap'], state: 'dry', g: { unit: 4, cup: 200 },
    source: `${SR}Sugars, granulated`, n: [387, 0, 99.98, 0, 0, 99.8, 0, 1, 0, 0, 0, 0, 1, 0.05, 2, 0, 0.01, 0] },
  { id: 'brown-sugar', tags: ['sugar'], name: 'Brown sugar', aisle: PANTRY, aliases: ['brown sugar', 'light brown sugar', 'dark brown sugar'], state: 'dry', g: { unit: 4, cup: 220 },
    source: `${SR}Sugars, brown`, n: [380, 0.12, 98.09, 0, 0, 97.02, 0, 28, 0, 0, 0, 0, 83, 0.71, 133, 9, 0.03, 0] },
  { id: 'dark-chocolate', tags: ['sugar'], name: 'Dark chocolate, 70–85% cacao', aisle: PANTRY, aliases: ['dark chocolate'], state: 'raw', g: { unit: 10, cup: 170 },
    source: `${SR}Chocolate, dark, 70-85% cacao solids`, n: [598, 7.79, 45.9, 42.63, 24.489, 23.99, 10.9, 20, 2, 0, 0, 0.28, 73, 11.9, 715, 228, 3.31, 0.035] },
  { id: 'vanilla-extract', name: 'Vanilla extract', aisle: SPICES, aliases: ['vanilla extract', 'vanilla', 'pure vanilla extract'], excludes: ['vanilla bean', 'vanilla yogurt'], state: 'raw', g: { unit: 4, cup: 208 }, alcohol: 34.4,
    source: `${SR}Vanilla extract`, n: [288, 0.06, 12.65, 0.06, 0.01, 12.65, 0, 9, 0, 0, 0, 0, 11, 0.12, 148, 12, 0.11, 0.003] },
  { id: 'baking-soda', name: 'Baking soda', aisle: PANTRY, aliases: ['baking soda', 'bicarbonate of soda', 'bicarb soda', 'sodium bicarbonate'], state: 'dry', g: { unit: 4.6, cup: 220 },
    source: `${SR}Leavening agents, baking soda`, n: [0, 0, 0, 0, 0, 0, 0, 27360, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'broth', name: 'Vegetable broth, ready-to-serve', aisle: PANTRY, aliases: ['broth', 'stock', 'vegetable broth', 'vegetable stock', 'veggie broth'], excludes: ['low sodium', 'reduced sodium', 'no salt added', 'unsalted', 'beef broth', 'beef stock', 'fish stock', 'bouillon cube'], state: 'canned', g: { unit: 240, cup: 240, can: 411 },
    source: 'Typical regular-sodium ready-to-serve vegetable broth (compare SR Legacy "Soup, vegetable broth, ready to serve").',
    note: 'Approximate: sodium varies about 5-fold between brands (low-sodium broths have about 60 mg per 100 g); minerals not counted.',
    n: [5, 0.2, 0.9, 0.1, 0.02, 0.4, 0, 300, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'chicken-broth', tags: ['meat'], name: 'Chicken broth, ready-to-serve', aisle: PANTRY, aliases: ['chicken broth', 'chicken stock', 'bone broth', 'chicken bone broth'], excludes: ['low sodium', 'reduced sodium', 'no salt added', 'unsalted'], state: 'canned', g: { unit: 240, cup: 240, can: 411 },
    source: 'Typical regular-sodium ready-to-serve chicken broth (compare SR Legacy "Soup, chicken broth, ready-to-serve").',
    note: 'Approximate: sodium varies widely between brands; minerals not counted.',
    n: [4, 0.4, 0.4, 0.2, 0.05, 0.2, 0, 360, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'water', name: 'Water', aisle: PANTRY, aliases: ['water', 'cold water', 'warm water', 'hot water', 'boiling water', 'ice water'], excludes: ['coconut water', 'rose water', 'sparkling water', 'tonic water'], state: 'raw', g: { unit: 237, cup: 237 },
    source: `${SR}Beverages, water, tap, drinking`, n: [0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 3, 0, 0, 1, 0.01, 0] },

  // ---------- Allergy / diet substitutes (ids referenced by the substitution engine) ----------
  { id: 'sunflower-butter', name: 'Sunflower seed butter', aisle: PANTRY, aliases: ['sunflower seed butter', 'sunflower butter', 'sunbutter'], state: 'raw', g: { unit: 32, cup: 256 },
    source: `${SR}Seeds, sunflower seed butter, with salt added`, note: 'Sodium varies by brand (unsalted versions are near 3 mg per 100 g).',
    n: [617, 17.28, 23.32, 55.2, 4.75, 5.7, 5.7, 300, 3, 0.2, 0, 0, 64, 4.1, 576, 311, 5.3, 0.07] },
  { id: 'hemp-seeds', name: 'Hemp seeds, hulled', aisle: PANTRY, aliases: ['hemp seed', 'hemp heart', 'hulled hemp seed'], state: 'dry', g: { unit: 10, cup: 160 },
    source: `${SR}Seeds, hemp seed, hulled`, n: [553, 31.56, 8.67, 48.75, 4.6, 1.5, 4, 5, 1, 0.5, 0, 0, 70, 7.95, 1200, 700, 9.9, 8.7] },
  { id: 'nutritional-yeast', name: 'Nutritional yeast, fortified', aisle: PANTRY, aliases: ['nutritional yeast', 'nooch'], state: 'dry', g: { unit: 5, cup: 60 },
    source: 'Not in SR Legacy. Typical fortified nutritional yeast flakes label (per 1/4 cup, 15 g: 60 kcal, 8 g protein, 5 g carbs, 3 g fiber, 0.5 g fat).',
    note: 'Label-derived estimate; B12 fortification varies widely by brand.',
    n: [400, 50, 33, 5, 0.7, 0, 20, 120, 0, 0, 0, 50, 40, 4, 2000, 160, 20, 0] },
  { id: 'gf-oats', tags: ['grains'], name: 'Certified gluten-free oats, dry', aisle: PANTRY, aliases: ['gluten free oats', 'certified gluten free oats', 'gluten free rolled oats'], state: 'dry', g: { unit: 40, cup: 81 },
    source: `${SR}Cereals, oats, regular and quick, not fortified, dry (certified gluten-free oats are nutritionally identical)`,
    n: [379, 13.15, 67.7, 6.52, 1.11, 0.99, 10.1, 6, 0, 0, 0, 0, 52, 4.25, 362, 138, 3.64, 0.11] },
  { id: 'gf-pasta', tags: ['grains'], name: 'Gluten-free brown rice pasta, dry', aisle: PANTRY, aliases: ['gluten free pasta', 'rice pasta', 'brown rice pasta', 'gluten free spaghetti'], state: 'dry', g: { unit: 56, cup: 100 },
    source: 'Not in SR Legacy. Typical brown rice pasta label (per 56 g: 200 kcal, 4 g protein, 43 g carbs, 2 g fiber, 1.5 g fat).',
    note: 'Label-derived estimate.',
    n: [357, 7.1, 76.8, 2.7, 0.5, 0, 3.6, 0, 0, 0, 0, 0, 10, 1, 200, 90, 1.5, 0] },
  { id: 'gf-bread', tags: ['grains'], name: 'Gluten-free bread', aisle: PANTRY, aliases: ['gluten free bread', 'gluten free toast'], state: 'cooked', g: { unit: 30, cup: 45 }, count: 'slices',
    source: 'Not in SR Legacy. Typical gluten-free sandwich bread label.', note: 'Label-derived estimate; recipes vary widely.',
    n: [250, 4, 45, 6, 0.7, 4, 4, 450, 0, 0, 0, 0, 80, 2, 150, 30, 0.6, 0.1] },
  { id: 'coconut-aminos', name: 'Coconut aminos', aisle: PANTRY, aliases: ['coconut aminos'], state: 'raw', g: { unit: 5, cup: 240 },
    source: 'Not in SR Legacy. Typical coconut aminos label (per 1 tsp, 5 ml: 5 kcal, 1 g sugar, 90 mg sodium).', note: 'Label-derived estimate.',
    n: [80, 0, 20, 0, 0, 20, 0, 1800, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'coconut-yogurt', name: 'Coconut yogurt, plain', aisle: DAIRY, aliases: ['coconut yogurt', 'dairy free yogurt', 'coconut milk yogurt'], state: 'raw', g: { unit: 150, cup: 245 },
    source: 'Not in SR Legacy. Typical unsweetened, calcium-fortified coconut yogurt label.', note: 'Label-derived estimate.',
    n: [120, 0.5, 6, 10.5, 9.5, 2, 0.5, 15, 0, 0, 0, 0, 120, 0.2, 40, 5, 0.1, 0] },

  // ---------- Salt, dried spices & herbs ----------
  { id: 'salt', name: 'Salt, table', aisle: SPICES, aliases: ['salt', 'sea salt', 'table salt', 'kosher salt', 'garlic salt', 'celery salt', 'onion salt'], excludes: ['unsalted', 'salt free', 'no salt'], state: 'dry', g: { unit: 6, cup: 288 },
    source: `${SR}Salt, table`, note: 'Kosher and flavored salts are matched as table salt; by volume, flaky kosher salt weighs about half as much.',
    n: [0, 0, 0, 0, 0, 0, 0, 38758, 0, 0, 0, 0, 24, 0.33, 8, 1, 0.1, 0] },
  { id: 'black-pepper', name: 'Black pepper, ground', aisle: SPICES, aliases: ['pepper', 'black pepper', 'ground pepper', 'ground black pepper', 'peppercorn', 'lemon pepper'],
    excludes: ['peppers', 'chili pepper', 'chile pepper', 'hot pepper', 'sweet pepper', 'poblano', 'serrano', 'habanero', 'anaheim', 'banana pepper', 'pepper jack', 'yellow pepper', 'orange pepper', 'bell pepper', 'red pepper', 'green pepper', 'pepperoni'],
    state: 'dry', g: { unit: 0.5, cup: 110 },
    source: `${SR}Spices, pepper, black`, n: [251, 10.39, 63.95, 3.26, 1.392, 0.64, 25.3, 20, 27, 0, 0, 0, 443, 9.71, 1329, 171, 1.19, 0.153] },
  { id: 'red-pepper-flakes', name: 'Red pepper flakes / cayenne', aisle: SPICES, aliases: ['red pepper flakes', 'crushed red pepper', 'chili flakes', 'chilli flakes', 'red chili flakes', 'chili pepper flakes', 'cayenne', 'cayenne pepper', 'ground red pepper', 'crushed red pepper flakes'],
    state: 'dry', g: { unit: 0.5, cup: 86 },
    source: `${SR}Spices, pepper, red or cayenne`, n: [318, 12.01, 56.63, 17.27, 3.26, 10.34, 27.2, 30, 2081, 76.4, 0, 0, 148, 7.8, 2014, 152, 2.48, 0.654] },
  { id: 'paprika', name: 'Paprika', aisle: SPICES, aliases: ['paprika', 'smoked paprika', 'sweet paprika'], state: 'dry', g: { unit: 2.3, cup: 110 },
    source: `${SR}Spices, paprika`, n: [282, 14.14, 53.99, 12.89, 2.14, 10.34, 34.9, 68, 2463, 0.9, 0, 0, 229, 21.14, 2280, 178, 4.33, 0] },
  { id: 'cumin', name: 'Cumin', aisle: SPICES, aliases: ['cumin', 'ground cumin', 'cumin seed'], state: 'dry', g: { unit: 2, cup: 96 },
    source: `${SR}Spices, cumin seed`, n: [375, 17.81, 44.24, 22.27, 1.535, 2.25, 10.5, 168, 64, 7.7, 0, 0, 931, 66.36, 1788, 366, 4.8, 0.176] },
  { id: 'cinnamon', name: 'Cinnamon, ground', aisle: SPICES, aliases: ['cinnamon', 'ground cinnamon', 'cinnamon stick'], state: 'dry', g: { unit: 2.6, cup: 125 },
    source: `${SR}Spices, cinnamon, ground`, n: [247, 3.99, 80.59, 1.24, 0.345, 2.17, 53.1, 10, 15, 3.8, 0, 0, 1002, 8.32, 431, 60, 1.83, 0.011] },
  { id: 'turmeric', name: 'Turmeric, ground', aisle: SPICES, aliases: ['turmeric', 'ground turmeric'], state: 'dry', g: { unit: 3, cup: 144 },
    source: `${SR}Spices, turmeric, ground`, n: [312, 9.68, 67.14, 3.25, 1.838, 3.21, 22.7, 27, 0, 0.7, 0, 0, 168, 55, 2080, 208, 4.5, 0] },
  { id: 'garlic-powder', name: 'Garlic powder', aisle: SPICES, aliases: ['garlic powder', 'granulated garlic'], state: 'dry', g: { unit: 3.1, cup: 149 },
    source: `${SR}Spices, garlic powder`, n: [331, 16.55, 72.73, 0.73, 0.249, 2.43, 9, 60, 0, 1.2, 0, 0, 79, 5.65, 1193, 77, 2.99, 0.01] },
  { id: 'oregano', name: 'Oregano, dried', aisle: SPICES, aliases: ['oregano', 'dried oregano'], state: 'dry', g: { unit: 1, cup: 48 },
    source: `${SR}Spices, oregano, dried`, n: [265, 9, 68.92, 4.28, 1.551, 4.09, 42.5, 25, 85, 2.3, 0, 0, 1597, 36.8, 1260, 270, 2.69, 0] },
];
/* eslint-enable max-len */

/** Turns a schema row into the runtime food object used by the parser, grocery list and UI. */
export const buildFood = (row) => {
  const g = row.g ?? {};
  return {
    id: row.id,
    name: row.name,
    aisle: row.aisle,
    aliases: row.aliases ?? [],
    excludes: row.excludes ?? [],
    tags: [...new Set(row.tags ?? [])],
    state: row.state,
    group: row.group ?? null,
    portions: { unit: g.unit ?? 100, cup: g.cup ?? 240, can: g.can ?? 400 },
    // Flat aliases kept for the grocery aggregator.
    gPerUnit: g.unit ?? 100,
    gPerCup: g.cup ?? 240,
    gPerCan: g.can ?? 400,
    count: row.count,
    source: row.source,
    note: row.note ?? '',
    alcohol: row.alcohol ?? 0,
    nutrients: Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, row.n[VALUE_KEYS.indexOf(key)] ?? 0])),
  };
};

export const FOOD_DB = Object.fromEntries(FOOD_ROWS.map((row) => [row.id, buildFood(row)]));
export const FOOD_LIST = Object.values(FOOD_DB);
export const FOOD_COUNT = FOOD_LIST.length;

/** State variants per group: { 'brown-rice': { dry: food, cooked: food } }. */
export const FOOD_GROUPS = FOOD_LIST.reduce((groups, food) => {
  if (food.group) (groups[food.group] ??= {})[food.state] = food;
  return groups;
}, {});

/** Lower-case, strip accents ("jalapeño" → "jalapeno") and punctuation, collapse spaces. */
export const normalizeText = (text) => String(text)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Words that turn the food before them into a different product: "butter beans", "rice vinegar",
 * "almond flour". An alias directly followed by one of these is not a match.
 */
export const PRODUCT_WORDS = new Set([
  'oil', 'oils', 'milk', 'butter', 'flour', 'meal', 'extract', 'sauce', 'paste', 'syrup', 'juice', 'powder', 'cream',
  'broth', 'stock', 'vinegar', 'flakes', 'bean', 'beans', 'noodle', 'noodles', 'starch', 'soup', 'cider', 'sausage',
  'sausages', 'chips', 'crackers', 'cake', 'cakes', 'bread', 'jam', 'jelly', 'pie', 'water', 'salt', 'seasoning',
  'dressing', 'yogurt', 'pepper', 'peppers', 'cheese', 'leaves', 'greens', 'seed', 'seeds', 'zest', 'wine', 'sugar',
  'puree', 'spread', 'bar', 'bars', 'cereal', 'pudding', 'paper', 'tea',
]);

/** Matching index: one entry per alias, longest first. */
export const ALIAS_INDEX = FOOD_LIST
  .flatMap((food) => food.aliases.map((alias) => {
    const normalized = normalizeText(alias);
    return {
      id: food.id,
      alias: normalized,
      length: normalized.length,
      // Whole-phrase match with optional plural; letters on either side mean a different word.
      pattern: new RegExp(`(?<![a-z])${escapeRegExp(normalized)}(?:e?s)?(?![a-z])`, 'g'),
    };
  }))
  .sort((a, b) => b.length - a.length || a.alias.localeCompare(b.alias));

/** Normalized exclude phrases per food id. */
export const EXCLUDES = Object.fromEntries(FOOD_LIST.map((food) => [food.id, food.excludes.map(normalizeText)]));

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
    'slice', 'slices', 'fillet', 'fillets', 'bunch', 'bunches', 'head', 'heads', 'stalk', 'stalks', 'scoop', 'scoops',
    'stick', 'sticks', 'block', 'blocks'],
};
export const UNIT_LOOKUP = Object.fromEntries(
  Object.entries(UNIT_ALIASES).flatMap(([unit, aliases]) => aliases.map((alias) => [alias, unit])),
);
export const WEIGHT_GRAMS = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };
export const UNICODE_FRACTIONS = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8' };
export const LIST_MARKER = /^\s*(?:[-*•–]|\d+[.)](?=\s))\s*/;

/** Fields of the per-user custom food form (values per 100 g). */
export const CUSTOM_FOOD_FIELDS = [
  { key: 'calories', label: 'Calories', unit: 'kcal', max: 900 },
  { key: 'protein', label: 'Protein', unit: 'g', max: 100 },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g', max: 100 },
  { key: 'fat', label: 'Fat', unit: 'g', max: 100 },
  { key: 'saturatedFat', label: 'Saturated fat', unit: 'g', max: 100 },
  { key: 'sugar', label: 'Sugar', unit: 'g', max: 100 },
  { key: 'fiber', label: 'Fiber', unit: 'g', max: 100 },
  { key: 'sodium', label: 'Sodium', unit: 'mg', max: 40000 },
];

/**
 * Builds a runtime food from a stored custom food
 * ({ id, name, nutrients: { calories, … }, gPerUnit?, gPerCup? }).
 * Nutrients the user did not enter count as 0.
 */
export const buildCustomFood = (stored) => ({
  ...buildFood({
    id: stored.id,
    name: stored.name,
    aisle: PANTRY,
    aliases: [],
    state: 'raw',
    g: { unit: Number(stored.gPerUnit) || 100, cup: Number(stored.gPerCup) || 240 },
    source: 'Custom food entered by you',
    n: VALUE_KEYS.map((key) => Math.max(0, Number(stored.nutrients?.[key]) || 0)),
  }),
  custom: true,
});
