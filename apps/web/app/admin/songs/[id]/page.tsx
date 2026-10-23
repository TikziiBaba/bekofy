import { artistsForSongs, formatDuration, formatRelative, songAudioUrl } from '@bekofy/core';
import { buttonVariants } from '@bekofy/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SongActions } from '@/components/admin/song-actions';
import { SongForm } from '@/components/admin/song-form';
import { PageHead, Panel } from '@/components/panel';
import { SongStatus } from '@/components/song-status';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Şarkıyı düzenle' };

export default async function EditSong({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const res = await sb.from('songs').select('*').eq('id', id).maybeSingle();
  const song = res.data;
  if (!song) notFound();
  const artists = (await artistsForSongs(sb, [id])).get(id) ?? [];
  const uploader = song.uploaded_by ? (await sb.from('profiles').select('username').eq('id', song.uploaded_by).maybeSingle()).data : null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/songs" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'self-start' })}>
        <ArrowLeft aria-hidden="true" />
        Şarkılar
      </Link>
      <PageHead title={song.title} description={`${song.artist} · ${formatDuration(song.duration)} · ${formatRelative(song.created_at)} eklendi${uploader?.username ? ` · yükleyen @${uploader.username}` : ''}`} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel id="edit" title="Bilgiler">
          <SongForm
            id={song.id}
            initial={{
              title: song.title,
              artists: artists.length ? artists.map((a) => a.name).join(', ') : song.artist,
              album: song.album ?? '',
              genre: song.genre ?? '',
              lyrics: song.lyrics ?? '',
              syncedLyrics: song.synced_lyrics ?? '',
            }}
          />
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel id="listen" title="Dinle ve karar ver" action={<SongStatus status={song.status} />}>
            {song.cover_url ? <img src={song.cover_url} alt={`${song.title} kapağı`} className="aspect-square w-full max-w-(--size-artwork-xl) rounded-art-lg object-cover shadow-ui-md" /> : null}
            <audio controls preload="none" src={songAudioUrl(sb, song)} className="w-full">
              <track kind="captions" />
            </audio>
            <p className="type-body-sm text-fg-muted [overflow-wrap:anywhere]">Dosya: {song.file_path}</p>
            <SongActions id={song.id} title={song.title} status={song.status} showEdit={false} afterDelete="/admin/songs" />
          </Panel>
        </div>
      </div>
    </div>
  );
}
