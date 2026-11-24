import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { colors, radius } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/money';
import { COMMON_CURRENCIES, CURRENCIES } from '@/lib/currencies';

type Customer = { id: string; name: string; address: string | null };
type SavedItem = { id: string; name: string; defaultRate: number };
type BusinessData = { customers: Customer[]; items: SavedItem[]; nextInvoiceNumber: string };
type ProfileResponse = { user: { businessProfile: { defaultCurrency?: string | null } | null } };
type Row = { key: string; description: string; quantity: string; rate: string };

const DUE = [
  { label: 'On receipt', days: 0 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

let rowId = 0;
const newRow = (): Row => ({ key: String(++rowId), description: '', quantity: '1', rate: '' });
const num = (v: string) => {
  const n = parseFloat(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function Field(props: TextInputProps & { label?: string }) {
  const [focused, setFocused] = useState(false);
  const { label, style, ...rest } = props;
  return (
    <View style={{ flex: (style as any)?.flex }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor="#94a3b8"
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[styles.input, rest.multiline && styles.multiline, focused && styles.inputFocused]}
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function NewInvoice() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();

  const [data, setData] = useState<BusinessData | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [dueDays, setDueDays] = useState(14);
  const [tax, setTax] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [allCurrencies, setAllCurrencies] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<BusinessData>('/api/business-data', { token }),
      api<ProfileResponse>('/api/user/profile', { token }),
    ])
      .then(([bd, profile]) => {
        setData(bd);
        const c = profile.user.businessProfile?.defaultCurrency;
        if (c) setCurrency(c);
      })
      .catch(() => setData({ customers: [], items: [], nextInvoiceNumber: '' }));
  }, [token]);

  const subtotal = useMemo(() => rows.reduce((s, r) => s + num(r.quantity) * num(r.rate), 0), [rows]);
  const taxAmount = subtotal * (num(tax) / 100);
  const total = subtotal + taxAmount;

  const quick = COMMON_CURRENCIES.includes(currency) ? COMMON_CURRENCIES : [currency, ...COMMON_CURRENCIES];

  const typed = clientName.trim().toLowerCase();
  const customerMatches = (data?.customers ?? [])
    .filter((c) => !typed || c.name.toLowerCase().includes(typed))
    .filter((c) => c.name.toLowerCase() !== typed)
    .slice(0, 6);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function onSave() {
    if (saving || !token) return;
    const items = rows
      .filter((r) => r.description.trim() || num(r.rate) > 0)
      .map((r) => ({
        description: r.description.trim() || 'Service / Product',
        quantity: Math.max(1, Math.round(num(r.quantity))),
        rate: Math.max(0, num(r.rate)),
      }));
    if (!clientName.trim()) return setError('Add the client name.');
    if (items.length === 0) return setError('Add at least one item with a price.');

    setError('');
    setSaving(true);
    const date = new Date();
    const due = new Date(date.getTime() + dueDays * 86400000);
    try {
      await api('/api/invoices', {
        token,
        method: 'POST',
        body: {
          senderName: user?.name || undefined,
          clientName: clientName.trim(),
          clientAddress: clientAddress.trim() || undefined,
          date: date.toISOString(),
          dueDate: due.toISOString(),
          currency,
          taxRate: num(tax),
          notes: notes.trim() || null,
          template: 'minimal',
          items,
        },
      });
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace('/');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>New invoice</Text>
        <Text style={styles.number}>{data?.nextInvoiceNumber || ' '}</Text>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={{ padding: 24, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled">
        {!data ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.section}>Client</Text>
            <Field
              label="Name"
              value={clientName}
              onChangeText={setClientName}
              placeholder="Kigali Coffee Co."
              autoCapitalize="words"
            />
            {customerMatches.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {customerMatches.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    onPress={() => {
                      setClientName(c.name);
                      setClientAddress(c.address || '');
                    }}
                  />
                ))}
              </ScrollView>
            )}
            <View style={{ height: 14 }} />
            <Field
              label="Address (optional)"
              value={clientAddress}
              onChangeText={setClientAddress}
              placeholder="Street, city"
              multiline
            />

            <Text style={styles.section}>Items</Text>
            {rows.map((row, i) => {
              const q = row.description.trim().toLowerCase();
              const suggestions =
                activeRow === row.key
                  ? (data.items ?? [])
                      .filter((it) => !q || it.name.toLowerCase().includes(q))
                      .filter((it) => it.name.toLowerCase() !== q)
                      .slice(0, 4)
                  : [];
              return (
                <View key={row.key} style={styles.itemCard}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemLabel}>Item {i + 1}</Text>
                    {rows.length > 1 && (
                      <Pressable hitSlop={10} onPress={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}>
                        <Text style={styles.remove}>Remove</Text>
                      </Pressable>
                    )}
                  </View>
                  <Field
                    value={row.description}
                    onChangeText={(v) => updateRow(row.key, { description: v })}
                    placeholder="What did you do or sell?"
                    onFocus={() => setActiveRow(row.key)}
                  />
                  {suggestions.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                      {suggestions.map((it) => (
                        <Chip
                          key={it.id}
                          label={`${it.name} · ${money(it.defaultRate, currency)}`}
                          onPress={() => {
                            updateRow(row.key, { description: it.name, rate: String(it.defaultRate) });
                            setActiveRow(null);
                          }}
                        />
                      ))}
                    </ScrollView>
                  )}
                  <View style={styles.itemNums}>
                    <Field
                      label="Qty"
                      value={row.quantity}
                      onChangeText={(v) => updateRow(row.key, { quantity: v.replace(/[^0-9]/g, '') })}
                      keyboardType="number-pad"
                      style={{ flex: 1 }}
                    />
                    <Field
                      label={`Price (${currency})`}
                      value={row.rate}
                      onChangeText={(v) => updateRow(row.key, { rate: v.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      style={{ flex: 2 }}
                    />
                  </View>
                  <Text style={styles.lineTotal}>{money(num(row.quantity) * num(row.rate), currency)}</Text>
                </View>
              );
            })}
            <Pressable onPress={() => setRows((rs) => [...rs, newRow()])} style={styles.addItem}>
              <Text style={styles.addItemText}>+ Add another item</Text>
            </Pressable>

            <Text style={styles.section}>Details</Text>
            <Text style={styles.label}>Currency</Text>
            {allCurrencies ? (
              <View style={styles.currencyList}>
                {CURRENCIES.map((c) => (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      setCurrency(c.code);
                      setAllCurrencies(false);
                    }}
                    style={[styles.currencyItem, c.code === currency && styles.currencyItemActive]}>
                    <Text style={[styles.currencyCode, c.code === currency && styles.chipTextActive]}>
                      {c.code}
                    </Text>
                    <Text style={[styles.currencyName, c.code === currency && styles.chipTextActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.wrapRow}>
                {quick.map((c) => (
                  <Chip key={c} label={c} active={c === currency} onPress={() => setCurrency(c)} />
                ))}
                <Chip label="More" onPress={() => setAllCurrencies(true)} />
              </View>
            )}

            <Text style={[styles.label, { marginTop: 18 }]}>Due</Text>
            <View style={styles.wrapRow}>
              {DUE.map((d) => (
                <Chip key={d.days} label={d.label} active={d.days === dueDays} onPress={() => setDueDays(d.days)} />
              ))}
            </View>

            <View style={{ height: 18 }} />
            <Field
              label="Tax % (optional)"
              value={tax}
              onChangeText={(v) => setTax(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <View style={{ height: 14 }} />
            <Field
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Thank you for your business."
              multiline
            />

            <View style={styles.summary}>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Subtotal</Text>
                <Text style={styles.sumValue}>{money(subtotal, currency)}</Text>
              </View>
              {num(tax) > 0 && (
                <View style={styles.sumRow}>
                  <Text style={styles.sumLabel}>Tax ({num(tax)}%)</Text>
                  <Text style={styles.sumValue}>{money(taxAmount, currency)}</Text>
                </View>
              )}
              <View style={[styles.sumRow, { marginTop: 8 }]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{money(total, currency)}</Text>
              </View>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              onPress={onSave}
              style={({ pressed }) => [styles.save, pressed && { opacity: 0.85 }]}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save invoice</Text>}
            </Pressable>
            <View style={{ height: insets.bottom }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  header: { paddingHorizontal: 24, paddingBottom: 24 },
  back: { color: colors.mutedOnDark, fontSize: 16, fontWeight: '600' },
  title: { color: colors.white, fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 18 },
  number: { color: colors.blueLight, fontSize: 15, fontWeight: '700', marginTop: 4 },
  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  section: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 28,
    marginBottom: 12,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.field,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  multiline: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  inputFocused: { borderColor: colors.blue, backgroundColor: colors.white },
  chipRow: { marginTop: 10, flexGrow: 0 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: colors.white,
  },
  currencyList: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  currencyItemActive: { backgroundColor: colors.navy },
  currencyCode: { width: 44, fontSize: 15, fontWeight: '800', color: colors.ink },
  currencyName: { fontSize: 15, color: colors.muted },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: colors.white },
  itemCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 12,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  itemLabel: { fontSize: 13, fontWeight: '700', color: colors.muted },
  remove: { fontSize: 13, fontWeight: '700', color: colors.danger },
  itemNums: { flexDirection: 'row', gap: 10, marginTop: 12 },
  lineTotal: {
    textAlign: 'right',
    marginTop: 10,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  addItem: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.blue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addItemText: { color: colors.blue, fontSize: 15, fontWeight: '700' },
  summary: {
    marginTop: 28,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    padding: 18,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 },
  sumLabel: { color: colors.mutedOnDark, fontSize: 14 },
  sumValue: { color: colors.white, fontSize: 15, fontVariant: ['tabular-nums'] },
  totalLabel: { color: colors.white, fontSize: 16, fontWeight: '700' },
  totalValue: { color: colors.lime, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  error: { color: colors.danger, fontSize: 14, marginTop: 16 },
  save: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveText: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
