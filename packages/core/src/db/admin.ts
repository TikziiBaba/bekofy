// Admin işlemleri. Yetki veritabanında RLS ile denetlenir; buradaki fonksiyonlar yalnızca istemci tarafı.
// Kullanıcı hesabını tamamen silmek service_role gerektirir, istemciden yapılamaz.

import type { BekofyClient } from '../client';
import { check, must, searchTerm } from './errors';
import { PUBLIC_PROFILE_FIELDS, type Role } from './profiles';

export async function dashboardStats(sb: BekofyClient) {
  const count = async (q: PromiseLike<{ count: number | null; error: { code?: string; message?: string } | null }>, what: string) => {
    const res = await q;
    check(res, what);
    return res.count ?? 0;
  };
  const [songs, pendingSongs, users, playlists, jams] = await Promise.all([
    count(sb.from('songs').select('id', { count: 'exact', head: true }).eq('status', 'approved'), 'Şarkı sayısı alınamadı'),
    count(sb.from('songs').select('id', { count: 'exact', head: true }).eq('status', 'pending'), 'Bekleyen şarkılar alınamadı'),
    count(sb.from('profiles').select('id', { count: 'exact', head: true }), 'Kullanıcı sayısı alınamadı'),
    count(sb.from('playlists').select('id', { count: 'exact', head: true }), 'Çalma listesi sayısı alınamadı'),
    count(sb.from('jam_sessions').select('id', { count: 'exact', head: true }), 'Jam sayısı alınamadı'),
  ]);
  return { songs, pendingSongs, users, playlists, jams };
}

export async function listUsers(sb: BekofyClient, { search = '', limit = 50, offset = 0 } = {}) {
  let q = sb.from('profiles').select(`${PUBLIC_PROFILE_FIELDS}, is_banned, last_activity`).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  const term = searchTerm(search);
  if (term) q = q.ilike('username', `%${term}%`);
  return must(await q, 'Kullanıcılar alınamadı');
}

export async function setRole(sb: BekofyClient, userId: string, role: Role): Promise<void> {
  check(await sb.from('profiles').update({ role }).eq('id', userId), 'Rol değiştirilemedi');
}

export async function setBanned(sb: BekofyClient, userId: string, banned: boolean): Promise<void> {
  check(await sb.from('profiles').update({ is_banned: banned }).eq('id', userId), banned ? 'Kullanıcı askıya alınamadı' : 'Askı kaldırılamadı');
}

export async function setPremium(sb: BekofyClient, userId: string, premium: boolean): Promise<void> {
  check(await sb.from('profiles').update({ is_premium: premium }).eq('id', userId), 'Premium durumu değiştirilemedi');
}

export async function reservedUsernames(sb: BekofyClient) {
  return must(await sb.from('reserved_usernames').select('*').order('username'), 'Ayrılmış adlar alınamadı');
}

export async function reserveUsername(sb: BekofyClient, username: string, addedBy: string): Promise<void> {
  check(await sb.from('reserved_usernames').insert({ username: username.trim().toLocaleLowerCase('tr-TR'), added_by: addedBy }), 'Ad ayrılamadı');
}

export async function releaseUsername(sb: BekofyClient, id: string): Promise<void> {
  check(await sb.from('reserved_usernames').delete().eq('id', id), 'Ayrılmış ad kaldırılamadı');
}
