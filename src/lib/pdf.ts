import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as LegacyFS from 'expo-file-system/legacy';
import { File, Paths } from 'expo-file-system';

import { money } from './money';
import { formatDate, invoiceSubtotal, invoiceTotal, type Business, type Invoice } from './invoices';

// The same three designs as the website's PDF templates.
export type TemplateId = 'minimal' | 'modern' | 'classic';
export const TEMPLATES: { id: TemplateId; name: string; blurb: string }[] = [
  { id: 'minimal', name: 'Minimal', blurb: 'White and clean' },
  { id: 'modern', name: 'Modern', blurb: 'Navy header band' },
  { id: 'classic', name: 'Classic', blurb: 'Serif letterhead' },
];
export const asTemplate = (t?: string | null): TemplateId =>
  t === 'modern' || t === 'classic' ? t : 'minimal';

const esc = (s?: string | null) =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');

type Parts = {
  logo: string | null;
  bizName: string;
  bizLines: string;
  client: string;
  clientLines: string;
  issued: string;
  due: string;
  rows: string;
  sub: string;
  tax: string | null;
  total: string;
  notes: string;
  number: string;
};

function parts(inv: Invoice, biz: Business | null): Parts {
  const c = inv.currency;
  const sub = invoiceSubtotal(inv);
  const taxAmt = sub * ((inv.taxRate || 0) / 100);
  const logo = biz?.logoUrl && biz.logoUrl.startsWith('data:image/') ? biz.logoUrl : null;
  const bizLines = [biz?.address, biz?.email, biz?.phone].filter(Boolean).map(esc).join('<br>');
  const rows = inv.lineItems
    .map(
      (i) => `<tr>
        <td>${esc(i.description)}</td>
        <td class="r">${i.quantity}</td>
        <td class="r">${money(i.rate, c)}</td>
        <td class="r b">${money(i.quantity * i.rate, c)}</td>
      </tr>`
    )
    .join('');
  const notes =
    (inv.notes ? `<div class="block"><div class="label">Notes</div><div class="muted">${esc(inv.notes)}</div></div>` : '') +
    (inv.terms ? `<div class="block"><div class="label">Terms</div><div class="muted">${esc(inv.terms)}</div></div>` : '');
  return {
    logo,
    bizName: esc(biz?.name || 'Your business'),
    bizLines,
    client: esc(inv.customer?.name || 'Client'),
    clientLines: esc(inv.customer?.address),
    issued: formatDate(inv.date),
    due: inv.dueDate ? formatDate(inv.dueDate) : '',
    rows,
    sub: money(sub, c),
    tax: inv.taxRate ? `Tax (${inv.taxRate}%)|${money(taxAmt, c)}` : null,
    total: money(invoiceTotal(inv), c),
    notes,
    number: esc(inv.invoiceNumber),
  };
}

const BASE = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #0f172a; font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .r { text-align: right; } .b { font-weight: 700; }
  .label { font-size: 9px; letter-spacing: 1.6px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; font-weight: 700; }
  .strong { font-weight: 700; font-size: 13px; }
  .muted { color: #475569; line-height: 1.55; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items td { padding: 11px 0; vertical-align: top; }
  .block { margin-top: 30px; }
  .totals { margin-left: auto; width: 270px; margin-top: 18px; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; color: #475569; }
`;

const page = (css: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}${css}</style></head><body>${body}</body></html>`;

const taxRow = (p: Parts) => {
  if (!p.tax) return '';
  const [l, v] = p.tax.split('|');
  return `<div class="row"><span>${l}</span><span>${v}</span></div>`;
};

function minimal(p: Parts) {
  return page(
    `body { font-family: Helvetica, Arial, sans-serif; }
     .page { padding: 48px 52px; }
     .top { display: flex; justify-content: space-between; align-items: flex-start; }
     .bizname { font-size: 20px; font-weight: 800; }
     h1 { margin: 0; font-size: 28px; letter-spacing: 5px; font-weight: 800; text-align: right; }
     .num { color: #64748b; text-align: right; margin-top: 4px; }
     .grid { display: flex; gap: 24px; margin-top: 40px; }
     table.items { margin-top: 34px; }
     table.items th { text-align: left; font-size: 9px; letter-spacing: 1.6px; text-transform: uppercase; color: #64748b; border-bottom: 1.5px solid #0f172a; padding: 8px 0; }
     table.items th.r { text-align: right; }
     table.items td { border-bottom: 1px solid #e2e8f0; }
     .due { margin-top: 10px; padding: 14px 16px; background: #eff6ff; border-radius: 8px; display: flex; justify-content: space-between; align-items: baseline; }
     .due span { font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; color: #2563eb; font-weight: 700; }
     .due strong { font-size: 20px; color: #2563eb; }`,
    `<div class="page">
      <div class="top">
        <div>${p.logo ? `<img src="${p.logo}" style="max-height:64px;max-width:200px">` : `<div class="bizname">${p.bizName}</div>`}</div>
        <div><h1>INVOICE</h1><div class="num">${p.number}</div></div>
      </div>
      <div class="grid">
        <div style="flex:1"><div class="label">From</div><div class="strong">${p.bizName}</div><div class="muted">${p.bizLines}</div></div>
        <div style="flex:1"><div class="label">Bill to</div><div class="strong">${p.client}</div><div class="muted">${p.clientLines}</div></div>
        <div><div class="label">Issued</div><div>${p.issued}</div>${p.due ? `<div class="label" style="margin-top:10px">Due</div><div>${p.due}</div>` : ''}</div>
      </div>
      <table class="items"><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${p.rows}</tbody></table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${p.sub}</span></div>${taxRow(p)}
        <div class="due"><span>Amount due</span><strong>${p.total}</strong></div>
      </div>
      ${p.notes}
    </div>`
  );
}

function modern(p: Parts) {
  return page(
    `body { font-family: Helvetica, Arial, sans-serif; }
     .band { background: #0b1730; color: #fff; padding: 40px 52px 32px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 5px solid #2563eb; }
     .logocard { background: #fff; border-radius: 8px; padding: 8px 10px; display: inline-block; }
     .bizname { font-size: 22px; font-weight: 800; }
     .bizsub { color: #94a3b8; margin-top: 6px; font-size: 11px; line-height: 1.5; }
     h1 { margin: 0; font-size: 34px; font-weight: 800; text-align: right; }
     .num { color: #93c5fd; text-align: right; margin-top: 4px; font-weight: 700; }
     .page { padding: 34px 52px 48px; }
     .grid { display: flex; gap: 20px; }
     .card { flex: 1; background: #f8fafc; border-radius: 10px; padding: 14px 16px; }
     table.items { margin-top: 28px; }
     table.items th { background: #0b1730; color: #fff; text-align: left; font-size: 9px; letter-spacing: 1.4px; text-transform: uppercase; padding: 10px 12px; }
     table.items th.r { text-align: right; }
     table.items td { padding: 11px 12px; border-bottom: 1px solid #e2e8f0; }
     .due { margin-top: 10px; padding: 16px 18px; background: #0b1730; border-radius: 10px; display: flex; justify-content: space-between; align-items: baseline; color: #fff; }
     .due span { font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; color: #93c5fd; font-weight: 700; }
     .due strong { font-size: 21px; }`,
    `<div class="band">
      <div>
        ${p.logo ? `<div class="logocard"><img src="${p.logo}" style="max-height:44px;max-width:170px;display:block"></div><div class="bizname" style="font-size:13px;margin-top:10px">${p.bizName}</div>` : `<div class="bizname">${p.bizName}</div>`}
        <div class="bizsub">${p.bizLines}</div>
      </div>
      <div><h1>Invoice</h1><div class="num">${p.number}</div></div>
    </div>
    <div class="page">
      <div class="grid">
        <div class="card"><div class="label">Bill to</div><div class="strong">${p.client}</div><div class="muted">${p.clientLines}</div></div>
        <div class="card"><div class="label">Issued</div><div class="strong">${p.issued}</div>${p.due ? `<div class="label" style="margin-top:10px">Due</div><div class="strong">${p.due}</div>` : ''}</div>
        <div class="card"><div class="label">Amount due</div><div class="strong" style="font-size:16px;color:#2563eb">${p.total}</div></div>
      </div>
      <table class="items"><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${p.rows}</tbody></table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${p.sub}</span></div>${taxRow(p)}
        <div class="due"><span>Total due</span><strong>${p.total}</strong></div>
      </div>
      ${p.notes}
    </div>`
  );
}

function classic(p: Parts) {
  return page(
    `body { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; }
     .page { padding: 46px 56px; }
     .head { text-align: center; }
     .bizname { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; margin-top: 10px; }
     .bizsub { color: #475569; margin-top: 4px; line-height: 1.5; }
     .double { border-top: 3px double #1e293b; margin: 22px 0; }
     h1 { text-align: center; font-size: 15px; letter-spacing: 8px; font-weight: 400; margin: 0; }
     .num { text-align: center; color: #64748b; margin-top: 4px; font-style: italic; }
     .grid { display: flex; justify-content: space-between; margin-top: 26px; gap: 24px; }
     .label { font-family: Georgia, serif; letter-spacing: 2px; }
     table.items { margin-top: 26px; border: 1px solid #1e293b; }
     table.items th { text-align: left; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; font-weight: 400; border-bottom: 1px solid #1e293b; padding: 9px 12px; background: #f8fafc; }
     table.items th.r { text-align: right; }
     table.items td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
     .due { margin-top: 8px; padding-top: 10px; border-top: 3px double #1e293b; display: flex; justify-content: space-between; align-items: baseline; }
     .due span { letter-spacing: 2px; text-transform: uppercase; font-size: 11px; }
     .due strong { font-size: 19px; }`,
    `<div class="page">
      <div class="head">
        ${p.logo ? `<img src="${p.logo}" style="max-height:60px;max-width:190px">` : ''}
        <div class="bizname">${p.bizName}</div>
        <div class="bizsub">${p.bizLines.replace(/<br>/g, ' &middot; ')}</div>
      </div>
      <div class="double"></div>
      <h1>INVOICE</h1><div class="num">No. ${p.number}</div>
      <div class="grid">
        <div><div class="label">Billed to</div><div class="strong">${p.client}</div><div class="muted">${p.clientLines}</div></div>
        <div class="r"><div class="label">Date</div><div>${p.issued}</div>${p.due ? `<div class="label" style="margin-top:10px">Payment due</div><div>${p.due}</div>` : ''}</div>
      </div>
      <table class="items"><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${p.rows}</tbody></table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${p.sub}</span></div>${taxRow(p)}
        <div class="due"><span>Total</span><strong>${p.total}</strong></div>
      </div>
      ${p.notes}
    </div>`
  );
}

export function invoiceHtml(inv: Invoice, biz: Business | null, template: TemplateId = 'minimal') {
  const p = parts(inv, biz);
  if (template === 'modern') return modern(p);
  if (template === 'classic') return classic(p);
  return minimal(p);
}

// Makes the PDF and opens the phone's share menu (WhatsApp, Gmail, and so on).
// Expo Go on Android will not let the share menu read the file that expo-print
// writes, so we take the PDF as base64 and write a fresh copy that the app owns.
// If every way fails, we open the print screen, which can still save the PDF.
export async function shareInvoicePdf(
  inv: Invoice,
  biz: Business | null,
  template: TemplateId
): Promise<'shared' | 'preview'> {
  const html = invoiceHtml(inv, biz, template);
  const { base64 } = await Print.printToFileAsync({ html, width: 595, height: 842, base64: true });
  if (!base64) throw new Error('Could not make the PDF. Try again.');

  const name = (inv.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, '') || 'invoice') + '.pdf';
  const options = { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Share ${inv.invoiceNumber}` };

  const ways: (() => Promise<string>)[] = [
    async () => {
      const file = new File(Paths.cache, name);
      file.create({ overwrite: true });
      await file.write(base64, { encoding: 'base64' });
      return file.uri;
    },
    async () => {
      if (!LegacyFS.cacheDirectory) throw new Error('no cache');
      const uri = LegacyFS.cacheDirectory + name;
      await LegacyFS.writeAsStringAsync(uri, base64, { encoding: 'base64' });
      return uri;
    },
    async () => {
      if (!LegacyFS.documentDirectory) throw new Error('no documents');
      const uri = LegacyFS.documentDirectory + name;
      await LegacyFS.writeAsStringAsync(uri, base64, { encoding: 'base64' });
      return uri;
    },
  ];

  if (await Sharing.isAvailableAsync()) {
    for (const way of ways) {
      try {
        const uri = await way();
        await Sharing.shareAsync(uri, options);
        return 'shared';
      } catch {
        // try the next way
      }
    }
  }

  await Print.printAsync({ html });
  return 'preview';
}
