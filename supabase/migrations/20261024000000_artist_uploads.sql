-- Faz 4: sitedeki sanatçı panelinden şarkı yükleme.
-- Dosyalar, site sunucusunun verdiği imzalı adresle doğrudan R2'ye yüklenir. Kayıt submit_artist_song ile açılır
-- ve onay bekler; admin reddederse site sunucusu R2'deki dosyaları siler.
-- Geri alma: supabase/rollbacks/20261024000000_artist_uploads.sql

begin;

-- 1) Yükleyen. Sanatçı kendi yüklemelerini görür; admin içe aktarmalarında admin yazılır.
alter table public.songs add column if not exists uploaded_by uuid references public.profiles(id) on delete set null;
alter table public.songs alter column uploaded_by set default auth.uid();
create index if not exists songs_uploaded_by_idx on public.songs (uploaded_by);

-- 2) Bir dosyaya tek kayıt bağlanır. Reddedilen şarkının dosyası silinirken başka bir kayıt bozulamaz.
create unique index if not exists songs_file_path_key on public.songs (file_path);

-- 3) Şarkıyı doğrudan yalnızca admin ekler. Eski politika sanatçıya istediği adresle kayıt açtırıyordu.
drop policy if exists "songs_insert" on public.songs;
drop policy if exists "bekofy: şarkıyı admin ekler" on public.songs;
create policy "bekofy: şarkıyı admin ekler" on public.songs
  for insert to authenticated with check (public.is_admin());

-- 4) Sanatçı yüklemesi: kayıt ve sanatçı bağı tek işlemde, her zaman "pending".
create or replace function public.submit_artist_song(
  p_title text,
  p_album text,
  p_genre text,
  p_duration integer,
  p_file_path text,
  p_cover_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- R2 genel alan adı. Değişirse burası ve site ayarı (R2_PUBLIC_DOMAIN) birlikte güncellenir.
  prefix constant text := 'https://music.bekirr.dev/music/';
  me public.profiles;
  art public.artists;
  new_id uuid;
begin
  -- Boş metin "yok" demektir (istemci tipleri null yerine boş metin gönderir).
  p_cover_url := nullif(trim(coalesce(p_cover_url, '')), '');
  select * into me from public.profiles where id = auth.uid();
  if not found or me.is_banned then
    raise exception 'Bu işlem için giriş yapmalısın' using errcode = '42501';
  end if;
  select * into art from public.artists where profile_id = me.id;
  if not found then
    raise exception 'Sanatçı hesabın bulunamadı' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 200 then
    raise exception 'Şarkı adı 1 ile 200 karakter arasında olmalı' using errcode = '22023';
  end if;
  if char_length(coalesce(p_album, '')) > 200 or char_length(coalesce(p_genre, '')) > 60 then
    raise exception 'Albüm adı en çok 200, tür en çok 60 karakter olabilir' using errcode = '22023';
  end if;
  if p_duration is null or p_duration not between 1 and 1800 then
    raise exception 'Şarkı süresi 1 saniye ile 30 dakika arasında olmalı' using errcode = '22023';
  end if;
  if p_file_path is null or left(p_file_path, char_length(prefix)) <> prefix or p_file_path !~ '\.mp3$' then
    raise exception 'Ses dosyasının adresi geçersiz' using errcode = '22023';
  end if;
  if p_cover_url is not null and (left(p_cover_url, char_length(prefix)) <> prefix or p_cover_url !~ '\.(jpg|png|webp)$') then
    raise exception 'Kapak görselinin adresi geçersiz' using errcode = '22023';
  end if;

  insert into public.songs (title, artist, album, genre, duration, file_path, cover_url, status, uploaded_by)
  values (trim(p_title), art.name, nullif(trim(p_album), ''), nullif(trim(p_genre), ''), p_duration, p_file_path, p_cover_url, 'pending', me.id)
  returning id into new_id;
  insert into public.song_artists (song_id, artist_id, position) values (new_id, art.id, 0);
  return new_id;
end;
$$;
revoke all on function public.submit_artist_song(text, text, text, integer, text, text) from public, anon;
grant execute on function public.submit_artist_song(text, text, text, integer, text, text) to authenticated;

-- 5) Sanatçı paneli istatistikleri: yalnızca çağıranın şarkıları, yalnızca toplam sayılar (dinleyen kimliği yok).
create or replace function public.artist_song_stats()
returns table (
  song_id uuid,
  title text,
  status text,
  created_at timestamptz,
  cover_url text,
  duration integer,
  plays bigint,
  listeners bigint,
  plays_30d bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, s.status, s.created_at, s.cover_url, s.duration,
         count(h.id),
         count(distinct h.user_id),
         count(h.id) filter (where h.played_at > now() - interval '30 days')
  from public.songs s
  left join public.listening_history h on h.song_id = s.id
  where auth.uid() is not null
    and (
      s.uploaded_by = auth.uid()
      or exists (
        select 1 from public.song_artists sa
        join public.artists a on a.id = sa.artist_id
        where sa.song_id = s.id and a.profile_id = auth.uid()
      )
    )
  group by s.id
  order by s.created_at desc;
$$;
revoke all on function public.artist_song_stats() from public, anon;
grant execute on function public.artist_song_stats() to authenticated;

commit;
