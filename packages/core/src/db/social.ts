// Takip (tek yönlü, onaysız) ve engelleme. Karşılıklı takip edenler arkadaş sayılır.

import type { BekofyClient } from '../client';
import { check, must } from './errors';

const PERSON = 'id, username, avatar_url, avatar_frame, role' as const;

export async function follow(sb: BekofyClient, followerId: string, targetId: string): Promise<void> {
  if (followerId === targetId) return;
  check(await sb.from('follows').upsert({ follower_id: followerId, following_id: targetId, status: 'accepted' }, { ignoreDuplicates: true }), 'Takip edilemedi');
}

export async function unfollow(sb: BekofyClient, followerId: string, targetId: string): Promise<void> {
  check(await sb.from('follows').delete().eq('follower_id', followerId).eq('following_id', targetId), 'Takip bırakılamadı');
}

export async function isFollowing(sb: BekofyClient, followerId: string, targetId: string): Promise<boolean> {
  const res = await sb.from('follows').select('follower_id').eq('follower_id', followerId).eq('following_id', targetId).limit(1);
  return must(res, 'Takip durumu alınamadı').length > 0;
}

export async function followCounts(sb: BekofyClient, userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    sb.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
    sb.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  check(followers, 'Takipçi sayısı alınamadı');
  check(following, 'Takip sayısı alınamadı');
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function followers(sb: BekofyClient, userId: string) {
  const rows = must(
    await sb.from('follows').select(`created_at, person:profiles!follows_follower_id_fkey(${PERSON})`).eq('following_id', userId).order('created_at', { ascending: false }),
    'Takipçiler alınamadı',
  );
  return rows.flatMap((r) => (r.person ? [r.person] : []));
}

export async function following(sb: BekofyClient, userId: string) {
  const rows = must(
    await sb.from('follows').select(`created_at, person:profiles!follows_following_id_fkey(${PERSON})`).eq('follower_id', userId).order('created_at', { ascending: false }),
    'Takip edilenler alınamadı',
  );
  return rows.flatMap((r) => (r.person ? [r.person] : []));
}

/** Karşılıklı takip edilen kullanıcıların kimlikleri (arkadaş etkinliği için). */
export async function friendIds(sb: BekofyClient, userId: string): Promise<string[]> {
  const [out, inc] = await Promise.all([
    sb.from('follows').select('following_id').eq('follower_id', userId),
    sb.from('follows').select('follower_id').eq('following_id', userId),
  ]);
  const followersSet = new Set(must(inc, 'Arkadaşlar alınamadı').map((r) => r.follower_id));
  return must(out, 'Arkadaşlar alınamadı').map((r) => r.following_id).filter((id) => followersSet.has(id));
}

export async function blockUser(sb: BekofyClient, userId: string, blockedId: string): Promise<void> {
  check(await sb.from('blocked_users').insert({ user_id: userId, blocked_id: blockedId }), 'Kullanıcı engellenemedi');
  await unfollow(sb, userId, blockedId);
  await unfollow(sb, blockedId, userId).catch(() => undefined);
}

export async function unblockUser(sb: BekofyClient, userId: string, blockedId: string): Promise<void> {
  check(await sb.from('blocked_users').delete().eq('user_id', userId).eq('blocked_id', blockedId), 'Engel kaldırılamadı');
}

export async function blockedIds(sb: BekofyClient, userId: string): Promise<Set<string>> {
  const rows = must(await sb.from('blocked_users').select('blocked_id').eq('user_id', userId), 'Engellenenler alınamadı');
  return new Set(rows.flatMap((r) => (r.blocked_id ? [r.blocked_id] : [])));
}
