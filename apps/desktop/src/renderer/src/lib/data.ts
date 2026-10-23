// Sık kullanılan veriler: beğeniler, çalma listeleri. Önbellek react-query'de; değişince ilgili anahtar yenilenir.

import { createPlaylist, likedSongIds, likeSong, unlikeSong, userPlaylists, addSongsToPlaylist } from '@bekofy/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '../components/toast';
import { useAuthed } from './session';

export const keys = {
  liked: (uid: string) => ['liked', uid] as const,
  likedSongs: (uid: string) => ['liked-songs', uid] as const,
  playlists: (uid: string) => ['playlists', uid] as const,
  playlist: (id: string) => ['playlist', id] as const,
};

export function useLikedIds() {
  const { sb, user } = useAuthed();
  return useQuery({ queryKey: keys.liked(user.id), queryFn: () => likedSongIds(sb, user.id) });
}

export function useToggleLike() {
  const { sb, user } = useAuthed();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ songId, liked }: { songId: string; liked: boolean; title: string }) => {
      if (liked) await unlikeSong(sb, user.id, songId);
      else await likeSong(sb, user.id, songId);
    },
    onMutate: ({ songId, liked }) => {
      // İyimser güncelleme: kalp hemen değişir, hata olursa geri alınır.
      const prev = qc.getQueryData<Set<string>>(keys.liked(user.id));
      const next = new Set(prev);
      if (liked) next.delete(songId);
      else next.add(songId);
      qc.setQueryData(keys.liked(user.id), next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(keys.liked(user.id), ctx?.prev);
      showToast('Beğeni kaydedilemedi. Tekrar dene.');
    },
    onSuccess: (_d, { liked, title }) => {
      showToast(liked ? `${title} beğenilenlerden çıkarıldı` : `${title} beğenilenlere eklendi`);
      void qc.invalidateQueries({ queryKey: keys.likedSongs(user.id) });
    },
  });
}

export function usePlaylists() {
  const { sb, user } = useAuthed();
  return useQuery({ queryKey: keys.playlists(user.id), queryFn: () => userPlaylists(sb, user.id) });
}

export function useCreatePlaylist() {
  const { sb, user } = useAuthed();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createPlaylist(sb, { userId: user.id, name }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.playlists(user.id) }),
  });
}

export function useAddToPlaylist() {
  const { sb, user } = useAuthed();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, songIds }: { playlistId: string; songIds: string[]; name: string }) => addSongsToPlaylist(sb, playlistId, songIds),
    onSuccess: (added, { playlistId, name }) => {
      showToast(added ? `${name} listesine eklendi` : `Zaten ${name} listesinde`);
      void qc.invalidateQueries({ queryKey: keys.playlist(playlistId) });
      void qc.invalidateQueries({ queryKey: keys.playlists(user.id) });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : 'Listeye eklenemedi.'),
  });
}
