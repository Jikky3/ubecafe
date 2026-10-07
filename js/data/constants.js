/** Days, meal slots and supplements. */
export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const DAY_LABELS = Object.fromEntries(DAYS.map((d) => [d, d[0].toUpperCase() + d.slice(1)]));

export const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast', time: '07:30', display: '7:30 AM' },
  { id: 'lunch', label: 'Lunch', time: '12:30', display: '12:30 PM' },
  { id: 'snack', label: 'Afternoon Snack', time: '16:00', display: '4:00 PM' },
  { id: 'dinner', label: 'Dinner', time: '19:00', display: '7:00 PM' },
];
export const SLOT_BY_ID = Object.fromEntries(MEAL_SLOTS.map((s) => [s.id, s]));

export const SUPPLEMENTS = [
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
export const SUPPLEMENT_BY_ID = Object.fromEntries(SUPPLEMENTS.map((s) => [s.id, s]));
