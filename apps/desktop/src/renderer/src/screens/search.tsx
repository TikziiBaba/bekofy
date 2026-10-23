import { searchArtists, searchProfiles, searchPublicPlaylists, searchSongs } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Avatar } from '../components/avatar';
import { Card, Empty, PageTitle, Section, Shelf } from '../components/blocks';
import { TrackList } from '../components/track-list';
import { href } from '../lib/router';
import { useAuthed } from '../lib/session';

/** Yazarken her tuşta değil, kısa bir bekleme sonrası arar. */
function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchScreen({ q }: { q: string }) {
  const { sb, user } = useAuthed();
  const term = useDebounced(q.trim());
  const enabled = term.length >= 2;
  const res = useQuery({
    queryKey: ['search', term],
    enabled,
    queryFn: async () => {
      const [songs, artists, playlists, people] = await Promise.all([
        searchSongs(sb, term, 20),
        searchArtists(sb, term, 10),
        searchPublicPlaylists(sb, term, 10),
        searchProfiles(sb, term, { excludeId: user.id, limit: 10 }),
      ]);
      return { songs, artists, playlists, people };
    },
  });

  if (!enabled) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Ara</PageTitle>
        <p className="text-fg-muted">Üstteki arama kutusuna en az iki harf yaz: şarkı, sanatçı, herkese açık liste ya da kişi.</p>
      </div>
    );
  }

  const d = res.data;
  const nothing = d && !d.songs.length && !d.artists.length && !d.playlists.length && !d.people.length;

  return (
    <div className="flex flex-col gap-10">
      <PageTitle>“{term}” için sonuçlar</PageTitle>
      <p className="sr-only" role="status">
        {res.isFetching ? 'Aranıyor' : d ? `${d.songs.length} şarkı, ${d.artists.length} sanatçı, ${d.playlists.length} liste, ${d.people.length} kişi bulundu` : ''}
      </p>
      {res.error ? <Empty title="Arama yapılamadı">İnternet bağlantını kontrol edip tekrar dene.</Empty> : null}
      {nothing ? <Empty title="Sonuç yok">Yazımı kontrol et ya da sanatçı adıyla dene.</Empty> : null}
      {d?.songs.length ? (
        <Section id="r-songs" title="Şarkılar">
          <TrackList tracks={d.songs} label="Bulunan şarkılar" contextId="search" />
        </Section>
      ) : null}
      {d?.artists.length ? (
        <Section id="r-artists" title="Sanatçılar">
          <Shelf label="Bulunan sanatçılar">
            {d.artists.map((a) => (
              <Card key={a.id} href={href({ name: 'artist', id: a.id })} cover={a.avatar_url} round title={a.name} sub="Sanatçı" />
            ))}
          </Shelf>
        </Section>
      ) : null}
      {d?.playlists.length ? (
        <Section id="r-lists" title="Çalma listeleri">
          <Shelf label="Bulunan çalma listeleri">
            {d.playlists.map((p) => (
              <Card key={p.id} href={href({ name: 'playlist', id: p.id })} cover={p.cover_url} title={p.name} sub="Herkese açık liste" />
            ))}
          </Shelf>
        </Section>
      ) : null}
      {d?.people.length ? (
        <Section id="r-people" title="Kişiler">
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {d.people.map((p) => (
              <li key={p.id}>
                <a href={href({ name: 'profile', id: p.id })} className="glass-panel flex items-center gap-3 rounded-ui-lg p-3 hover:bg-glass">
                  <Avatar src={p.avatar_url} name={p.username} />
                  <span className="truncate type-label-md">@{p.username}</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
