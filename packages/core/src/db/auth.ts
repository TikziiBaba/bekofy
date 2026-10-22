// Kimlik doğrulama: kayıt, giriş, sosyal giriş, şifre sıfırlama. Hatalar Türkçe mesajlara çevrilir.

import type { Session } from '@supabase/supabase-js';
import type { BekofyClient } from '../client';
import { DataError } from './errors';
import { checkUsername, getProfile, normalizeUsername, USERNAME_MESSAGES, type Profile } from './profiles';

const AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-posta ya da şifre yanlış.'],
  [/email not confirmed/i, 'E-postanı henüz doğrulamadın. Gelen kutundaki bağlantıya tıkla.'],
  [/user already registered/i, 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı dene.'],
  [/password should be at least|weak password/i, 'Şifre en az 8 karakter olmalı. Harf ve rakam karıştır.'],
  [/rate limit|too many requests/i, 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.'],
  [/fetch|network/i, 'Sunucuya ulaşılamadı. İnternetini kontrol et.'],
];

function authError(error: { message?: string; status?: number; name?: string }, fallback: string): DataError {
  const hit = AUTH_MESSAGES.find(([re]) => re.test(error.message ?? ''));
  return new DataError(hit ? hit[1] : fallback, error.name, error);
}

const isTransient = (e: { status?: number; name?: string } | null) =>
  !!e && (e.name === 'AuthRetryableFetchError' || e.status === 502 || e.status === 503 || e.status === 504);

/** Geçici sunucu hatalarında (502/503/504) artan bekleme ile en çok 3 kez dener. */
async function withRetry<T extends { error: { status?: number; name?: string } | null }>(run: () => Promise<T>, wait = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<T> {
  let res = await run();
  for (let attempt = 1; attempt < 3 && isTransient(res.error); attempt++) {
    await wait(1500 * attempt);
    res = await run();
  }
  return res;
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Yeni hesap. Kullanıcı adı önce denetlenir. E-posta doğrulaması açıksa oturum hemen açılmaz;
 * bu durumda needsConfirmation true döner ve profil, doğrulamadan sonra ilk girişte oluşturulur.
 */
export async function signUp(
  sb: BekofyClient,
  { email, password, username, redirectTo }: { email: string; password: string; username: string; redirectTo?: string },
): Promise<{ needsConfirmation: boolean }> {
  const name = normalizeUsername(username);
  const problem = await checkUsername(sb, name);
  if (problem) throw new DataError(USERNAME_MESSAGES[problem]);
  if (password.length < MIN_PASSWORD_LENGTH) throw new DataError('Şifre en az 8 karakter olmalı. Harf ve rakam karıştır.');

  const res = await withRetry(() => sb.auth.signUp({ email: email.trim(), password, options: { data: { username: name }, emailRedirectTo: redirectTo } }));
  if (res.error) throw authError(res.error, 'Hesap oluşturulamadı. Tekrar dene.');
  // E-posta zaten kayıtlıysa Supabase, bilgi sızdırmamak için boş kimlikli sahte başarı döndürür.
  if (res.data.user && res.data.user.identities?.length === 0) throw new DataError('Bu e-posta adresi zaten kayıtlı. Giriş yapmayı dene.');
  if (res.data.session) await ensureProfile(sb, res.data.session);
  return { needsConfirmation: !res.data.session };
}

/** Oturumun profil satırı yoksa oluşturur (kullanıcı adı kayıt sırasında meta veriye yazılmıştı). */
export async function ensureProfile(sb: BekofyClient, session: Session): Promise<void> {
  const username = typeof session.user.user_metadata?.username === 'string' ? session.user.user_metadata.username : null;
  const res = await sb.from('profiles').upsert({ id: session.user.id, username }, { onConflict: 'id', ignoreDuplicates: true });
  if (res.error) throw new DataError('Profil oluşturulamadı. Tekrar giriş yap.', res.error.code, res.error);
}

/** E-posta ile giriş. Hesap askıya alınmışsa oturum kapatılır ve hata fırlatılır. */
export async function signIn(sb: BekofyClient, email: string, password: string): Promise<{ session: Session; profile: Profile }> {
  const res = await withRetry(() => sb.auth.signInWithPassword({ email: email.trim(), password }));
  if (res.error || !res.data.session) throw authError(res.error ?? {}, 'Giriş yapılamadı. Tekrar dene.');
  return afterSignIn(sb, res.data.session);
}

/** Her girişten sonra: profil varlığı ve askı kontrolü. Sosyal girişte de çağrılmalı. */
export async function afterSignIn(sb: BekofyClient, session: Session): Promise<{ session: Session; profile: Profile }> {
  await ensureProfile(sb, session);
  const profile = await getProfile(sb, session.user.id);
  if (profile.is_banned) {
    await sb.auth.signOut();
    throw new DataError('Hesabın askıya alındı. Destek için bizimle iletişime geç.');
  }
  return { session, profile };
}

/**
 * Google ya da Apple ile giriş. Masaüstü ve mobilde skipBrowserRedirect true verilir;
 * dönen adres sistem tarayıcısında açılır, dönüşte gelen kod exchangeCodeForSession ile oturuma çevrilir.
 */
export async function signInWithProvider(sb: BekofyClient, provider: 'google' | 'apple', redirectTo: string, skipBrowserRedirect = false): Promise<string> {
  const res = await sb.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect } });
  if (res.error || !res.data.url) throw authError(res.error ?? {}, 'Giriş sayfası açılamadı. Tekrar dene.');
  return res.data.url;
}

export async function signOut(sb: BekofyClient): Promise<void> {
  const res = await sb.auth.signOut();
  if (res.error) throw authError(res.error, 'Çıkış yapılamadı.');
}

export async function currentSession(sb: BekofyClient): Promise<Session | null> {
  const res = await sb.auth.getSession();
  return res.data.session;
}

export async function requestPasswordReset(sb: BekofyClient, email: string, redirectTo: string): Promise<void> {
  const res = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (res.error) throw authError(res.error, 'Sıfırlama e-postası gönderilemedi. Tekrar dene.');
}

export async function updatePassword(sb: BekofyClient, password: string): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new DataError('Şifre en az 8 karakter olmalı. Harf ve rakam karıştır.');
  const res = await sb.auth.updateUser({ password });
  if (res.error) throw authError(res.error, 'Şifre değiştirilemedi. Tekrar dene.');
}
