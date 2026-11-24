import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { Logo } from '@/components/Logo';
import { colors, radius } from '@/constants/theme';
import { StatusShade } from '@/components/StatusShade';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/money';
import { invoiceStore, invoiceTotal, STATUS, type Business, type Invoice } from '@/lib/invoices';

type InvoicesResponse = {
  stats: { totalInvoices: number; paidAmount: number; pendingDrafts: number };
  invoices: Invoice[];
};
type ProfileResponse = { user: { businessProfile: Business | null } };
const plural = (n: number, word: string) => `${word}${n === 1 ? '' : 's'}`;

export default function Home() {
  const insets = useSafeAreaInsets();
  const { token, user, signOut } = useAuth();
  const [data, setData] = useState<InvoicesResponse | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [inv, profile] = await Promise.all([
        api<InvoicesResponse>('/api/invoices?limit=30', { token }),
        api<ProfileResponse>('/api/user/profile', { token }),
      ]);
      invoiceStore.put(inv.invoices);
      invoiceStore.setBusiness(profile.user.businessProfile);
      setData(inv);
      setCurrency(profile.user.businessProfile?.defaultCurrency || 'USD');
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await signOut();
        router.replace('/sign-in');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not load your invoices.');
    }
  }, [token, signOut]);

  // Reload every time this screen shows, e.g. after saving a new invoice.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function onSignOut() {
    await signOut();
    router.replace('/sign-in');
  }

  const firstName = (user?.name || '').split(' ')[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.white} />}>
      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <Logo size={32} />

        <Text style={styles.hello}>{firstName ? `Hi, ${firstName}` : 'Welcome back'}</Text>
        <Text style={styles.paidLabel}>Paid so far</Text>
        {data ? (
          <Text style={styles.paid}>{money(data.stats.paidAmount, currency)}</Text>
        ) : (
          <ActivityIndicator color={colors.white} style={{ alignSelf: 'flex-start', marginTop: 12 }} />
        )}

        {data && (
          <View style={styles.miniRow}>
            <Text style={styles.mini}>
              <Text style={styles.miniNum}>{data.stats.totalInvoices}</Text> {plural(data.stats.totalInvoices, 'invoice')}
            </Text>
            <Text style={styles.mini}>
              <Text style={styles.miniNum}>{data.stats.pendingDrafts}</Text> {plural(data.stats.pendingDrafts, 'draft')}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={() => router.push('/new-invoice')}
          style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.newBtnPlus}>+</Text>
          <Text style={styles.newBtnText}>New invoice</Text>
        </Pressable>

        <Text style={styles.heading}>Your invoices</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {data && data.invoices.length === 0 && (
          <Text style={styles.empty}>No invoices yet. Tap New invoice to make your first one.</Text>
        )}
        {data?.invoices.map((inv) => {
          const st = STATUS[inv.status] ?? STATUS.DRAFT;
          return (
            <Pressable
              key={inv.id}
              onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: inv.id } })}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.client} numberOfLines={1}>
                  {inv.customer?.name || 'Client'}
                </Text>
                <Text style={styles.number}>{inv.invoiceNumber}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.amount}>{money(invoiceTotal(inv), inv.currency)}</Text>
                <Text style={[styles.chip, { backgroundColor: st.bg, color: st.fg }]}>{st.label}</Text>
              </View>
            </Pressable>
          );
        })}

        <View style={styles.account}>
          <Text style={styles.accountText} numberOfLines={1}>
            Signed in as {user?.email}
          </Text>
          <Pressable
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.settingsText}>Settings, logo and photo</Text>
          </Pressable>
          <Pressable
            onPress={onSignOut}
            style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
    <StatusShade />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  hero: { paddingHorizontal: 24, paddingBottom: 32 },
  hello: { color: colors.white, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginTop: 32 },
  paidLabel: { color: colors.mutedOnDark, fontSize: 14, marginTop: 24 },
  paid: { color: colors.lime, fontSize: 40, fontWeight: '800', letterSpacing: -1.2, marginTop: 4 },
  miniRow: { flexDirection: 'row', gap: 20, marginTop: 12 },
  mini: { color: colors.mutedOnDark, fontSize: 14 },
  miniNum: { color: colors.white, fontWeight: '700' },
  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  newBtn: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  newBtnPlus: { color: colors.white, fontSize: 24, fontWeight: '600', marginTop: -2 },
  newBtnText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  account: { marginTop: 40, alignItems: 'center', gap: 12 },
  accountText: { color: colors.muted, fontSize: 13 },
  settingsBtn: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsText: { color: colors.blue, fontSize: 16, fontWeight: '700' },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 8 },
  error: { color: colors.danger, fontSize: 14, marginTop: 8 },
  empty: { color: colors.muted, fontSize: 15, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  client: { fontSize: 16, fontWeight: '700', color: colors.ink },
  number: { fontSize: 13, color: colors.muted, marginTop: 3 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  chip: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
