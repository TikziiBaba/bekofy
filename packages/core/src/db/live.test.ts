// Canlı veritabanına anon anahtarla YALNIZCA OKUMA yapan testler. Varsayılan olarak atlanır.
// Çalıştırmak için: BEKOFY_LIVE=1 npm test -w @bekofy/core

import { describe, expect, it } from 'vitest';
import { createBekofyClient, memoryStorage } from '../client';
import { badgeDefinitions } from './badges';
import { DataError } from './errors';
import { findJamByCode } from './jam';
import { getPlaylist } from './playlists';
import { checkUsername } from './profiles';
import { listSongs, searchSongs, songAudioUrl, songsByArtistName, songsByIds } from './songs';

const live = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BEKOFY_LIVE === '1';
const sb = createBekofyClient({ storage: memoryStorage() });

describe.skipIf(!live)('canlı okuma (anon)', () => {
  it('onaylı şarkılar listelenir, ses adresi tam URL', async () => {
    const songs = await listSongs(sb, { limit: 5 });
    expect(songs.length).toBeGreaterThan(0);
    for (const s of songs) {
      expect(s.status).toBe('approved');
      expect(songAudioUrl(sb, s)).toMatch(/^https:\/\//);
    }
  });

  it('arama ve kimlik sırası', async () => {
    const found = await searchSongs(sb, 'sezen');
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((s) => /sezen/i.test(`${s.title} ${s.artist}`))).toBe(true);
    const ids = found.map((s) => s.id).reverse();
    expect((await songsByIds(sb, ids)).map((s) => s.id)).toEqual(ids);
    expect(await searchSongs(sb, '%,()')).toEqual([]);
  });

  it('çoklu sanatçılı şarkı her iki sanatçıda bulunur', async () => {
    const uzi = await songsByArtistName(sb, 'UZİ');
    expect(uzi.some((s) => s.artist.includes(','))).toBe(true);
  });

  it('rozet tanımları okunur', async () => {
    expect((await badgeDefinitions(sb)).length).toBeGreaterThan(0);
  });

  it('olmayan kayıt: Türkçe DataError ya da null', async () => {
    await expect(getPlaylist(sb, '00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(DataError);
    expect(await findJamByCode(sb, 'ZZZ-ZZZ')).toBeNull();
  });

  it('kayıt sırasında kullanıcı adı denetimi oturumsuz çalışır', async () => {
    expect(await checkUsername(sb, 'x')).toBe('format');
    expect(await checkUsername(sb, `deneme_${Date.now().toString(36)}`)).toBeNull();
  });
});
