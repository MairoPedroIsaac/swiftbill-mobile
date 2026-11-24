import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { colors, radius } from '@/constants/theme';
import { StatusShade } from '@/components/StatusShade';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/money';
import {
  formatDate,
  invoiceStore,
  invoiceSubtotal,
  invoiceTotal,
  STATUS,
  type Invoice,
  type InvoiceStatus,
} from '@/lib/invoices';
import * as Print from 'expo-print';
import { asTemplate, invoiceHtml, shareInvoicePdf, TEMPLATES, type TemplateId } from '@/lib/pdf';

export default function InvoiceScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [inv, setInv] = useState<Invoice | undefined>(() => invoiceStore.get(id));
  const [busy, setBusy] = useState<'share' | 'preview' | InvoiceStatus | null>(null);
  const [template, setTemplate] = useState<TemplateId>(() => asTemplate(invoiceStore.get(id)?.template));
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  if (!inv) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingHorizontal: 24 }]}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.client, { marginTop: 24 }]}>Invoice not found</Text>
      </View>
    );
  }

  const c = inv.currency;
  const sub = invoiceSubtotal(inv);
  const tax = sub * ((inv.taxRate || 0) / 100);
  const st = STATUS[inv.status] ?? STATUS.DRAFT;

  async function setStatus(status: InvoiceStatus) {
    if (!inv || busy) return;
    setBusy(status);
    setError('');
    try {
      const res = await api<{ invoice: Invoice }>('/api/invoices', {
        token,
        method: 'PATCH',
        body: { invoiceId: inv.id, status },
      });
      invoiceStore.put([res.invoice]);
      setInv(res.invoice);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function onShare() {
    if (!inv || busy) return;
    setBusy('share');
    setError('');
    setNote('');
    try {
      const how = await shareInvoicePdf(inv, invoiceStore.business(), template);
      if (how === 'preview') {
        setError('');
        setNote('Your phone opened the print screen instead. Choose Save as PDF, then share the file.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make the PDF. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function onPreview() {
    if (!inv || busy) return;
    setBusy('preview');
    setError('');
    try {
      // Opens the phone's print preview. It also has "Save as PDF".
      await Print.printAsync({ html: invoiceHtml(inv, invoiceStore.business(), template) });
    } catch {
      // closing the preview is not an error
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
    <ScrollView style={styles.root} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <View style={styles.heroRow}>
          <Text style={styles.number}>{inv.invoiceNumber}</Text>
          <Text style={[styles.chip, { backgroundColor: st.bg, color: st.fg }]}>{st.label}</Text>
        </View>
        <Text style={styles.client} numberOfLines={2}>
          {inv.customer?.name || 'Client'}
        </Text>
        <Text style={styles.total}>{money(invoiceTotal(inv), c)}</Text>
        <Text style={styles.dates}>
          Issued {formatDate(inv.date)}
          {inv.dueDate ? `   ·   Due ${formatDate(inv.dueDate)}` : ''}
        </Text>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.section, { marginTop: 0 }]}>Invoice design</Text>
        <View style={styles.templates}>
          {TEMPLATES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTemplate(t.id)}
              style={[styles.tpl, template === t.id && styles.tplActive]}>
              <TemplateThumb id={t.id} />
              <Text style={styles.tplName}>{t.name}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={onShare}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
          {busy === 'share' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryText}>Share PDF</Text>
          )}
        </Pressable>
        <Pressable onPress={onPreview} style={[styles.secondary, { marginTop: 10, flex: 0 }]}>
          {busy === 'preview' ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.secondaryText}>Preview</Text>
          )}
        </Pressable>
        <Text style={styles.hint}>Share sends it on WhatsApp, Gmail or any app.</Text>

        <View style={styles.statusRow}>
          {inv.status !== 'PAID' ? (
            <Pressable onPress={() => setStatus('PAID')} style={[styles.secondary, styles.paidBtn]}>
              {busy === 'PAID' ? (
                <ActivityIndicator color={colors.navy} />
              ) : (
                <Text style={styles.paidText}>Mark as paid</Text>
              )}
            </Pressable>
          ) : (
            <Pressable onPress={() => setStatus('SENT')} style={styles.secondary}>
              {busy === 'SENT' ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.secondaryText}>Mark as unpaid</Text>
              )}
            </Pressable>
          )}
          {inv.status === 'DRAFT' && (
            <Pressable onPress={() => setStatus('SENT')} style={styles.secondary}>
              {busy === 'SENT' ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.secondaryText}>Mark as sent</Text>
              )}
            </Pressable>
          )}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!note && <Text style={styles.note}>{note}</Text>}

        <Text style={styles.section}>Items</Text>
        {inv.lineItems.map((li) => (
          <View key={li.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{li.description}</Text>
              <Text style={styles.itemSub}>
                {li.quantity} × {money(li.rate, c)}
              </Text>
            </View>
            <Text style={styles.itemAmount}>{money(li.quantity * li.rate, c)}</Text>
          </View>
        ))}

        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Subtotal</Text>
          <Text style={styles.sumValue}>{money(sub, c)}</Text>
        </View>
        {!!inv.taxRate && (
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Tax ({inv.taxRate}%)</Text>
            <Text style={styles.sumValue}>{money(tax, c)}</Text>
          </View>
        )}
        <View style={styles.sumRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{money(invoiceTotal(inv), c)}</Text>
        </View>

        {!!inv.customer?.address && (
          <>
            <Text style={styles.section}>Client address</Text>
            <Text style={styles.body}>{inv.customer.address}</Text>
          </>
        )}
        {!!inv.notes && (
          <>
            <Text style={styles.section}>Notes</Text>
            <Text style={styles.body}>{inv.notes}</Text>
          </>
        )}
      </View>
    </ScrollView>
    <StatusShade />
    </View>
  );
}

// Tiny drawings of each design so you can tell them apart.
function TemplateThumb({ id }: { id: TemplateId }) {
  const line = (w: number | `${number}%`, c = '#cbd5e1', mt = 4) => (
    <View style={{ height: 3, width: w, backgroundColor: c, borderRadius: 2, marginTop: mt }} />
  );
  return (
    <View style={thumb.page}>
      {id === 'modern' && (
        <View style={thumb.band}>
          {line(26, '#ffffff', 0)}
          <View style={thumb.bandLine} />
        </View>
      )}
      {id === 'minimal' && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {line(18, '#0f172a', 0)}
          {line(22, '#0f172a', 0)}
        </View>
      )}
      {id === 'classic' && (
        <View style={{ alignItems: 'center' }}>
          {line(24, '#1e293b', 0)}
          <View style={thumb.double} />
        </View>
      )}
      <View style={{ paddingHorizontal: id === 'modern' ? 6 : 0 }}>
        {line('100%')}
        {line('100%')}
        {line('80%')}
        <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
          <View
            style={{
              width: 28,
              height: 8,
              borderRadius: 2,
              backgroundColor: id === 'minimal' ? '#bfdbfe' : id === 'modern' ? '#0b1730' : 'transparent',
              borderTopWidth: id === 'classic' ? 2 : 0,
              borderColor: '#1e293b',
            }}
          />
        </View>
      </View>
    </View>
  );
}

const thumb = StyleSheet.create({
  page: {
    height: 84,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    overflow: 'hidden',
  },
  band: { backgroundColor: '#0b1730', margin: -8, marginBottom: 6, padding: 8, paddingBottom: 0 },
  bandLine: { height: 2, backgroundColor: '#2563eb', marginTop: 8, marginHorizontal: -8 },
  double: { height: 4, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1e293b', width: '100%', marginTop: 5 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  hero: { paddingHorizontal: 24, paddingBottom: 30 },
  back: { color: colors.mutedOnDark, fontSize: 16, fontWeight: '600' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  number: { color: colors.blueLight, fontSize: 15, fontWeight: '700' },
  chip: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  client: { color: colors.white, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 8 },
  total: { color: colors.lime, fontSize: 38, fontWeight: '800', letterSpacing: -1, marginTop: 10 },
  dates: { color: colors.mutedOnDark, fontSize: 14, marginTop: 8 },
  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 24,
  },
  templates: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  tpl: { flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, padding: 8 },
  tplActive: { borderColor: colors.blue, backgroundColor: '#eff6ff' },
  tplName: { textAlign: 'center', fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 8 },
  primary: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 8 },
  statusRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  secondary: {
    flex: 1,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  paidBtn: { backgroundColor: colors.lime, borderColor: colors.lime },
  paidText: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 14, marginTop: 14 },
  note: { color: colors.navy2, backgroundColor: colors.blueSoft, fontSize: 14, padding: 12, borderRadius: radius.sm, overflow: 'hidden', marginTop: 14 },
  section: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 30,
    marginBottom: 6,
  },
  item: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { fontSize: 16, fontWeight: '600', color: colors.ink },
  itemSub: { fontSize: 13, color: colors.muted, marginTop: 3 },
  itemAmount: { fontSize: 16, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  sumLabel: { color: colors.muted, fontSize: 15 },
  sumValue: { color: colors.ink, fontSize: 15, fontVariant: ['tabular-nums'] },
  totalLabel: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  totalValue: { color: colors.ink, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
});
