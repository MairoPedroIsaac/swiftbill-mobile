import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { colors, radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { COMMON_CURRENCIES, CURRENCIES } from '@/lib/currencies';
import { invoiceStore, type Business } from '@/lib/invoices';

type Profile = {
  user: {
    name: string | null;
    email: string;
    image: string | null;
    businessProfile: (Business & { invoicePrefix?: string | null }) | null;
  };
};

// The website accepts logos up to 700,000 characters as a data URL.
const MAX_LOGO_CHARS = 690_000;

// Shrinks a picked photo so it fits in a box, and returns a data URL.
async function toDataUrl(
  asset: ImagePicker.ImagePickerAsset,
  maxW: number,
  maxH: number,
  prefer: 'png' | 'jpeg'
) {
  const scale = Math.min(1, maxW / (asset.width || maxW), maxH / (asset.height || maxH));
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (scale < 1) ctx.resize({ width: Math.round((asset.width || maxW) * scale) });
  const img = await ctx.renderAsync();

  if (prefer === 'png') {
    const png = await img.saveAsync({ format: SaveFormat.PNG, base64: true });
    const url = `data:image/png;base64,${png.base64}`;
    if (url.length <= MAX_LOGO_CHARS) return url;
  }
  const jpg = await img.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.8 });
  return `data:image/jpeg;base64,${jpg.base64}`;
}

function Field(props: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  const { label, ...rest } = props;
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#94a3b8"
        {...rest}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, rest.multiline && styles.multiline, focused && styles.inputFocused]}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [bizName, setBizName] = useState('');
  const [address, setAddress] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [prefix, setPrefix] = useState('INV-');
  const [logo, setLogo] = useState<string | null>(null);
  const [allCurrencies, setAllCurrencies] = useState(false);

  const [busy, setBusy] = useState<'save' | 'logo' | 'photo' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function apply(p: Profile['user']) {
    const b = p.businessProfile;
    setName(p.name || '');
    setPhoto(p.image);
    setBizName(b?.name || '');
    setAddress(b?.address || '');
    setBizEmail(b?.email || '');
    setPhone(b?.phone || '');
    setCurrency(b?.defaultCurrency || 'USD');
    setPrefix(b?.invoicePrefix || 'INV-');
    setLogo(b?.logoUrl || null);
    invoiceStore.setBusiness(b);
  }

  useEffect(() => {
    if (!token) return;
    api<Profile>('/api/user/profile', { token })
      .then((p) => apply(p.user))
      .catch((e) => setMessage({ ok: false, text: e.message }))
      .finally(() => setLoaded(true));
  }, [token]);

  // The website resets business fields that are left out, so always send all of them.
  const businessFields = () => ({
    businessName: bizName.trim() || 'My Business',
    businessAddress: address.trim() || null,
    businessPhone: phone.trim() || null,
    businessEmail: bizEmail.trim(),
    defaultCurrency: currency,
    invoicePrefix: prefix.trim() || 'INV-',
  });

  async function put(body: object, kind: 'save' | 'logo' | 'photo', okText: string) {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await api<Profile>('/api/user/profile', { token, method: 'PUT', body });
      apply(res.user);
      setMessage({ ok: true, text: okText });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not save. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function pickLogo() {
    if (busy) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets?.[0]) return;
    setBusy('logo');
    try {
      const dataUrl = await toDataUrl(res.assets[0], 600, 240, 'png');
      if (dataUrl.length > MAX_LOGO_CHARS) {
        setBusy(null);
        setMessage({ ok: false, text: 'That image is too large. Try a smaller logo.' });
        return;
      }
      await put({ ...businessFields(), businessLogo: dataUrl }, 'logo', 'Logo saved. It is on every new invoice now.');
    } catch {
      setBusy(null);
      setMessage({ ok: false, text: 'Could not read that image. Try another one.' });
    }
  }

  async function removeLogo() {
    if (busy) return;
    await put({ ...businessFields(), businessLogo: null }, 'logo', 'Logo removed.');
  }

  async function pickPhoto() {
    if (busy) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    setBusy('photo');
    try {
      const dataUrl = await toDataUrl(res.assets[0], 400, 400, 'jpeg');
      await put({ image: dataUrl }, 'photo', 'Profile photo saved.');
    } catch {
      setBusy(null);
      setMessage({ ok: false, text: 'Could not read that image. Try another one.' });
    }
  }

  async function removePhoto() {
    if (busy) return;
    await put({ removeImage: true }, 'photo', 'Profile photo removed.');
  }

  async function saveDetails() {
    if (busy) return;
    if (bizEmail.trim() && !/^\S+@\S+\.\S+$/.test(bizEmail.trim())) {
      setMessage({ ok: false, text: 'That business email does not look right.' });
      return;
    }
    await put({ name: name.trim(), ...businessFields() }, 'save', 'Saved.');
  }

  const quick = COMMON_CURRENCIES.includes(currency) ? COMMON_CURRENCIES : [currency, ...COMMON_CURRENCIES];
  const initial = (name || user?.email || 'S').trim().charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sub}>Same settings as the website. Changes show there too.</Text>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled">
        {!loaded ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 40 }} />
        ) : (
          <>
            {message && (
              <Text style={[styles.message, message.ok ? styles.ok : styles.bad]}>{message.text}</Text>
            )}

            <Text style={[styles.group, { marginTop: 4 }]}>Your account</Text>
            <Text style={styles.groupHint}>Just for you. Shown in the app and on the website, not on invoices.</Text>
            <View style={styles.logoRow}>
              <View style={styles.avatar}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{initial}</Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Pressable onPress={pickPhoto} style={styles.smallBtn}>
                  {busy === 'photo' ? (
                    <ActivityIndicator color={colors.blue} />
                  ) : (
                    <Text style={styles.smallBtnText}>{photo ? 'Change photo' : 'Add profile photo'}</Text>
                  )}
                </Pressable>
                {photo && busy !== 'photo' && (
                  <Pressable onPress={removePhoto} hitSlop={8}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <View style={{ height: 16 }} />
            <Field label="Your name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
            <Text style={styles.hint}>Signed in as {user?.email}</Text>

            <View style={styles.divider} />
            <Text style={styles.group}>Your business</Text>
            <Text style={styles.groupHint}>This is what your clients see on every invoice.</Text>
            <Text style={styles.section}>Business logo</Text>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                {logo ? (
                  <Image source={{ uri: logo }} style={styles.logoImg} resizeMode="contain" />
                ) : (
                  <Text style={styles.logoEmpty}>No logo</Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Pressable onPress={pickLogo} style={styles.smallBtn}>
                  {busy === 'logo' ? (
                    <ActivityIndicator color={colors.blue} />
                  ) : (
                    <Text style={styles.smallBtnText}>{logo ? 'Change logo' : 'Upload logo'}</Text>
                  )}
                </Pressable>
                {logo && busy !== 'logo' && (
                  <Pressable onPress={removeLogo} hitSlop={8}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <Text style={styles.hint}>
              Shows at the top of every new invoice. A PNG with a see-through background looks best.
            </Text>

            <Text style={styles.section}>Business details</Text>
            <Field label="Business name" value={bizName} onChangeText={setBizName} placeholder="My Business" />
            <Field label="Address" value={address} onChangeText={setAddress} placeholder="Kigali, Rwanda" multiline />
            <Field
              label="Billing email"
              value={bizEmail}
              onChangeText={setBizEmail}
              placeholder="you@business.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+250 7xx xxx xxx" keyboardType="phone-pad" />
            <Field label="Invoice number prefix" value={prefix} onChangeText={setPrefix} placeholder="INV-" autoCapitalize="characters" />

            <Text style={styles.label}>Default currency</Text>
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
                    <Text style={[styles.currencyCode, c.code === currency && styles.white]}>{c.code}</Text>
                    <Text style={[styles.currencyName, c.code === currency && styles.white]}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.wrapRow}>
                {quick.map((c) => (
                  <Pressable key={c} onPress={() => setCurrency(c)} style={[styles.chip, c === currency && styles.chipActive]}>
                    <Text style={[styles.chipText, c === currency && styles.white]}>{c}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setAllCurrencies(true)} style={styles.chip}>
                  <Text style={styles.chipText}>More</Text>
                </Pressable>
              </View>
            )}

            <Pressable onPress={saveDetails} style={({ pressed }) => [styles.save, pressed && { opacity: 0.85 }]}>
              {busy === 'save' ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save changes</Text>}
            </Pressable>
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
  sub: { color: colors.mutedOnDark, fontSize: 14, marginTop: 6 },
  sheet: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  section: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 26,
    marginBottom: 12,
  },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 28 },
  group: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.4, marginTop: 24 },
  groupHint: { color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 4, lineHeight: 18 },
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
  hint: { color: colors.muted, fontSize: 13, marginTop: 10, lineHeight: 18 },
  message: { fontSize: 14, padding: 12, borderRadius: radius.sm, overflow: 'hidden', marginTop: 4 },
  ok: { backgroundColor: '#ecfccb', color: '#3f6212' },
  bad: { backgroundColor: '#fee2e2', color: colors.danger },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoBox: {
    width: 140,
    height: 80,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.field,
    padding: 8,
  },
  logoImg: { width: '100%', height: '100%' },
  logoEmpty: { color: '#94a3b8', fontSize: 13 },
  smallBtn: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  smallBtnText: { color: colors.blue, fontSize: 15, fontWeight: '700' },
  removeText: { color: colors.danger, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 72, height: 72 },
  avatarText: { color: colors.white, fontSize: 28, fontWeight: '800' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  white: { color: colors.white },
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
  save: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  saveText: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
