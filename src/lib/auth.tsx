import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { api } from './api';
import { WEB_URL } from './site';

export type User = { name: string | null; email: string };

type AuthState = {
  ready: boolean;
  token: string | null;
  user: User | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
  completeWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const TOKEN_KEY = 'swiftbill.token';
const USER_KEY = 'swiftbill.user';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Load the saved sign-in when the app opens.
  useEffect(() => {
    // Never get stuck: show sign in after 3 seconds even if storage is slow.
    const safety = setTimeout(() => setReady(true), 3000);
    (async () => {
      try {
        const [t, u] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (t && u) {
          tokenRef.current = t;
          setToken(t);
          setUser(JSON.parse(u));
        }
      } catch {
        // nothing saved
      } finally {
        clearTimeout(safety);
        setReady(true);
      }
    })();
    return () => clearTimeout(safety);
  }, []);

  const save = useCallback(async (t: string, u: User) => {
    await SecureStore.setItemAsync(TOKEN_KEY, t);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(u));
    tokenRef.current = t;
    setToken(t);
    setUser(u);
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const data = await api<{ token: string; user: { name: string | null; email: string } }>(
        '/api/mobile/login',
        { method: 'POST', body: { email, password } }
      );
      await save(data.token, { name: data.user.name, email: data.user.email });
    },
    [save]
  );

  // Token from the Google flow. Can arrive twice (browser result and app link), so skip repeats.
  const completeWithToken = useCallback(
    async (t: string) => {
      if (tokenRef.current === t) return;
      const data = await api<{ user: { name: string | null; email: string } }>('/api/user/profile', {
        token: t,
      });
      await save(t, { name: data.user.name, email: data.user.email });
    },
    [save]
  );

  const signInWithGoogle = useCallback(async () => {
    const redirect = Linking.createURL('auth');
    const result = await WebBrowser.openAuthSessionAsync(
      `${WEB_URL}/mobile-auth?redirect=${encodeURIComponent(redirect)}`,
      redirect
    );
    if (result.type !== 'success') return false;
    const t = Linking.parse(result.url).queryParams?.token;
    if (typeof t !== 'string') return false;
    await completeWithToken(t);
    return true;
  }, [completeWithToken]);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    tokenRef.current = null;
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ ready, token, user, signInWithEmail, signInWithGoogle, completeWithToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
