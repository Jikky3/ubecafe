import { DAYS, MEAL_SLOTS } from './constants.js';

/** Starter content shown to new users. */
export const SEED_RECIPES = [
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

export const SEED_PLAN = (() => {
  const rotation = [
    ['seed-oats', 'seed-bowl', 'seed-yogurt', 'seed-salmon'],
    ['seed-scramble', 'seed-soup', 'seed-apple', 'seed-chicken'],
  ];
  return Object.fromEntries(DAYS.map((day, i) => {
    const row = rotation[i % 2];
    return [day, Object.fromEntries(MEAL_SLOTS.map((slot, j) => [slot.id, row[j]]))];
  }));
})();

export const DEFAULT_PROFILE = {
  units: 'imperial', age: 32, gender: 'female', heightCm: 167.64, weightKg: 68.04,
  activity: 'moderate', goal: 'maintain', bodyFatPct: null, waistCm: null, hipCm: null, updatedAt: null,
};
export const DEFAULT_SUPPLEMENTS = { selected: ['vitaminD3', 'iron', 'magnesium'], coffeeAtBreakfast: true };
export const DEFAULT_GROCERY = { household: 1, checked: [] };
