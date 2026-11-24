import { CURRENCIES } from './currencies';

// Same rules as the website's formatMoney: RWF and JPY have no cents.
const ZERO_DECIMAL = new Set(['JPY', 'RWF']);

export function currencySymbol(code?: string | null) {
  const c = (code || 'USD').toUpperCase();
  return CURRENCIES.find((x) => x.code === c)?.symbol || c;
}

/** 475000 in RWF -> "FRw 475,000"; 1234.5 in USD -> "$1,234.50". */
export function money(amount: number, code?: string | null) {
  const c = (code || 'USD').toUpperCase();
  const digits = ZERO_DECIMAL.has(c) ? 0 : 2;
  const value = Number.isFinite(amount) && Math.abs(amount) >= 0.005 ? amount : 0;
  const fixed = value.toFixed(digits);
  const [whole, cents] = fixed.split('.');
  const n = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (cents ? `.${cents}` : '');
  const sym = currencySymbol(c);
  return sym.length === 1 ? `${sym}${n}` : `${sym} ${n}`;
}
