export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID';

export type Invoice = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  date: string;
  dueDate: string | null;
  currency: string;
  taxRate: number | null;
  notes: string | null;
  terms: string | null;
  template?: string | null;
  customer: { name: string; address: string | null; email?: string | null } | null;
  lineItems: { id: string; description: string; quantity: number; rate: number }[];
};

export type Business = {
  name: string;
  logoUrl: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  defaultCurrency?: string | null;
};

export function invoiceSubtotal(inv: Invoice) {
  return inv.lineItems.reduce((s, i) => s + i.quantity * i.rate, 0);
}

export function invoiceTotal(inv: Invoice) {
  return invoiceSubtotal(inv) * (1 + (inv.taxRate || 0) / 100);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export const STATUS = {
  PAID: { bg: '#ecfccb', fg: '#3f6212', label: 'Paid' },
  SENT: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Sent' },
  DRAFT: { bg: '#f1f5f9', fg: '#64748b', label: 'Draft' },
} as const;

// Small in-memory store so the invoice screen opens instantly from the list.
const cache = new Map<string, Invoice>();
let businessCache: Business | null = null;

export const invoiceStore = {
  put(list: Invoice[]) {
    list.forEach((i) => cache.set(i.id, i));
  },
  get: (id: string) => cache.get(id),
  setBusiness(b: Business | null) {
    businessCache = b;
  },
  business: () => businessCache,
};
