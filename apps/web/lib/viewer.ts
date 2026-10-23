import 'server-only';
import { isAdmin, isPremium, type Profile } from '@bekofy/core';
import type { User } from '@supabase/supabase-js';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from './supabase/server';

export interface Viewer {
  user: User;
  /** İlk Google girişinde profil henüz yoksa null olabilir; /auth/callback oluşturur. */
  profile: Profile | null;
  isAdmin: boolean;
  isPremium: boolean;
}

/** İstek başına bir kez: oturumdaki kullanıcı ve profili. Kimlik Supabase'e sorularak doğrulanır. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  let profile = (await sb.from('profiles').select('*').eq('id', data.user.id).maybeSingle()).data;
  if (!profile) {
    // Profil satırı yoksa (eski hesaplar, yarıda kalan kayıt) oluşturulur; kullanıcı adı kayıt meta verisinden gelir.
    const username = typeof data.user.user_metadata?.username === 'string' ? data.user.user_metadata.username : null;
    await sb.from('profiles').upsert({ id: data.user.id, username }, { onConflict: 'id', ignoreDuplicates: true });
    profile = (await sb.from('profiles').select('*').eq('id', data.user.id).maybeSingle()).data;
  }
  return {
    user: data.user,
    profile,
    isAdmin: profile ? isAdmin(profile) : false,
    isPremium: profile ? isPremium(profile) : false,
  };
});

/** Giriş gerektiren sayfalar: oturum yoksa giriş sayfasına, sonra geri. */
export async function requireViewer(path: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(path)}`);
  return viewer;
}

/** Admin sayfaları: admin değilse sayfa yokmuş gibi davranılır. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=%2Fadmin');
  if (!viewer.isAdmin || viewer.profile?.is_banned) notFound();
  return viewer;
}
