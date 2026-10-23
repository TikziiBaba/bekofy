-- 20261024000000_artist_uploads.sql geri alma. Sanatçı yüklemesi yeniden eski (denetimsiz) duruma döner.

begin;

drop function if exists public.artist_song_stats();
drop function if exists public.submit_artist_song(text, text, text, integer, text, text);

drop policy if exists "bekofy: şarkıyı admin ekler" on public.songs;
create policy "songs_insert" on public.songs
  for insert to authenticated
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = any (array['admin', 'artist', 'yetkili'])));

drop index if exists public.songs_file_path_key;
drop index if exists public.songs_uploaded_by_idx;
alter table public.songs drop column if exists uploaded_by;

commit;
