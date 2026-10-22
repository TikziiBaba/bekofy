// Profiller: okuma, güncelleme, kullanıcı adı kuralları, roller.

import type { BekofyClient } from '../client';
import type { Tables, TablesUpdate } from './database.types';
import { likeExact, must, searchTerm } from './errors';

export type Profile = Tables<'profiles'>;
export type Role = 'user' | 'premium' | 'artist' | 'admin' | 'yetkili';

/** Herkese gösterilebilir alanlar (başka kullanıcıların profilleri için). */
export const PUBLIC_PROFILE_FIELDS = 'id, username, avatar_url, avatar_frame, banner_url, banner_position, bio, bio_format, role, is_premium, city, website, social_links, favorite_genres, created_at' as const;
export type PublicProfile = Pick<Profile, 'id' | 'username' | 'avatar_url' | 'avatar_frame' | 'banner_url' | 'banner_position' | 'bio' | 'bio_format' | 'role' | 'is_premium' | 'city' | 'website' | 'social_links' | 'favorite_genres' | 'created_at'>;

/** Kullanıcının kendisinin değiştirebileceği alanlar. Rol, premium ve yasak bilgisi buraya girmez. */
export type ProfilePatch = Pick<TablesUpdate<'profiles'>, 'username' | 'avatar_url' | 'avatar_frame' | 'banner_url' | 'banner_position' | 'bio' | 'bio_format' | 'city' | 'website' | 'social_links' | 'favorite_genres' | 'theme' | 'theme_preference'>;

export const isAdmin = (p: Pick<Profile, 'role'>): boolean => p.role === 'admin' || p.role === 'yetkili';
/** Premium iki yerde tutuluyor (role ve is_premium); ikisinden biri yeterli. Adminler de premium sayılır. */
export const isPremium = (p: Pick<Profile, 'role' | 'is_premium'>): boolean => p.is_premium || p.role === 'premium' || isAdmin(p);

export async function getProfile(sb: BekofyClient, id: string): Promise<Profile> {
  return must(await sb.from('profiles').select('*').eq('id', id).single(), 'Profil alınamadı');
}

export async function getPublicProfile(sb: BekofyClient, id: string): Promise<PublicProfile> {
  return must(await sb.from('profiles').select(PUBLIC_PROFILE_FIELDS).eq('id', id).single(), 'Profil alınamadı');
}

export async function getProfileByUsername(sb: BekofyClient, username: string): Promise<PublicProfile | null> {
  const res = await sb.from('profiles').select(PUBLIC_PROFILE_FIELDS).ilike('username', likeExact(normalizeUsername(username))).maybeSingle();
  if (res.error) must(res, 'Profil alınamadı');
  return res.data;
}

export async function updateProfile(sb: BekofyClient, id: string, patch: ProfilePatch): Promise<Profile> {
  const clean = patch.username !== undefined && patch.username !== null ? { ...patch, username: normalizeUsername(patch.username) } : patch;
  return must(await sb.from('profiles').update(clean).eq('id', id).select('*').single(), 'Profil güncellenemedi');
}

export async function searchProfiles(sb: BekofyClient, query: string, { excludeId, limit = 20 }: { excludeId?: string; limit?: number } = {}): Promise<PublicProfile[]> {
  const term = searchTerm(query);
  if (!term) return [];
  let q = sb.from('profiles').select(PUBLIC_PROFILE_FIELDS).eq('is_banned', false).ilike('username', `%${term}%`).limit(limit);
  if (excludeId) q = q.neq('id', excludeId);
  return must(await q, 'Kullanıcılar aranamadı');
}

/* ---------- Kullanıcı adı ---------- */

export const USERNAME_RULE = /^[a-z0-9._]{3,24}$/;

/** Küçük harf, boşluksuz. Türkçe büyük I doğru küçülür. */
export function normalizeUsername(input: string): string {
  return input.trim().toLocaleLowerCase('tr-TR');
}

export type UsernameProblem = 'format' | 'taken' | 'reserved';
export const USERNAME_MESSAGES: Record<UsernameProblem, string> = {
  format: 'Kullanıcı adı 3-24 karakter olmalı; yalnızca küçük harf, rakam, nokta ve alt çizgi kullanılabilir.',
  taken: 'Bu kullanıcı adı alınmış. Başka bir tane dene.',
  reserved: 'Bu kullanıcı adı kullanılamaz. Başka bir tane dene.',
};

/** Kullanılabilirse null, değilse sorunun türü. */
export async function checkUsername(sb: BekofyClient, input: string, currentUserId?: string): Promise<UsernameProblem | null> {
  const username = normalizeUsername(input);
  if (!USERNAME_RULE.test(username)) return 'format';
  const [reserved, taken] = await Promise.all([
    sb.from('reserved_usernames').select('id').ilike('username', likeExact(username)).limit(1),
    sb.from('profiles').select('id').ilike('username', likeExact(username)).limit(1),
  ]);
  if (must(reserved, 'Kullanıcı adı denetlenemedi').length) return 'reserved';
  const owner = must(taken, 'Kullanıcı adı denetlenemedi')[0];
  return owner && owner.id !== currentUserId ? 'taken' : null;
}
