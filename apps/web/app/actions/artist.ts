'use server';

import { artistRequestProblem, artistSongProblem, audioProblem, imageProblem, managedArtist, MAX_AUDIO_BYTES, submitArtistRequest, submitArtistSong } from '@bekofy/core';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { fail, failFrom, ok, type ActionResult } from '@/lib/action';
import { ownsKey, uploadKeys } from '@/lib/artist-upload';
import { CACHE_CONTROL, getR2 } from '@/lib/r2';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';

export interface SignedUpload {
  url: string;
  key: string;
  headers: Record<string, string>;
}

/** Oturumdaki kullanıcının yönettiği sanatçı; değilse kullanıcıya gösterilecek hata. */
async function artistContext() {
  const viewer = await getViewer();
  if (!viewer || viewer.profile?.is_banned) return fail('Bu işlem için giriş yapmalısın.');
  const sb = await createClient();
  const artist = await managedArtist(sb, viewer.user.id);
  if (!artist) return fail('Şarkı yüklemek için onaylanmış bir sanatçı hesabı gerekir.');
  return { ok: true as const, sb, viewer, artist };
}

export async function applyAsArtist(input: { artistName: string; message: string; links: string[] }): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail('Başvurmak için giriş yapmalısın.');
  const problem = artistRequestProblem(input);
  if (problem) return fail(problem);
  try {
    await submitArtistRequest(await createClient(), viewer.user.id, input);
    revalidatePath('/artist');
    return ok(null);
  } catch (err) {
    return failFrom(err, 'Başvuru gönderilemedi. Tekrar dene.');
  }
}

/** 1. adım: dosyalar için imzalı R2 adresleri. Dosyanın kendisi sunucudan geçmez, tarayıcıdan doğrudan R2'ye gider. */
export async function prepareArtistUpload(input: {
  title: string;
  audio: { type: string; size: number; name: string };
  cover: { type: string; size: number } | null;
}): Promise<ActionResult<{ audio: SignedUpload; cover: SignedUpload | null }>> {
  const ctx = await artistContext();
  if (!ctx.ok) return ctx;
  const r2 = getR2();
  if (!r2) return fail('Yükleme şu an kapalı. Lütfen daha sonra tekrar dene.');
  if (!input.title.trim()) return fail('Şarkı adını yaz.');
  const problem = audioProblem(input.audio) ?? (input.cover ? imageProblem(input.cover) : null);
  if (problem) return fail(problem);

  try {
    const { audioKey, coverKey } = uploadKeys(ctx.artist.name, input.title, randomUUID(), input.cover?.type ?? null);
    const [audioUrl, coverUrl] = await Promise.all([
      r2.presignPut(audioKey, 'audio/mpeg', input.audio.size),
      coverKey && input.cover ? r2.presignPut(coverKey, input.cover.type, input.cover.size) : Promise.resolve(null),
    ]);
    return ok({
      audio: { url: audioUrl, key: audioKey, headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': CACHE_CONTROL } },
      cover: coverUrl && coverKey && input.cover ? { url: coverUrl, key: coverKey, headers: { 'Content-Type': input.cover.type, 'Cache-Control': CACHE_CONTROL } } : null,
    });
  } catch (err) {
    return failFrom(err, 'Yükleme hazırlanamadı. Tekrar dene.');
  }
}

/** 2. adım: dosyalar R2'de mi, doğru türde ve boyutta mı? Sonra kayıt açılır (onay bekler). Hata olursa dosyalar silinir. */
export async function finishArtistUpload(input: {
  title: string;
  album: string;
  genre: string;
  duration: number;
  audioKey: string;
  coverKey: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await artistContext();
  if (!ctx.ok) return ctx;
  const r2 = getR2();
  if (!r2) return fail('Yükleme şu an kapalı. Lütfen daha sonra tekrar dene.');
  if (!ownsKey(ctx.artist.name, input.audioKey, 'audio') || (input.coverKey && !ownsKey(ctx.artist.name, input.coverKey, 'cover'))) {
    return fail('Dosya adresi geçersiz. Sayfayı yenileyip tekrar yükle.');
  }
  const keys = [input.audioKey, input.coverKey].filter((k): k is string => Boolean(k));
  const cleanup = () => Promise.allSettled(keys.map((k) => r2.remove(k)));

  const problem = artistSongProblem(input);
  if (problem) {
    await cleanup();
    return fail(problem);
  }
  try {
    const audio = await r2.head(input.audioKey);
    if (!audio || audio.type !== 'audio/mpeg' || !audio.size || audio.size > MAX_AUDIO_BYTES) {
      await cleanup();
      return fail('Ses dosyası yüklenemedi. Tekrar dene.');
    }
    if (input.coverKey) {
      const cover = await r2.head(input.coverKey);
      if (!cover || !cover.type?.startsWith('image/')) {
        await cleanup();
        return fail('Kapak görseli yüklenemedi. Tekrar dene.');
      }
    }
    const id = await submitArtistSong(ctx.sb, {
      title: input.title,
      album: input.album,
      genre: input.genre,
      duration: input.duration,
      filePath: r2.publicUrl(input.audioKey),
      coverUrl: input.coverKey ? r2.publicUrl(input.coverKey) : null,
    });
    revalidatePath('/artist');
    return ok({ id });
  } catch (err) {
    await cleanup();
    return failFrom(err, 'Şarkı gönderilemedi. Tekrar dene.');
  }
}

/** Tarayıcıdaki yükleme yarıda kaldıysa R2'ye inmiş parçaları siler (yalnızca sanatçının kendi klasöründe). */
export async function discardArtistUpload(keys: { audioKey: string; coverKey: string | null }): Promise<ActionResult> {
  const ctx = await artistContext();
  if (!ctx.ok) return ctx;
  const r2 = getR2();
  if (!r2) return ok(null);
  const list = [
    ownsKey(ctx.artist.name, keys.audioKey, 'audio') ? keys.audioKey : null,
    keys.coverKey && ownsKey(ctx.artist.name, keys.coverKey, 'cover') ? keys.coverKey : null,
  ].filter((k): k is string => Boolean(k));
  // Bir kayda bağlanmış dosya silinmez.
  const used = await ctx.sb.from('songs').select('id', { count: 'exact', head: true }).in('file_path', list.map((k) => r2.publicUrl(k)));
  if (used.count) return ok(null);
  await Promise.allSettled(list.map((k) => r2.remove(k)));
  return ok(null);
}
