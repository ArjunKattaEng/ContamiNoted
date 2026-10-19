// Food category taxonomy for recall notification preferences.
// The `id` values must exactly match the strings produced by api/services/categories.py.
export const FOOD_CATEGORIES = [
  { id: 'Pet Food',        description: 'Dog, cat, and other pet food' },
  { id: 'Baby & Infant',   description: 'Formula, baby food, infant products' },
  { id: 'Dairy',           description: 'Milk, cheese, yogurt, butter, ice cream' },
  { id: 'Meat & Poultry',  description: 'Beef, chicken, turkey, pork, deli meats' },
  { id: 'Seafood',         description: 'Fish, shrimp, salmon, shellfish' },
  { id: 'Produce',         description: 'Fruits, vegetables, salads, herbs' },
  { id: 'Bakery & Snacks', description: 'Bread, crackers, chips, cookies, granola' },
  { id: 'Nuts & Seeds',    description: 'Peanuts, almonds, walnuts, nut butters' },
  { id: 'Ready-to-Eat',    description: 'Meal kits, dips, sandwiches, soups' },
  { id: 'Beverages',       description: 'Juice, tea, water, smoothies' },
] as const

export type FoodCategoryId = (typeof FOOD_CATEGORIES)[number]['id']
export const FOOD_CATEGORY_IDS: string[] = FOOD_CATEGORIES.map((c) => c.id)
