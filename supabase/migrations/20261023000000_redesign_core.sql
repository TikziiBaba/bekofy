-- Bekofy yeniden tasarım, Faz 2: çekirdek veri modeli.
--
-- Uygulama: Supabase panelinde SQL Editor'e dosyanın tamamını yapıştır, çalıştır.
-- Geri alma: supabase/rollbacks/20261023000000_redesign_core.sql
-- Tekrar çalıştırılabilir: her adım "if not exists" / "on conflict do nothing" ile yazıldı.
--
-- Eski masaüstü uygulaması takip için friendships tablosunu kullanmaya devam ediyor; bu yüzden o tablo
-- silinmez. Yeni uygulamalar yayına girerken 1. adım tekrar çalıştırılarak aradaki kayıtlar da taşınır.

begin;

-- 0) Yardımcı: çağıran kullanıcı admin mi? security definer, profiles RLS'sine takılmadan okur.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'yetkili')
  );
$$;

-- 1) Takip: tek yönlü, onaysız (follows). friendships'teki kabul edilmiş kayıtlar taşınır.
insert into public.follows (follower_id, following_id, status)
select f.user_id, f.friend_id, 'accepted'
from public.friendships f
where f.status = 'accepted'
  and f.user_id is not null and f.friend_id is not null and f.user_id <> f.friend_id
  and exists (select 1 from public.profiles p where p.id = f.user_id)
  and exists (select 1 from public.profiles p where p.id = f.friend_id)
on conflict do nothing;

alter table public.follows enable row level security;
drop policy if exists "bekofy: takipler herkese açık" on public.follows;
create policy "bekofy: takipler herkese açık" on public.follows
  for select using (true);
drop policy if exists "bekofy: kendi adına takip et" on public.follows;
create policy "bekofy: kendi adına takip et" on public.follows
  for insert with check (auth.uid() = follower_id and follower_id <> following_id);
drop policy if exists "bekofy: kendi takibini bırak" on public.follows;
create policy "bekofy: kendi takibini bırak" on public.follows
  for delete using (auth.uid() = follower_id);

-- 2) Şarkı-sanatçı bağı: bir şarkının birden çok sanatçısı olabilir ("Motive, UZİ").
--    songs.artist metni görüntü için kalır; sayfalar ve takip bu tabloyla çalışır.
create table if not exists public.song_artists (
  song_id uuid not null references public.songs(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  position smallint not null default 0,
  primary key (song_id, artist_id)
);
create index if not exists song_artists_artist_idx on public.song_artists (artist_id);

alter table public.song_artists enable row level security;
drop policy if exists "bekofy: şarkı-sanatçı herkese açık" on public.song_artists;
create policy "bekofy: şarkı-sanatçı herkese açık" on public.song_artists
  for select using (true);
drop policy if exists "bekofy: şarkı-sanatçı adminde" on public.song_artists;
create policy "bekofy: şarkı-sanatçı adminde" on public.song_artists
  for all using (public.is_admin()) with check (public.is_admin());

-- Mevcut şarkıları sanatçı adına göre eşle (virgül, &, feat., ft. ile ayrılmış adlar).
insert into public.song_artists (song_id, artist_id, position)
select s.id, a.id, (p.ord - 1)::smallint
from public.songs s
cross join lateral regexp_split_to_table(s.artist, '\s*(?:,|&|\s+feat\.?\s+|\s+ft\.?\s+)\s*') with ordinality as p(name, ord)
join public.artists a on lower(trim(a.name)) = lower(trim(p.name))
on conflict do nothing;

-- Sanatçı sayfasını yönetecek kullanıcı hesabı (onaylanmış sanatçı başvurusundan gelir).
alter table public.artists add column if not exists profile_id uuid unique references public.profiles(id) on delete set null;
-- Ad benzersizliği (eski kurulumda UNIQUE tanımlıydı; canlıda yoksa bu indeks garanti eder).
create unique index if not exists artists_name_unique on public.artists (name);

-- 3) Sanatçı takibi: artists tablosuna bağlı (follows yalnızca kullanıcıdan kullanıcıya).
create table if not exists public.artist_follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);
create index if not exists artist_follows_artist_idx on public.artist_follows (artist_id);

alter table public.artist_follows enable row level security;
drop policy if exists "bekofy: sanatçı takipleri herkese açık" on public.artist_follows;
create policy "bekofy: sanatçı takipleri herkese açık" on public.artist_follows
  for select using (true);
drop policy if exists "bekofy: sanatçıyı kendi adına takip et" on public.artist_follows;
create policy "bekofy: sanatçıyı kendi adına takip et" on public.artist_follows
  for insert with check (auth.uid() = user_id);
drop policy if exists "bekofy: sanatçı takibini bırak" on public.artist_follows;
create policy "bekofy: sanatçı takibini bırak" on public.artist_follows
  for delete using (auth.uid() = user_id);

-- 4) Dinleme geçmişi: Wrapped, öneriler, "bu ay en çok dinlediklerin". En az 30 saniye çalınca yazılır.
create table if not exists public.listening_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  played_at timestamptz not null default now(),
  seconds_played integer not null default 0 check (seconds_played between 0 and 86400),
  context_id text check (char_length(context_id) <= 64),
  platform text not null check (platform in ('desktop', 'web', 'android', 'ios'))
);
create index if not exists listening_history_user_time_idx on public.listening_history (user_id, played_at desc);
create index if not exists listening_history_song_idx on public.listening_history (song_id);

alter table public.listening_history enable row level security;
drop policy if exists "bekofy: kendi geçmişini yaz" on public.listening_history;
create policy "bekofy: kendi geçmişini yaz" on public.listening_history
  for insert with check (auth.uid() = user_id);
drop policy if exists "bekofy: kendi geçmişini ya da admin hepsini okur" on public.listening_history;
create policy "bekofy: kendi geçmişini ya da admin hepsini okur" on public.listening_history
  for select using (auth.uid() = user_id or public.is_admin());

-- 5) Sanatçı başvuruları: kullanıcı başvurur, admin onaylar ya da reddeder.
create table if not exists public.artist_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  artist_name text not null check (char_length(trim(artist_name)) between 1 and 80),
  message text check (char_length(message) <= 1000),
  links text[] not null default '{}' check (cardinality(links) <= 5),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists artist_requests_one_pending_idx on public.artist_requests (user_id) where status = 'pending';

alter table public.artist_requests enable row level security;
drop policy if exists "bekofy: kendi başvurusunu oluştur" on public.artist_requests;
create policy "bekofy: kendi başvurusunu oluştur" on public.artist_requests
  for insert with check (auth.uid() = user_id and status = 'pending' and reviewed_by is null);
drop policy if exists "bekofy: kendi başvurusunu ya da admin hepsini okur" on public.artist_requests;
create policy "bekofy: kendi başvurusunu ya da admin hepsini okur" on public.artist_requests
  for select using (auth.uid() = user_id or public.is_admin());

-- Onay tek işlemde: başvuru durumu, profil rolü ve sanatçı kaydı birlikte değişir.
create or replace function public.review_artist_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.artist_requests;
begin
  if not public.is_admin() then
    raise exception 'Yalnızca admin başvuru değerlendirebilir' using errcode = '42501';
  end if;
  select * into req from public.artist_requests where id = p_request_id and status = 'pending' for update;
  if not found then
    raise exception 'Bekleyen başvuru bulunamadı' using errcode = 'P0002';
  end if;
  update public.artist_requests
    set status = case when p_approve then 'approved' else 'rejected' end, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;
  if p_approve then
    -- Premium ve admin rolleri korunur; sanatçılık artists.profile_id bağıyla belirlenir.
    update public.profiles set role = 'artist' where id = req.user_id and role = 'user';
    insert into public.artists (name, profile_id) values (trim(req.artist_name), req.user_id)
      on conflict (name) do update set profile_id = coalesce(public.artists.profile_id, excluded.profile_id);
  end if;
end;
$$;
revoke all on function public.review_artist_request(uuid, boolean) from public, anon;
grant execute on function public.review_artist_request(uuid, boolean) to authenticated;

-- 6) Giriş kayıtları (admin terminali). Bilinçli olarak IP ve konum tutulmaz.
create table if not exists public.user_access_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('desktop', 'web', 'android', 'ios')),
  app_version text check (char_length(app_version) <= 32),
  user_agent text check (char_length(user_agent) <= 400),
  created_at timestamptz not null default now()
);
create index if not exists user_access_logs_user_time_idx on public.user_access_logs (user_id, created_at desc);
create index if not exists user_access_logs_time_idx on public.user_access_logs (created_at desc);

alter table public.user_access_logs enable row level security;
drop policy if exists "bekofy: kendi girişini kaydet" on public.user_access_logs;
create policy "bekofy: kendi girişini kaydet" on public.user_access_logs
  for insert with check (auth.uid() = user_id);
drop policy if exists "bekofy: girişleri yalnız admin okur" on public.user_access_logs;
create policy "bekofy: girişleri yalnız admin okur" on public.user_access_logs
  for select using (public.is_admin());

commit;
