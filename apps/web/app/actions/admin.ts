'use server';

import { admin, deleteSong, ensureArtist, joinArtistNames, reviewArtistRequest, setSongArtists, setSongStatus, splitArtistNames, updateSong, type BekofyClient, type Role } from '@bekofy/core';
import { revalidatePath } from 'next/cache';
import { fail, failFrom, ok, type ActionResult } from '@/lib/action';
import { getR2 } from '@/lib/r2';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';

const ROLES: Role[] = ['user', 'premium', 'artist', 'admin', 'yetkili'];

/** Her işlemde yeniden denetlenir; veritabanı da RLS ile ayrıca denetler. */
async function adminContext() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin || viewer.profile?.is_banned) return fail('Bu işlem için admin yetkisi gerekir.');
  return { ok: true as const, viewer, sb: await createClient() };
}

/**
 * Şarkının R2 dosyalarını siler. Başka bir kayıt aynı dosyayı kullanıyorsa dokunmaz.
 * Dönen değer: silinemeyen dosya için kullanıcıya gösterilecek uyarı ya da null.
 */
async function removeSongFiles(sb: BekofyClient, song: { id: string; file_path: string; cover_url: string | null }): Promise<string | null> {
  const r2 = getR2();
  const urls = [song.file_path, song.cover_url].filter((u): u is string => Boolean(u));
  const owned = r2 ? urls.filter((u) => r2.keyOf(u)) : [];
  if (!owned.length) return null;
  if (!r2) return 'Kayıt güncellendi ama dosyalar R2’de kaldı: sitenin R2 ayarları eksik.';
  const problems: string[] = [];
  for (const url of owned) {
    const [asAudio, asCover] = await Promise.all([
      sb.from('songs').select('id', { count: 'exact', head: true }).neq('id', song.id).eq('file_path', url),
      sb.from('songs').select('id', { count: 'exact', head: true }).neq('id', song.id).eq('cover_url', url),
    ]);
    if (asAudio.error || asCover.error || asAudio.count || asCover.count) continue;
    try {
      await r2.remove(r2.keyOf(url)!);
    } catch (err) {
      console.error('R2 silme', url, err);
      problems.push(url);
    }
  }
  return problems.length ? 'Kayıt güncellendi ama bazı dosyalar R2’den silinemedi. Biraz sonra tekrar dene.' : null;
}

async function songFiles(sb: BekofyClient, id: string) {
  const res = await sb.from('songs').select('id, file_path, cover_url').eq('id', id).maybeSingle();
  return res.data;
}

export async function approveSong(id: string): Promise<ActionResult> {
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  try {
    await setSongStatus(ctx.sb, id, 'approved');
    revalidatePath('/admin', 'layout');
    return ok(null);
  } catch (err) {
    return failFrom(err, 'Şarkı onaylanamadı. Tekrar dene.');
  }
}

/** Ret: kayıt "rejected" kalır (sanatçı sonucu görür), R2'deki dosyalar silinir. */
export async function rejectSong(id: string): Promise<ActionResult<{ warning: string | null }>> {
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  try {
    const song = await songFiles(ctx.sb, id);
    if (!song) return fail('Şarkı bulunamadı. Sayfayı yenile.');
    await setSongStatus(ctx.sb, id, 'rejected');
    const warning = await removeSongFiles(ctx.sb, song);
    revalidatePath('/admin', 'layout');
    return ok({ warning });
  } catch (err) {
    return failFrom(err, 'Şarkı reddedilemedi. Tekrar dene.');
  }
}

export async function deleteSongAction(id: string): Promise<ActionResult<{ warning: string | null }>> {
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  try {
    const song = await songFiles(ctx.sb, id);
    if (!song) return fail('Şarkı bulunamadı. Sayfayı yenile.');
    await deleteSong(ctx.sb, id);
    const warning = await removeSongFiles(ctx.sb, song);
    revalidatePath('/admin', 'layout');
    return ok({ warning });
  } catch (err) {
    return failFrom(err, 'Şarkı silinemedi. Tekrar dene.');
  }
}

export async function saveSong(
  id: string,
  input: { title: string; artists: string; album: string; genre: string; lyrics: string; syncedLyrics: string },
): Promise<ActionResult> {
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  const title = input.title.trim();
  const names = splitArtistNames(input.artists);
  if (!title || title.length > 200) return fail('Şarkı adı 1 ile 200 karakter arasında olmalı.');
  if (!names.length || names.length > 5 || names.some((n) => n.length > 80)) return fail('1 ile 5 arasında sanatçı yaz; her biri en fazla 80 karakter.');
  try {
    const artists = await Promise.all(names.map((n) => ensureArtist(ctx.sb, n)));
    await updateSong(ctx.sb, id, {
      title,
      artist: joinArtistNames(names),
      album: input.album.trim() || null,
      genre: input.genre.trim() || null,
      lyrics: input.lyrics.trim() || null,
      synced_lyrics: input.syncedLyrics.trim() || null,
    });
    await setSongArtists(ctx.sb, id, artists.map((a) => a.id));
    revalidatePath('/admin', 'layout');
    return ok(null);
  } catch (err) {
    return failFrom(err, 'Şarkı kaydedilemedi. Tekrar dene.');
  }
}

/** Kullanıcı ayarları. Admin kendi rolünü düşüremez ve kendini askıya alamaz (panele kilitlenmesin). */
export async function updateUser(userId: string, change: { role?: string; premium?: boolean; banned?: boolean }): Promise<ActionResult> {
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  const self = userId === ctx.viewer.user.id;
  if (self && (change.banned || (change.role && change.role !== ctx.viewer.profile?.role))) return fail('Kendi rolünü değiştiremez, kendini askıya alamazsın.');
  try {
    if (change.role !== undefined) {
      if (!ROLES.includes(change.role as Role)) return fail('Geçersiz rol.');
      await admin.setRole(ctx.sb, userId, change.role as Role);
    }
    if (change.premium !== undefined) await admin.setPremium(ctx.sb, userId, change.premium);
    if (change.banned !== undefined) await admin.setBanned(ctx.sb, userId, change.banned);
    revalidatePath('/admin/users');
    return ok(null);
  } catch (err) {
    return failFrom(err, 'Kullanıcı güncellenemedi. Tekrar dene.');
  }
}

export async function reviewRequest(requestId: string, approve: boolean): Promise<ActionResult> {
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  try {
    await reviewArtistRequest(ctx.sb, requestId, approve);
    revalidatePath('/admin', 'layout');
    return ok(null);
  } catch (err) {
    return failFrom(err, approve ? 'Başvuru onaylanamadı. Tekrar dene.' : 'Başvuru reddedilemedi. Tekrar dene.');
  }
}
