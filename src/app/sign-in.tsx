import { useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

import { Logo } from '@/components/Logo';
import { colors, radius } from '@/constants/theme';
import { WEB_URL } from '@/lib/site';
import { useAuth } from '@/lib/auth';

// Faint grid behind the header, same idea as the website's auth panel.
function Grid() {
  const lines = Array.from({ length: 12 });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {lines.map((_, i) => (
        <View key={`v${i}`} style={[styles.gridV, { left: i * 48 }]} />
      ))}
      {lines.map((_, i) => (
        <View key={`h${i}`} style={[styles.gridH, { top: i * 48 }]} />
      ))}
    </View>
  );
}

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const { signInWithEmail, signInWithGoogle } = useAuth();

  async function onSignIn() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setBusy('email');
    try {
      await signInWithEmail(email.trim(), password);
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function onGoogle() {
    if (busy) return;
    setError('');
    setBusy('google');
    try {
      if (await signInWithGoogle()) router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign in did not finish. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
          <Grid />
          <Logo />
          <Text style={styles.title}>
            Get paid{'\n'}
            <Text style={styles.titleBlue}>for your work.</Text>
          </Text>
          <Text style={styles.sub}>Same account as the SwiftBill website.</Text>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.heading}>Sign in</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
            style={[styles.input, focused === 'email' && styles.inputFocused]}
          />

          <View style={styles.labelRow}>
            <Text style={styles.label}>Password</Text>
            <Pressable
              hitSlop={10}
              onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/auth/forgot-password`)}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>
          <View style={[styles.input, styles.passwordWrap, focused === 'password' && styles.inputFocused]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={onSignIn}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              style={styles.passwordInput}
            />
            <Pressable hitSlop={10} onPress={() => setShowPassword((v) => !v)}>
              <Text style={styles.toggle}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={onSignIn}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            {busy === 'email' ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryText}>Sign in</Text>
            )}
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          <Pressable
            onPress={onGoogle}
            style={({ pressed }) => [styles.google, pressed && styles.pressed]}>
            {busy === 'google' ? (
              <ActivityIndicator color={colors.blue} />
            ) : (
              <>
                <Image source={require('@/assets/images/google-g.png')} style={styles.googleIcon} />
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to SwiftBill? </Text>
            <Pressable
              hitSlop={10}
              onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/auth/signup`)}>
              <Text style={styles.link}>Create an account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  scroll: { flexGrow: 1 },
  hero: { paddingHorizontal: 24, paddingBottom: 36, overflow: 'hidden' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  title: {
    color: colors.white,
    fontSize: 44,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1.8,
    marginTop: 36,
  },
  titleBlue: { color: colors.blueLight },
  sub: { color: colors.mutedOnDark, fontSize: 15, marginTop: 14 },

  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  heading: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.6, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18 },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.field,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
  },
  inputFocused: { borderColor: colors.blue, backgroundColor: colors.white },
  passwordWrap: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, height: '100%', fontSize: 16, color: colors.ink },
  toggle: { fontSize: 14, fontWeight: '700', color: colors.blue, paddingLeft: 12 },
  link: { fontSize: 14, fontWeight: '700', color: colors.blue },
  error: { color: colors.danger, fontSize: 14, marginTop: 14 },
  primary: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { color: colors.muted, fontSize: 13 },
  google: {
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleIcon: { width: 22, height: 22 },
  googleText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { fontSize: 14, color: colors.muted },
});
