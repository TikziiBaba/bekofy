// Önizleme ve içe aktarma akışı. Hata olursa R2'ye yüklenenler ve eklenen kayıt geri alınır; geçici dosyalar her durumda silinir.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createSong, DataError, deleteSong, ensureArtist, joinArtistNames, parseYouTubeLink, parseYouTubeTitle, setSongArtists,
  slugify, songAudioPath, songCoverPath, splitArtistNames, YOUTUBE_LINK_MESSAGES,
} from '@bekofy/core';
import type { AdminSession } from './auth';
import { HttpError } from './errors';
import { decodeImageDataUrl, squareCover } from './media';
import type { Storage } from './r2';
import { downloadAudio, probe as probeVideo, videoProblem, type DownloadEvent, type VideoInfo } from './ytdlp';

/* ---------- Önizleme ---------- */

export interface PreviewResult {
  videoId: string;
  url: string;
  rawTitle: string;
  channel: string;
  duration: number;
  thumbnail: string | null;
  /** Admin panelinde düzenlenebilir öneri. */
  suggestion: { title: string; artists: string[]; album: string | null };
  /** Bu video daha önce eklendiyse. */
  existing: { id: string; title: string } | null;
  /** Eklenemiyorsa nedeni (canlı yayın, çok uzun). */
  problem: string | null;
}

export interface PreviewDeps {
  ytDlpPath: string;
  probe?: (bin: string, url: string) => Promise<VideoInfo>;
}

function link(url: string) {
  const parsed = parseYouTubeLink(url);
  if (!parsed.ok) throw new HttpError(400, YOUTUBE_LINK_MESSAGES[parsed.reason]);
  return parsed;
}

/** Ses dosyası yolunun sonu video kimliğinden türer; aynı videonun ikinci kez eklenmesi buradan anlaşılır. */
async function findExisting(session: AdminSession, videoId: string): Promise<{ id: string; title: string } | null> {
  const suffix = `-${slugify(videoId, { maxLength: 24, fallback: 'x' })}.mp3`;
  const res = await session.sb.from('songs').select('id, title').ilike('file_path', `%${suffix}`).limit(1);
  if (res.error) throw new HttpError(502, 'Kütüphane denetlenemedi. Biraz sonra tekrar dene.');
  return res.data[0] ?? null;
}

export function suggestionFor(info: VideoInfo): PreviewResult['suggestion'] {
  if (info.track && info.artist) return { title: info.track, artists: splitArtistNames(info.artist), album: info.album };
  const parsed = parseYouTubeTitle(info.title, info.channel);
  return { title: parsed.title, artists: parsed.artist ? splitArtistNames(parsed.artist) : [], album: info.album };
}

export async function preview(url: string, session: AdminSession, deps: PreviewDeps): Promise<PreviewResult> {
  const yt = link(url);
  const [info, existing] = await Promise.all([(deps.probe ?? probeVideo)(deps.ytDlpPath, yt.url), findExisting(session, yt.videoId)]);
  return {
    videoId: yt.videoId,
    url: yt.url,
    rawTitle: info.title,
    channel: info.channel,
    duration: info.duration,
    thumbnail: info.thumbnail,
    suggestion: suggestionFor(info),
    existing,
    problem: videoProblem(info),
  };
}

/* ---------- İçe aktarma isteği ---------- */

export interface ImportRequest {
  url: string;
  title: string;
  artists: string[];
  album: string | null;
  cover: { kind: 'youtube' } | { kind: 'upload'; dataUrl: string };
}

const text = (v: unknown, max: number, field: string, required = true): string | null => {
  if (v === null || v === undefined || v === '') {
    if (required) throw new HttpError(400, `${field} boş olamaz.`);
    return null;
  }
  if (typeof v !== 'string') throw new HttpError(400, `${field} metin olmalı.`);
  const t = v.trim();
  if (required && !t) throw new HttpError(400, `${field} boş olamaz.`);
  if (t.length > max) throw new HttpError(400, `${field} en fazla ${max} karakter olabilir.`);
  return t || null;
};

/** Panelden gelen gövdeyi doğrular; sorun varsa 400 ve Türkçe açıklama. */
export function parseImportRequest(body: unknown): ImportRequest {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'İstek gövdesi okunamadı.');
  const b = body as Record<string, unknown>;
  const url = link(String(b.url ?? '')).url;
  const title = text(b.title, 200, 'Şarkı adı') as string;
  if (!Array.isArray(b.artists) || !b.artists.length) throw new HttpError(400, 'En az bir sanatçı yaz.');
  if (b.artists.length > 5) throw new HttpError(400, 'En fazla 5 sanatçı eklenebilir.');
  const artists = b.artists.map((a) => text(a, 80, 'Sanatçı adı') as string);
  const album = text(b.album, 200, 'Albüm adı', false);
  const c = b.cover as Record<string, unknown> | undefined;
  let cover: ImportRequest['cover'] = { kind: 'youtube' };
  if (c?.kind === 'upload') {
    if (typeof c.dataUrl !== 'string') throw new HttpError(400, 'Kapak görseli okunamadı.');
    cover = { kind: 'upload', dataUrl: c.dataUrl };
  } else if (c && c.kind !== 'youtube') throw new HttpError(400, 'Kapak seçimi geçersiz.');
  return { url, title, artists, album, cover };
}

/* ---------- İçe aktarma ---------- */

export type Stage = 'download' | 'convert' | 'cover' | 'upload' | 'save';
export type ImportEvent =
  | { type: 'progress'; stage: Stage; percent: number }
  | { type: 'done'; song: { id: string; title: string; artist: string; album: string | null; duration: number | null; cover_url: string | null; file_path: string } }
  | { type: 'error'; message: string };

/** Aşamanın genel yüzdedeki aralığı. */
export const STAGE_RANGE: Record<Stage, [number, number]> = {
  download: [0, 60],
  convert: [60, 70],
  cover: [70, 75],
  upload: [75, 95],
  save: [95, 100],
};

export function overallPercent(stage: Stage, ratio: number): number {
  const [from, to] = STAGE_RANGE[stage];
  return Math.round(from + (to - from) * Math.min(1, Math.max(0, ratio)));
}

export interface ImportDeps {
  ytDlpPath: string;
  ffmpegPath: string;
  storage: Storage;
  probe?: (bin: string, url: string) => Promise<VideoInfo>;
  download?: typeof downloadAudio;
  cropCover?: typeof squareCover;
  tmpRoot?: string;
}

export async function runImport(req: ImportRequest, session: AdminSession, deps: ImportDeps, emit: (e: ImportEvent) => void): Promise<void> {
  const yt = link(req.url);
  let last = -1;
  const progress = (stage: Stage, ratio: number) => {
    const percent = overallPercent(stage, ratio);
    if (percent !== last) emit({ type: 'progress', stage, percent });
    last = percent;
  };

  const existing = await findExisting(session, yt.videoId);
  if (existing) throw new HttpError(409, `Bu video zaten eklenmiş: "${existing.title}".`);
  const info = await (deps.probe ?? probeVideo)(deps.ytDlpPath, yt.url);
  const problem = videoProblem(info);
  if (problem) throw new HttpError(422, problem);

  const dir = await mkdtemp(join(deps.tmpRoot ?? tmpdir(), 'bekofy-yt-'));
  const uploaded: string[] = [];
  let songId: string | null = null;
  try {
    progress('download', 0);
    const files = await (deps.download ?? downloadAudio)(deps.ytDlpPath, deps.ffmpegPath, yt.url, dir, (e: DownloadEvent) => {
      if (e.kind === 'download') progress('download', e.ratio);
      else if (e.kind === 'convert') progress('convert', 0);
    });
    progress('cover', 0);
    let coverSource = files.thumbnail;
    if (req.cover.kind === 'upload') {
      const image = decodeImageDataUrl(req.cover.dataUrl);
      coverSource = join(dir, `upload.${image.mime.split('/')[1]}`);
      await writeFile(coverSource, image.bytes);
    }
    let coverFile: string | null = null;
    if (coverSource) {
      coverFile = join(dir, 'cover-square.jpg');
      await (deps.cropCover ?? squareCover)(deps.ffmpegPath, coverSource, coverFile);
    }

    const pathInput = { artist: req.artists[0] as string, title: req.title, uniqueId: yt.videoId };
    const audioKey = songAudioPath(pathInput);
    progress('upload', 0);
    const fileUrl = await deps.storage.upload(audioKey, files.audio, 'audio/mpeg', (r) => progress('upload', r * 0.9));
    uploaded.push(audioKey);
    let coverUrl: string | null = null;
    if (coverFile) {
      const coverKey = songCoverPath(pathInput);
      coverUrl = await deps.storage.upload(coverKey, coverFile, 'image/jpeg');
      uploaded.push(coverKey);
    }
    progress('upload', 1);

    progress('save', 0);
    const song = await createSong(session.sb, {
      title: req.title,
      artist: joinArtistNames(req.artists),
      album: req.album,
      duration: info.duration,
      cover_url: coverUrl,
      file_path: fileUrl,
      status: 'approved',
    });
    songId = song.id;
    const artistIds: string[] = [];
    for (const name of req.artists) artistIds.push((await ensureArtist(session.sb, name)).id);
    await setSongArtists(session.sb, song.id, artistIds);
    progress('save', 1);
    emit({ type: 'done', song: { id: song.id, title: song.title, artist: song.artist, album: song.album, duration: song.duration, cover_url: song.cover_url, file_path: song.file_path } });
  } catch (e) {
    if (songId) await deleteSong(session.sb, songId).catch(() => undefined);
    await Promise.all(uploaded.map((key) => deps.storage.remove(key).catch(() => undefined)));
    if (e instanceof DataError) throw new HttpError(502, e.message);
    throw e;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
