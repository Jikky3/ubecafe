
/**
 * Every exclusion the SubstitutionEngine understands. Allergens are chosen
 * directly by the user; the remaining categories are implied by diet patterns.
 */
export const RESTRICTIONS = {
  peanuts: { label: 'Peanuts', option: 'Peanuts' },
  tree_nuts: { label: 'Tree nuts', option: 'Tree nuts' },
  dairy: { label: 'Dairy', option: 'Dairy / lactose' },
  gluten: { label: 'Gluten', option: 'Gluten' },
  soy: { label: 'Soy', option: 'Soy' },
  eggs: { label: 'Eggs', option: 'Eggs' },
  shellfish: { label: 'Shellfish', option: 'Shellfish' },
  meat: { label: 'Meat & poultry' },
  fish: { label: 'Fish' },
  honey: { label: 'Honey' },
  grains: { label: 'Grains' },
  legumes: { label: 'Legumes' },
  starch: { label: 'Starchy vegetables' },
  sugar: { label: 'Sugars & syrups' },
  high_carb_fruit: { label: 'High-carb fruit' },
};

export const ALLERGY_IDS = ['peanuts', 'tree_nuts', 'dairy', 'gluten', 'soy', 'eggs', 'shellfish'];

export const DIETS = {
  omnivore: { label: 'Omnivore', description: 'Everything on the menu.', excludes: [] },
  vegetarian: { label: 'Vegetarian', description: 'No meat, poultry or seafood.', excludes: ['meat', 'fish', 'shellfish'] },
  vegan: { label: 'Vegan', description: 'No animal products, including dairy, eggs and honey.', excludes: ['meat', 'fish', 'shellfish', 'dairy', 'eggs', 'honey'] },
  pescatarian: { label: 'Pescatarian', description: 'Seafood, but no meat or poultry.', excludes: ['meat'] },
  keto: { label: 'Keto', description: 'Very low carb: no grains, legumes, starches or sugars.', excludes: ['grains', 'legumes', 'starch', 'sugar', 'high_carb_fruit'] },
  paleo: { label: 'Paleo', description: 'No grains, legumes or dairy.', excludes: ['grains', 'legumes', 'dairy'] },
};

/**
 * Fallback keywords for ingredients the dictionary does not recognize and for custom foods
 * (which carry no tags). They cover the generic words the food table leaves unmatched on purpose
 * ("cheese", "steak", "tortilla"), so an unrecognized line still gets screened.
 */
export const RESTRICTION_KEYWORDS = {
  peanuts: ['peanut', 'groundnut'],
  tree_nuts: ['nut', 'almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'pine nut', 'brazil nut', 'praline', 'marzipan', 'nutella'],
  dairy: ['milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'ghee', 'whey', 'casein', 'parmesan', 'mozzarella', 'ricotta', 'buttermilk', 'kefir', 'custard'],
  gluten: ['wheat', 'flour', 'barley', 'rye', 'couscous', 'semolina', 'bulgur', 'farro', 'spelt', 'seitan', 'breadcrumb', 'panko', 'cracker',
    'bread', 'pasta', 'noodle', 'tortilla', 'wrap', 'pita', 'bagel'],
  soy: ['soy', 'edamame', 'tempeh', 'miso'],
  eggs: ['egg', 'mayonnaise', 'mayo', 'meringue', 'aioli'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster', 'crawfish', 'langoustine'],
  meat: ['meat', 'meatball', 'beef', 'steak', 'chicken', 'poultry', 'bacon', 'ham', 'pork', 'lamb', 'turkey', 'sausage', 'prosciutto', 'salami', 'chorizo', 'veal', 'duck', 'venison', 'pepperoni', 'gelatin'],
  fish: ['fish', 'salmon', 'tuna', 'sardine', 'cod', 'tilapia', 'halibut', 'trout', 'anchovy', 'anchovies', 'mackerel', 'haddock'],
  honey: ['honey'],
  grains: ['flour', 'wheat', 'barley', 'rye', 'couscous', 'cornmeal', 'millet', 'bulgur', 'farro', 'spelt', 'cereal', 'granola', 'cracker',
    'bread', 'pasta', 'noodle', 'tortilla', 'wrap', 'pita', 'bagel', 'rice', 'oat'],
  legumes: ['bean', 'pea', 'edamame', 'tempeh', 'miso', 'hummus'],
  starch: ['potato', 'corn', 'plantain', 'cassava', 'parsnip'],
  sugar: ['sugar', 'syrup', 'agave', 'molasses', 'chocolate', 'jam'],
  high_carb_fruit: ['mango', 'grape', 'pineapple', 'date', 'raisin', 'fig'],
};

/**
 * Phrases removed before a restriction's keywords are checked, so "coconut milk", "butter beans" or
 * "gluten-free bread" do not read as dairy or gluten. Text is normalized (lower case, no punctuation).
 */
export const KEYWORD_EXCLUDES = {
  tree_nuts: [String.raw`(?:tree )?nut free`],
  dairy: [String.raw`(?:dairy|lactose|milk) free \w+`, String.raw`(?:vegan|plant based|non dairy) \w+`,
    String.raw`(?:coconut|almond|cashew|oat|soy|rice|hemp|pea|flax|macadamia) (?:milk|yogurt|yoghurt|cheese|butter)`, 'coconut cream',
    String.raw`(?:peanut|nut|seed|sunflower|apple|cocoa|shea) butter`, 'butter beans?', 'butter lettuce', 'cream of tartar', 'ice cream maker'],
  gluten: [String.raw`(?:gluten|wheat) free \w+`, String.raw`(?:rice|corn|lentil|chickpea|bean|zucchini|glass|shirataki|kelp|coconut|almond|cassava|tapioca|potato|buckwheat) (?:noodle|pasta|tortilla|bread|flour)s?`,
    'lettuce wraps?', 'plastic wrap'],
  eggs: [String.raw`egg free \w+`, 'eggplant'],
  meat: [String.raw`(?:vegan|vegetarian|plant based|meatless|meat free) \w+`],
  grains: [String.raw`(?:grain|gluten) free \w+`, String.raw`(?:cauliflower|broccoli) rice`, String.raw`(?:zucchini|kelp|shirataki) noodles?`, String.raw`(?:coconut|almond) flour`, 'lettuce wraps?'],
};

const keywordPattern = (words) => new RegExp(`\\b(?:${words.join('|')})(?:e?s)?\\b`);
const excludePattern = (phrases) => (phrases ? new RegExp(`\\b(?:${phrases.join('|')})\\b`, 'g') : null);

/** Per restriction: { test(text) } that applies KEYWORD_EXCLUDES before the keyword check. */
export const RESTRICTION_PATTERNS = Object.fromEntries(Object.entries(RESTRICTION_KEYWORDS).map(([id, words]) => {
  const pattern = keywordPattern(words);
  const exclude = excludePattern(KEYWORD_EXCLUDES[id]);
  return [id, { test: (text) => pattern.test(exclude ? text.replace(exclude, ' ') : text) }];
}));

/**
 * Restrictions that still apply when a food is only the base of another product ("walnut oil",
 * "shrimp paste", "chicken sausage"). Diet-shape restrictions (grains, legumes, starch, sugar,
 * high-carb fruit) are left out because the product usually differs ("rice vinegar").
 */
export const MENTION_RESTRICTIONS = [...ALLERGY_IDS, 'meat', 'fish', 'honey'];

/**
 * Safe, nutritionally similar substitutes per restriction. `foodId` links to the
 * dictionary so swaps keep accurate nutrition and reach the grocery list
 * (`null` means "omit"). `replaces` limits an option to specific source foods;
 * options without it are generic fallbacks. `gramRatio` scales the original weight.
 * The engine skips any option that conflicts with another active restriction.
 */
export const SUBSTITUTES = {
  peanuts: [
    { foodId: 'sunflower-butter', ratio: '1:1', gramRatio: 1, replaces: ['peanut-butter'], note: 'Provides healthy fats and a similar creamy texture.' },
    { foodId: 'olive-oil', ratio: '1:1', gramRatio: 1, replaces: ['olive-oil'], note: 'Cook with olive oil instead of peanut oil.' },
    { foodId: 'pumpkin-seeds', ratio: '1:1', gramRatio: 1, note: 'Matches the crunch and adds magnesium and zinc.' },
  ],
  tree_nuts: [
    { foodId: 'sunflower-butter', ratio: '1:1', gramRatio: 1, replaces: ['almond-butter'], note: 'Seed butter with the same spreadable texture and healthy fats.' },
    { foodId: 'oat-milk', ratio: '1:1', gramRatio: 1, replaces: ['almond-milk'], note: 'Fortified oat milk keeps calcium and vitamin D without nuts.' },
    { foodId: 'soy-milk', ratio: '1:1', gramRatio: 1, replaces: ['almond-milk'], note: 'Fortified soy milk keeps calcium and adds protein.' },
    { foodId: 'olive-oil', ratio: '1:1', gramRatio: 1, replaces: ['olive-oil'], note: 'Use olive oil instead of a nut oil.' },
    { foodId: 'sunflower-seeds', ratio: '1:1', gramRatio: 1, note: 'Toasted seeds replace walnuts or pine nuts in pestos and salads.' },
    { foodId: 'hemp-seeds', ratio: '1:1', gramRatio: 1, note: 'Rich in healthy fats, omega-3 and complete protein.' },
  ],
  dairy: [
    { foodId: 'nutritional-yeast', ratio: '1 tbsp per 1/4 cup cheese', gramRatio: 0.18, replaces: ['cheddar', 'feta', 'mozzarella', 'parmesan'], note: 'Replaces cheesy, umami flavor in savory dishes and adds B12.' },
    { foodId: 'olive-oil', ratio: '3/4 the amount', gramRatio: 0.75, replaces: ['butter', 'butter-unsalted'], note: 'Heart-healthy fat for cooking and roasting.' },
    { foodId: 'coconut-yogurt', ratio: '1:1', gramRatio: 1, replaces: ['greek-yogurt', 'yogurt', 'cottage-cheese', 'ricotta', 'cream-cheese'], note: 'Creamy, calcium-fortified yogurt; much lower in protein, so pair with seeds.' },
    { foodId: 'coconut-milk', ratio: '1:1', gramRatio: 1, replaces: ['heavy-cream'], note: 'Canned coconut milk is just as rich in sauces, soups and curries.' },
    { foodId: 'soy-milk', ratio: '1:1', gramRatio: 1, note: 'Fortified soy milk is the closest match to dairy milk for protein and calcium.' },
    { foodId: 'oat-milk', ratio: '1:1', gramRatio: 1, note: 'Fortified oat milk replaces milk while maintaining calcium and vitamin D.' },
    { foodId: 'almond-milk', ratio: '1:1', gramRatio: 1, note: 'Fortified almond milk keeps calcium with very few calories.' },
  ],
  gluten: [
    { foodId: 'gf-oats', ratio: '1:1', gramRatio: 1, replaces: ['oats'], note: 'Certified gluten-free oats avoid wheat cross-contact with identical nutrition.' },
    { foodId: 'gf-oats', ratio: '1/2 cup dry per 1 1/4 cups cooked', gramRatio: 0.19, replaces: ['oats-cooked'], note: 'Cook certified gluten-free oats the same way; the weight is converted from cooked to dry.' },
    { foodId: 'gf-bread', ratio: '1:1', gramRatio: 1, replaces: ['bread'], note: 'Gluten-free loaf for toast and sandwiches.' },
    { foodId: 'gf-pasta', ratio: '1:1', gramRatio: 1, replaces: ['pasta'], note: 'Brown rice pasta keeps complex carbohydrates high.' },
    { foodId: 'gf-pasta', ratio: '1 oz dry per 1/2 cup cooked', gramRatio: 0.44, replaces: ['pasta-cooked'], note: 'Gluten-free pasta; the weight is converted from cooked to dry.' },
    { foodId: 'quinoa-cooked', ratio: '1:1', gramRatio: 1, replaces: ['couscous-cooked', 'barley-cooked'], note: 'Cooked quinoa has a similar texture and keeps complex carbs.' },
    { foodId: 'coconut-aminos', ratio: '1:1', gramRatio: 1, replaces: ['soy-sauce'], note: 'Wheat- and soy-free seasoning with a similar savory taste.' },
    { foodId: 'quinoa', ratio: '1:1', gramRatio: 1, note: 'Naturally gluten-free grain that keeps complex carbs and adds protein.' },
    { foodId: 'cauliflower', ratio: '1:1', gramRatio: 1, note: 'Riced cauliflower stands in for grains in bowls and stir-fries.' },
  ],
  soy: [
    { foodId: 'coconut-aminos', ratio: '1:1', gramRatio: 1, replaces: ['soy-sauce'], note: 'Soy-free seasoning with a similar savory taste.' },
    { foodId: 'oat-milk', ratio: '1:1', gramRatio: 1, replaces: ['soy-milk'], note: 'Fortified oat milk keeps calcium and vitamin D.' },
    { foodId: 'almond-milk', ratio: '1:1', gramRatio: 1, replaces: ['soy-milk'], note: 'Fortified almond milk keeps calcium and vitamin D.' },
    { foodId: 'chicken', ratio: '1:1', gramRatio: 1, replaces: ['tofu'], note: 'Lean protein that cooks like pressed tofu.' },
    { foodId: 'chickpeas', ratio: '1:1', gramRatio: 1, note: 'Plant protein that holds its shape in bowls and curries.' },
    { foodId: 'hemp-seeds', ratio: '1/3 the amount', gramRatio: 0.33, note: 'Complete plant protein without soy.' },
  ],
  eggs: [
    { foodId: 'tofu', ratio: '1:1 by weight', gramRatio: 1, replaces: ['eggs', 'egg-white'], note: 'Crumbled firm tofu makes a protein-rich, egg-free scramble.' },
    { foodId: 'chia', ratio: '1 tbsp chia + 3 tbsp water per egg', gramRatio: 0.24, note: 'A “chia egg” binds baked goods and adds omega-3.' },
  ],
  shellfish: [
    { foodId: 'chicken', ratio: '1:1', gramRatio: 1, note: 'Lean, mild protein that cooks just as quickly.' },
    { foodId: 'tofu', ratio: '1:1', gramRatio: 1, note: 'Firm tofu absorbs the same marinades and seasonings.' },
    { foodId: 'chickpeas', ratio: '1:1', gramRatio: 1, note: 'Shellfish-free protein for bowls and pastas.' },
  ],
  meat: [
    { foodId: 'broth', ratio: '1:1', gramRatio: 1, replaces: ['chicken-broth'], note: 'Vegetable broth gives soups and grains the same savory base.' },
    { foodId: 'tofu', ratio: '1:1 by weight', gramRatio: 1, note: 'Complete plant protein with calcium and iron.' },
    { foodId: 'chickpeas', ratio: '1:1 by weight', gramRatio: 1, note: 'Fiber-rich plant protein that roasts well.' },
    { foodId: 'mushroom', ratio: '1:1 by weight', gramRatio: 1, note: 'Meaty texture and umami with very few calories; add seeds for protein.' },
  ],
  fish: [
    { foodId: 'tofu', ratio: '1:1 by weight', gramRatio: 1, note: 'Plant protein; add chia or walnuts to replace omega-3.' },
    { foodId: 'chickpeas', ratio: '1:1 by weight', gramRatio: 1, note: 'Plant protein; add chia or hemp seeds to replace omega-3.' },
    { foodId: 'mushroom', ratio: '1:1 by weight', gramRatio: 1, note: 'Savory, low-calorie stand-in; add hemp seeds for omega-3.' },
  ],
  honey: [
    { foodId: 'maple-syrup', ratio: '1:1', gramRatio: 1, replaces: ['honey'], note: 'Plant-based sweetener with a similar pour.' },
    { foodId: null, ratio: 'omit', gramRatio: 0, note: 'Leave it out or sweeten with ripe fruit.' },
  ],
  sugar: [
    { foodId: null, ratio: 'omit', gramRatio: 0, note: 'Leave it out or use a zero-calorie sweetener to taste.' },
  ],
  grains: [
    { foodId: 'chia', ratio: '1/2 the amount', gramRatio: 0.5, replaces: ['oats', 'gf-oats'], note: 'Chia pudding replaces oats with fiber and omega-3.' },
    { foodId: 'chia', ratio: '1/2 the dry oat amount', gramRatio: 0.09, replaces: ['oats-cooked'], note: 'Chia pudding replaces oatmeal; the weight is converted from cooked oats.' },
    { foodId: 'almond-milk', ratio: '1:1', gramRatio: 1, replaces: ['oat-milk'], note: 'Grain-free fortified milk.' },
    { foodId: 'zucchini', ratio: '1:1', gramRatio: 1, replaces: ['pasta', 'pasta-cooked', 'gf-pasta'], note: 'Spiralized zucchini noodles replace pasta.' },
    { foodId: 'romaine', ratio: '2 leaves per slice', gramRatio: 0.6, replaces: ['bread', 'gf-bread'], note: 'Crisp lettuce wraps replace bread.' },
    { foodId: 'cauliflower', ratio: '1:1', gramRatio: 1, replaces: ['white-rice-cooked', 'brown-rice-cooked', 'quinoa-cooked', 'couscous-cooked', 'barley-cooked'], note: 'Riced cauliflower replaces cooked rice and grains.' },
    { foodId: 'cauliflower', ratio: '1:1 (cooked volume)', gramRatio: 2.5, note: 'Riced cauliflower replaces rice and grains.' },
  ],
  legumes: [
    { foodId: 'sunflower-butter', ratio: '1:1', gramRatio: 1, replaces: ['peanut-butter'], note: 'Legume-free seed butter with similar fats.' },
    { foodId: 'coconut-aminos', ratio: '1:1', gramRatio: 1, replaces: ['soy-sauce'], note: 'Legume-free savory seasoning.' },
    { foodId: 'almond-milk', ratio: '1:1', gramRatio: 1, replaces: ['soy-milk'], note: 'Legume-free fortified milk.' },
    { foodId: 'chicken', ratio: '1:1', gramRatio: 1, replaces: ['tofu'], note: 'Lean protein in place of tofu.' },
    { foodId: 'mushroom', ratio: '1:1 by weight', gramRatio: 1, note: 'Hearty, low-carb stand-in for beans and lentils.' },
    { foodId: 'cauliflower', ratio: '1:1 by weight', gramRatio: 1, note: 'Low-carb bulk for soups and bowls.' },
  ],
  starch: [
    { foodId: 'cauliflower', ratio: '1:1', gramRatio: 1, note: 'Roasted or mashed cauliflower replaces starchy vegetables.' },
  ],
  high_carb_fruit: [
    { foodId: 'strawberries', ratio: '1:1', gramRatio: 1, note: 'Lower-sugar berries keep the sweetness and vitamin C.' },
    { foodId: null, ratio: 'omit', gramRatio: 0, note: 'Leave it out.' },
  ],
};
