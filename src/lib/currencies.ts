// Same 12 currencies as the website (src/types/invoice.ts there).
export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'CHF', symbol: 'CHF', label: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan' },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand' },
  { code: 'RWF', symbol: 'FRw', label: 'Rwandan Franc' },
  { code: 'KES', symbol: 'KSh', label: 'Kenyan Shilling' },
] as const;

// Shown first as quick picks.
export const COMMON_CURRENCIES = ['RWF', 'USD', 'EUR', 'GBP', 'KES'];
