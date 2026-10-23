// Oturum: etkin hesap, giriş/çıkış, Google dönüşü, hesap ekleme ve hesaplar arası geçiş.

import { afterSignIn, logAccess, signIn as coreSignIn, signInWithProvider, signUp as coreSignUp, type BekofyClient, type Profile } from '@bekofy/core';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { OAUTH_REDIRECT } from '../../../shared/ipc';
import { activeSlot, clientFor, forgetAccount, newSlot, saveAccount, setActiveSlot, storedAccounts, type StoredAccount } from './accounts';
import { bridge } from './bridge';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out'; slot: string; sb: BekofyClient; notice: string | null; adding: boolean }
  | { status: 'signed-in'; slot: string; sb: BekofyClient; user: User; profile: Profile };

interface SessionApi {
  state: SessionState;
  accounts: StoredAccount[];
  signIn(email: string, password: string): Promise<void>;
  signUp(input: { email: string; password: string; username: string }): Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  addAccount(): void;
  cancelAdd(): void;
  switchTo(slot: string): void;
  refreshProfile(): Promise<void>;
}

const Ctx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [accounts, setAccounts] = useState<StoredAccount[]>(storedAccounts);
  const stateRef = useRef(state);
  stateRef.current = state;

  const finish = useCallback(async (slot: string, sb: BekofyClient, session: Session) => {
    const { profile } = await afterSignIn(sb, session);
    saveAccount({ slot, userId: session.user.id, email: session.user.email ?? '', username: profile.username, avatarUrl: profile.avatar_url });
    setActiveSlot(slot);
    setAccounts(storedAccounts());
    void logAccess(sb, session.user.id, { platform: 'desktop', appVersion: bridge?.version || undefined, userAgent: navigator.userAgent }).catch(() => undefined);
    setState({ status: 'signed-in', slot, sb, user: session.user, profile });
  }, []);

  const signedOut = useCallback((notice: string | null = null, adding = false) => {
    const slot = newSlot();
    setState({ status: 'signed-out', slot, sb: clientFor(slot), notice, adding });
  }, []);

  // Açılış: etkin hesabın oturumu.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const slot = activeSlot() ?? storedAccounts()[0]?.slot ?? null;
      if (!slot) return signedOut();
      const sb = clientFor(slot);
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        forgetAccount(slot);
        setAccounts(storedAccounts());
        return signedOut();
      }
      try {
        await finish(slot, sb, data.session);
      } catch (err) {
        forgetAccount(slot);
        setAccounts(storedAccounts());
        signedOut(err instanceof Error ? err.message : 'Oturum açılamadı. Tekrar giriş yap.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [finish, signedOut]);

  // Google girişinden dönüş: bekofy://auth/callback?code=...
  useEffect(() => {
    if (!bridge) return;
    return bridge.auth.onCallback(async (raw) => {
      const s = stateRef.current;
      if (s.status !== 'signed-out') return;
      let code: string | null = null;
      try {
        code = new URL(raw).searchParams.get('code');
      } catch {
        code = null;
      }
      if (!code) return setState({ ...s, notice: 'Google girişi tamamlanamadı. Tekrar dene.' });
      const { data, error } = await s.sb.auth.exchangeCodeForSession(code);
      if (error || !data.session) return setState({ ...s, notice: 'Google girişi tamamlanamadı. Tekrar dene.' });
      try {
        await finish(s.slot, s.sb, data.session);
      } catch (err) {
        setState({ ...s, notice: err instanceof Error ? err.message : 'Giriş yapılamadı.' });
      }
    });
  }, [finish]);

  const api = useMemo<SessionApi>(
    () => ({
      state,
      accounts,
      async signIn(email, password) {
        const s = stateRef.current;
        if (s.status !== 'signed-out') return;
        const existing = storedAccounts().find((a) => a.email.toLocaleLowerCase('tr-TR') === email.trim().toLocaleLowerCase('tr-TR'));
        if (existing) {
          // Bu hesap zaten ekli: ona geç.
          setActiveSlot(existing.slot);
          window.location.reload();
          return;
        }
        const { session } = await coreSignIn(s.sb, email, password);
        await finish(s.slot, s.sb, session);
      },
      async signUp(input) {
        const s = stateRef.current;
        if (s.status !== 'signed-out') return { needsConfirmation: false };
        const res = await coreSignUp(s.sb, { ...input, redirectTo: 'https://bekofy.bekirr.dev/auth/callback?next=%2Faccount' });
        if (!res.needsConfirmation) {
          const { data } = await s.sb.auth.getSession();
          if (data.session) await finish(s.slot, s.sb, data.session);
        }
        return res;
      },
      async signInWithGoogle() {
        const s = stateRef.current;
        if (s.status !== 'signed-out' || !bridge) return;
        const url = await signInWithProvider(s.sb, 'google', OAUTH_REDIRECT, true);
        await bridge.openExternal(url);
      },
      async signOut() {
        const s = stateRef.current;
        if (s.status !== 'signed-in') return;
        await s.sb.auth.signOut().catch(() => undefined);
        forgetAccount(s.slot);
        const next = storedAccounts()[0];
        if (next) setActiveSlot(next.slot);
        window.location.reload();
      },
      addAccount() {
        signedOut(null, true);
      },
      cancelAdd() {
        window.location.reload();
      },
      switchTo(slot) {
        if (!storedAccounts().some((a) => a.slot === slot)) return;
        setActiveSlot(slot);
        window.location.reload();
      },
      async refreshProfile() {
        const s = stateRef.current;
        if (s.status !== 'signed-in') return;
        const res = await s.sb.from('profiles').select('*').eq('id', s.user.id).single();
        if (res.data) {
          setState({ ...s, profile: res.data });
          saveAccount({ slot: s.slot, userId: s.user.id, email: s.user.email ?? '', username: res.data.username, avatarUrl: res.data.avatar_url });
          setAccounts(storedAccounts());
        }
      },
    }),
    [state, accounts, finish, signedOut],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('SessionProvider eksik');
  return v;
}

/** Yalnızca oturum açıkken çizilen bileşenler için. */
export function useAuthed() {
  const { state } = useSession();
  if (state.status !== 'signed-in') throw new Error('Oturum açık değil');
  return state;
}
