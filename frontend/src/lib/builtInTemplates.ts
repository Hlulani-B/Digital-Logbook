import type { Template } from '@/lib/templateApi';

/*
  builtInTemplates
  ----------------
  Ready-made built-in templates that ship with the frontend.

  The template service is still the source of truth for the built-in scope, but
  the app talks to the deployed service, so anything added here shows up in the
  picker straight away instead of waiting on a redeploy.

  Field types stay inside the set the app still offers (SELECTABLE_FIELD_TYPES):
  text / number / currency / date / boolean / markdown, plus 'custom' dropdowns,
  which carry their choices inline as options — the same shape the service
  templates use, and the shape the New Project form knows how to save.
*/

interface BuiltInFieldOptions {
  is_required?: boolean;
  rules?: Record<string, unknown>;
  choices?: string[];
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function field(
  field_name: string,
  data_type: string,
  display_order: number,
  { is_required = false, rules = {}, choices = [] }: BuiltInFieldOptions = {}
) {
  return {
    field_name,
    data_type,
    is_required,
    is_unique: false,
    rules,
    has_default: false,
    options: choices.map((label) => ({ id: slug(label), label, value: slug(label) })),
    display_order,
  };
}

export const localBuiltInTemplates: Template[] = [
  {
    id: 'tpl-meal-plan',
    name: 'Meal Plan',
    description: 'Track what you eat: food, calories, condiments and the date of each meal.',
    scope: 'built_in',
    version: 1,
    is_fork: false,
    fields: [
      field('Meal', 'text', 0, { is_required: true }),
      field('Food', 'text', 1, { is_required: true }),
      field('Calories', 'number', 2, { rules: { min: 0 } }),
      field('Condiments', 'custom', 3, {
        choices: [
          'No condiments',
          'Ketchup',
          'Mustard',
          'Mayonnaise',
          'Hot sauce',
          'Soy sauce',
          'Salt',
          'Black pepper',
          'Paprika',
          'Oregano',
          'Chilli flakes',
        ],
      }),
      field('Meal Type', 'custom', 4, { choices: ['Breakfast', 'Lunch', 'Dinner', 'Snack'] }),
      field('Eating Date', 'date', 5, { is_required: true }),
      field('Notes', 'markdown', 6),
    ],
  },
  {
    id: 'tpl-gym-workout',
    name: 'Gym Workout',
    description: 'Log exercises with the day, sets, reps and the weight you moved.',
    scope: 'built_in',
    version: 1,
    is_fork: false,
    fields: [
      field('Exercise', 'text', 0, { is_required: true }),
      field('Day', 'custom', 1, {
        choices: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      }),
      field('Muscle Group', 'custom', 2, {
        choices: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'],
      }),
      field('Sets', 'number', 3, { rules: { min: 0 } }),
      field('Reps', 'number', 4, { rules: { min: 0 } }),
      field('Weight (kg)', 'number', 5, { rules: { min: 0 } }),
      field('Completed', 'boolean', 6),
    ],
  },
  {
    id: 'tpl-laundry-day',
    name: 'Laundry Day',
    description: 'Sort the washing: item, fabric, wash temperature and where it ended up.',
    scope: 'built_in',
    version: 1,
    is_fork: false,
    fields: [
      field('Item', 'text', 0, { is_required: true }),
      field('Status', 'custom', 1, {
        is_required: true,
        choices: ['Washed', 'To rewash', 'To iron', 'Ironed', 'Folded', 'In the closet'],
      }),
      field('Fabric', 'custom', 2, {
        choices: ['Cotton', 'Wool', 'Delicates', 'Denim', 'Synthetics', 'Linen'],
      }),
      field('Wash Temperature', 'custom', 3, { choices: ['Cold', 'Warm', 'Hot'] }),
      field('Wash Date', 'date', 4),
      field('Notes', 'markdown', 5),
    ],
  },
  {
    id: 'tpl-grocery-run',
    name: 'Grocery Run',
    description: 'Shopping list with quantity, price, aisle and whether it is already in the cart.',
    scope: 'built_in',
    version: 1,
    is_fork: false,
    fields: [
      field('Item', 'text', 0, { is_required: true }),
      field('Quantity', 'number', 1, { rules: { min: 0 } }),
      field('Price', 'currency', 2),
      field('Aisle', 'custom', 3, {
        choices: [
          'Produce',
          'Bakery',
          'Dairy',
          'Meat & fish',
          'Frozen',
          'Pantry',
          'Household',
          'Other',
        ],
      }),
      field('Purchased', 'boolean', 4),
      field('Shopping Date', 'date', 5),
    ],
  },
  {
    id: 'tpl-study-plan',
    name: 'Study Plan',
    description: 'Plan study sessions by date with minutes spent and how confident you feel.',
    scope: 'built_in',
    version: 1,
    is_fork: false,
    fields: [
      field('Topic', 'text', 0, { is_required: true }),
      field('Subject', 'custom', 1, {
        choices: ['Mathematics', 'Science', 'Languages', 'History', 'Programming', 'Other'],
      }),
      field('Study Date', 'date', 2, { is_required: true }),
      field('Minutes', 'number', 3, { rules: { min: 0 } }),
      field('Confidence', 'custom', 4, {
        choices: ['Not started', 'Shaky', 'Getting there', 'Confident', 'Mastered'],
      }),
      field('Notes', 'markdown', 5),
    ],
  },
];
