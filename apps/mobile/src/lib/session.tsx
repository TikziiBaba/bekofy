// Oturum: giriş, kayıt, Google ile giriş (sistem tarayıcısı, dönüş bekofy://auth/callback), çıkış.

import { afterSignIn, logAccess, signIn as coreSignIn, signInWithProvider, signUp as coreSignUp, type Profile } from '@bekofy/core';
import type { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { sb } from './supabase';

export const OAUTH_REDIRECT = 'bekofy://auth/callback';
const GOOGLE_FAILED = 'Google girişi tamamlanamadı. Tekrar dene.';

// Android'de dönüş adresi hem openAuthSessionAsync'e hem auth/callback ekranına ulaşır; aynı kod bir kez takas edilir.
let googleExchange: { code: string; done: Promise<void> } | null = null;

export type SessionState = { status: 'loading' } | { status: 'signed-out'; notice: string | null } | { status: 'signed-in'; user: User; profile: Profile };

interface SessionApi {
  state: SessionState;
  signIn(email: string, password: string): Promise<void>;
  signUp(input: { email: string; password: string; username: string }): Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle(): Promise<void>;
  completeGoogleSignIn(code: string): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const Ctx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  const finish = useCallback(async (session: Session) => {
    const { profile } = await afterSignIn(sb, session);
    void logAccess(sb, session.user.id, {
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appVersion: Constants.expoConfig?.version,
    }).catch(() => undefined);
    setState({ status: 'signed-in', user: session.user, profile });
  }, []);

  // Hata giriş ekranında uyarı olarak görünür; iki çağıran da aynı sözü bekler.
  const completeGoogleSignIn = useCallback(
    (code: string) => {
      if (googleExchange?.code === code) return googleExchange.done;
      const done = (async () => {
        try {
          const { data, error } = await sb.auth.exchangeCodeForSession(code);
          if (error || !data.session) throw new Error(GOOGLE_FAILED);
          await finish(data.session);
        } catch (err) {
          await sb.auth.signOut().catch(() => undefined);
          setState({ status: 'signed-out', notice: err instanceof Error ? err.message : GOOGLE_FAILED });
        }
      })();
      googleExchange = { code, done };
      return done;
    },
    [finish],
  );

  useEffect(() => {
    void (async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session) return setState({ status: 'signed-out', notice: null });
      try {
        await finish(data.session);
      } catch (err) {
        await sb.auth.signOut().catch(() => undefined);
        setState({ status: 'signed-out', notice: err instanceof Error ? err.message : 'Oturum açılamadı. Tekrar giriş yap.' });
      }
    })();
  }, [finish]);

  const api = useMemo<SessionApi>(
    () => ({
      state,
      async signIn(email, password) {
        const { session } = await coreSignIn(sb, email, password);
        await finish(session);
      },
      async signUp(input) {
        const res = await coreSignUp(sb, { ...input, redirectTo: 'https://bekofy.bekirr.dev/auth/callback?next=%2Faccount' });
        if (!res.needsConfirmation) {
          const { data } = await sb.auth.getSession();
          if (data.session) await finish(data.session);
        }
        return res;
      },
      async signInWithGoogle() {
        const url = await signInWithProvider(sb, 'google', OAUTH_REDIRECT, true);
        const result = await WebBrowser.openAuthSessionAsync(url, OAUTH_REDIRECT);
        // Android'de uygulama öne gelince sonuç çoğu zaman 'dismiss' olur; kodu o zaman auth/callback ekranı takas eder.
        if (result.type !== 'success') return;
        const code = new URL(result.url).searchParams.get('code');
        if (!code) throw new Error(GOOGLE_FAILED);
        await completeGoogleSignIn(code);
      },
      completeGoogleSignIn,
      async signOut() {
        await sb.auth.signOut().catch(() => undefined);
        setState({ status: 'signed-out', notice: null });
      },
      async refreshProfile() {
        if (state.status !== 'signed-in') return;
        const res = await sb.from('profiles').select('*').eq('id', state.user.id).single();
        if (res.data) setState({ ...state, profile: res.data });
      },
    }),
    [state, finish, completeGoogleSignIn],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('SessionProvider eksik');
  return v;
}

export function useAuthed() {
  const { state } = useSession();
  if (state.status !== 'signed-in') throw new Error('Oturum açık değil');
  return state;
}
