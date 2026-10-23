// Sanatçı başvuruları: kullanıcı başvurur; admin onaylar ya da reddeder (tek işlemde, review_artist_request).

import type { BekofyClient } from '../client';
import type { Tables } from './database.types';
import { check, DataError, must } from './errors';

export type ArtistRequest = Tables<'artist_requests'>;

export interface ArtistRequestInput {
  artistName: string;
  message?: string;
  links?: string[];
}

/** Gönderilmeden önce: sorun varsa kullanıcıya gösterilecek mesaj, yoksa null. */
export function artistRequestProblem({ artistName, message = '', links = [] }: ArtistRequestInput): string | null {
  const name = artistName.trim();
  if (!name) return 'Sanatçı adını yaz.';
  if (name.length > 80) return 'Sanatçı adı en fazla 80 karakter olabilir.';
  if (message.length > 1000) return 'Mesaj en fazla 1000 karakter olabilir.';
  if (links.length > 5) return 'En fazla 5 bağlantı ekleyebilirsin.';
  if (links.some((l) => !/^https:\/\/[^\s]+\.[^\s]+$/i.test(l.trim()))) return 'Bağlantılar https:// ile başlamalı.';
  return null;
}

export async function submitArtistRequest(sb: BekofyClient, userId: string, input: ArtistRequestInput): Promise<ArtistRequest> {
  const problem = artistRequestProblem(input);
  if (problem) throw new DataError(problem);
  const res = await sb.from('artist_requests')
    .insert({ user_id: userId, artist_name: input.artistName.trim(), message: input.message?.trim() || null, links: (input.links ?? []).map((l) => l.trim()) })
    .select('*').single();
  if (res.error?.code === '23505') throw new DataError('Zaten bekleyen bir başvurun var. Sonucu bildireceğiz.');
  return must(res, 'Başvuru gönderilemedi');
}

export async function myArtistRequests(sb: BekofyClient, userId: string): Promise<ArtistRequest[]> {
  return must(await sb.from('artist_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }), 'Başvuruların alınamadı');
}

/** Admin: değerlendirilmeyi bekleyen başvurular, başvuranın profiliyle. */
export async function pendingArtistRequests(sb: BekofyClient) {
  return must(
    await sb.from('artist_requests').select('*, applicant:profiles!artist_requests_user_id_fkey(id, username, avatar_url)').eq('status', 'pending').order('created_at'),
    'Başvurular alınamadı',
  );
}

/** Admin: onay başvuruyu, profil rolünü ve sanatçı kaydını birlikte günceller. */
export async function reviewArtistRequest(sb: BekofyClient, requestId: string, approve: boolean): Promise<void> {
  check(await sb.rpc('review_artist_request', { p_request_id: requestId, p_approve: approve }), approve ? 'Başvuru onaylanamadı' : 'Başvuru reddedilemedi');
}
