// İsteği yapanın admin olduğunu doğrular. Oturum anahtarı Supabase Auth'a sorulur (imza ve süre sunucuda denetlenir);
// sonra profil rolüne bakılır. Sonraki veritabanı işlemleri bu kullanıcının yetkisiyle (RLS) yapılır.

import { createBekofyClient, isAdmin, type BekofyClient } from '@bekofy/core';
import { HttpError } from './errors';

export interface AdminSession {
  userId: string;
  username: string | null;
  sb: BekofyClient;
}

export type VerifyAdmin = (token: string) => Promise<AdminSession>;

/** "Authorization: Bearer <anahtar>" başlığından anahtarı alır. */
export function bearerToken(header: string | undefined): string {
  const m = header?.match(/^Bearer\s+([A-Za-z0-9._-]{20,})$/);
  if (!m?.[1]) throw new HttpError(401, 'Oturum bilgisi yok. Admin panelinde giriş yapıp tekrar dene.');
  return m[1];
}

export const verifyAdmin: VerifyAdmin = async (token) => {
  const sb = createBekofyClient({ accessToken: token });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Oturumun geçersiz ya da süresi dolmuş. Admin panelinde yeniden giriş yap.');
  const profile = await sb.from('profiles').select('role, is_banned, username').eq('id', data.user.id).maybeSingle();
  if (profile.error) throw new HttpError(502, 'Yetki denetlenemedi. Biraz sonra tekrar dene.');
  if (!profile.data || profile.data.is_banned || !isAdmin(profile.data)) throw new HttpError(403, 'Bu işlem yalnızca admin içindir.');
  return { userId: data.user.id, username: profile.data.username, sb };
};
