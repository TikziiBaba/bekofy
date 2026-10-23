-- Bekofy güvenlik sıkılaştırması (RLS denetimi, 2026-10-23).
--
-- Uygulama: Supabase SQL Editor'de dosyanın tamamını çalıştır. Tek işlemdir; hata olursa hiçbir şey değişmez.
-- Geri alma: supabase/rollbacks/20261023010000_security_hardening.sql (eski politikaları birebir geri kurar).
-- Doğrulama: supabase/checks/rls_audit.sql tekrar çalıştırılır.

begin;

-- 1) KRİTİK: kullanıcı kendi rolünü, premium ve askı durumunu değiştiremez.
--    Eski politika kendi satırını tümüyle güncellemeye izin veriyordu (role = 'admin' dahil).
--    Admin, service_role ve SQL editörü (auth.uid() yok) serbesttir; admin paneli çalışmaya devam eder.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'user';
    new.is_premium := false;
    new.is_banned := false;
  elsif new.role is distinct from old.role
     or new.is_premium is distinct from old.is_premium
     or new.is_banned is distinct from old.is_banned then
    raise exception 'Rol, premium ve askı bilgisi yalnızca admin tarafından değiştirilebilir' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists bekofy_protect_profile_privileges on public.profiles;
create trigger bekofy_protect_profile_privileges
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- 2) KRİTİK: Jam tablolarında RLS kapalıydı; politikalar da "true" idi.
--    Okuma açık (kodla katılım), başlatma kendi adına, durum güncellemesi sahip ya da katılımcı,
--    oturumu bitirme yalnız sahip, katılımcıyı çıkarma kendisi ya da sahip.
alter table public.jam_sessions enable row level security;
alter table public.jam_participants enable row level security;

drop policy if exists "Authenticated users can create jam sessions" on public.jam_sessions;
drop policy if exists "Host can update jam session" on public.jam_sessions;
drop policy if exists "Host can delete jam session" on public.jam_sessions;
drop policy if exists "bekofy: jam herkese açık" on public.jam_sessions;
create policy "bekofy: jam herkese açık" on public.jam_sessions
  for select using (true);
drop policy if exists "bekofy: jam başlat" on public.jam_sessions;
create policy "bekofy: jam başlat" on public.jam_sessions
  for insert with check (auth.uid() = host_id);
drop policy if exists "bekofy: jam durumunu sahip ya da katılımcı günceller" on public.jam_sessions;
create policy "bekofy: jam durumunu sahip ya da katılımcı günceller" on public.jam_sessions
  for update
  using (auth.uid() = host_id or exists (select 1 from public.jam_participants p where p.session_id = jam_sessions.id and p.user_id = auth.uid()))
  with check (auth.uid() = host_id or exists (select 1 from public.jam_participants p where p.session_id = jam_sessions.id and p.user_id = auth.uid()));
drop policy if exists "bekofy: jam'i yalnız sahibi bitirir" on public.jam_sessions;
create policy "bekofy: jam'i yalnız sahibi bitirir" on public.jam_sessions
  for delete using (auth.uid() = host_id);

drop policy if exists "Authenticated users can join jam" on public.jam_participants;
drop policy if exists "User can leave or host can remove" on public.jam_participants;
drop policy if exists "bekofy: jam katılımcıları herkese açık" on public.jam_participants;
create policy "bekofy: jam katılımcıları herkese açık" on public.jam_participants
  for select using (true);
drop policy if exists "bekofy: jam'e kendi adına katıl" on public.jam_participants;
create policy "bekofy: jam'e kendi adına katıl" on public.jam_participants
  for insert with check (auth.uid() = user_id);
drop policy if exists "bekofy: jam'den çık ya da sahip çıkarır" on public.jam_participants;
create policy "bekofy: jam'den çık ya da sahip çıkarır" on public.jam_participants
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.jam_sessions s where s.id = jam_participants.session_id and s.host_id = auth.uid())
  );

-- 3) YÜKSEK + ORTA: çalma listesi erişimi tek yerde.
--    Eski playlist_songs politikası "pc.playlist_id = pc.playlist_id" (her zaman doğru) yüzünden herhangi bir
--    listenin düzenleyicisi tüm listeleri değiştirebiliyordu; gizli listeler "true" politikasıyla herkese açıktı;
--    düzenleyicinin gizli listeyi görmesi gereken koşul ("pc.playlist_id = pc.id") hiç eşleşmiyordu.
create or replace function public.can_edit_playlist(p_playlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.playlists p where p.id = p_playlist_id and p.user_id = auth.uid())
      or exists (select 1 from public.playlist_collaborators c where c.playlist_id = p_playlist_id and c.user_id = auth.uid());
$$;

create or replace function public.can_view_playlist(p_playlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.playlists p where p.id = p_playlist_id and p.is_public)
      or public.can_edit_playlist(p_playlist_id);
$$;

drop policy if exists "Herkes playlistleri gorebilir" on public.playlists;
drop policy if exists "Playlist gorunurluk" on public.playlists;
drop policy if exists "playlist_select" on public.playlists;
drop policy if exists "playlists_select" on public.playlists;
drop policy if exists "bekofy: liste görünürlüğü" on public.playlists;
create policy "bekofy: liste görünürlüğü" on public.playlists
  for select using (is_public or auth.uid() = user_id or public.can_edit_playlist(id));

drop policy if exists "Herkes playlist sarkilarini gorebilir" on public.playlist_songs;
drop policy if exists "playlist_songs_select" on public.playlist_songs;
drop policy if exists "playlist_songs_insert" on public.playlist_songs;
drop policy if exists "playlist_songs_delete" on public.playlist_songs;
drop policy if exists "bekofy: liste şarkıları görünürlüğü" on public.playlist_songs;
create policy "bekofy: liste şarkıları görünürlüğü" on public.playlist_songs
  for select using (public.can_view_playlist(playlist_id));
drop policy if exists "bekofy: liste şarkısı ekle" on public.playlist_songs;
create policy "bekofy: liste şarkısı ekle" on public.playlist_songs
  for insert with check (public.can_edit_playlist(playlist_id));
drop policy if exists "bekofy: liste sırasını değiştir" on public.playlist_songs;
create policy "bekofy: liste sırasını değiştir" on public.playlist_songs
  for update using (public.can_edit_playlist(playlist_id)) with check (public.can_edit_playlist(playlist_id));
drop policy if exists "bekofy: liste şarkısı çıkar" on public.playlist_songs;
create policy "bekofy: liste şarkısı çıkar" on public.playlist_songs
  for delete using (public.can_edit_playlist(playlist_id));

-- 4) YÜKSEK: avatars alanında herkes başkasının dosyasının üstüne yazabiliyordu; tür sınırı yoktu.
--    Kullanıcı yalnızca kendi klasörüne (<kullanıcı-id>/...) yazar; kökteki sanatçı ve kapak görsellerini admin yönetir.
drop policy if exists "Avatar Guncelleme" on storage.objects;
drop policy if exists "Kullanicilar kendi avatarlarini yukleyebilir" on storage.objects;
drop policy if exists "bekofy: avatars kendi klasörüne yükle" on storage.objects;
create policy "bekofy: avatars kendi klasörüne yükle" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "bekofy: avatars kendi dosyasını güncelle" on storage.objects;
create policy "bekofy: avatars kendi dosyasını güncelle" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
  with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "bekofy: avatars kendi dosyasını sil" on storage.objects;
create policy "bekofy: avatars kendi dosyasını sil" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

update storage.buckets
  set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  where id = 'avatars';

-- 5) ORTA: admin olmayan (sanatçı) yüklemeler onay bekler; eskiden varsayılan "approved" ile yayına giriyordu.
create or replace function public.force_pending_song()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists bekofy_force_pending_song on public.songs;
create trigger bekofy_force_pending_song
  before insert on public.songs
  for each row execute function public.force_pending_song();

-- 6) DÜŞÜK: rozet ilerleme fonksiyonu anon için kapalı.
revoke execute on function public.update_user_badge_progress(uuid) from public, anon;
grant execute on function public.update_user_badge_progress(uuid) to authenticated, service_role;

-- 7) DÜŞÜK: eski follows politikaları kendini takip kısıtını delip geçiyordu; yerlerini bekofy politikaları aldı.
drop policy if exists "follows_manage" on public.follows;
drop policy if exists "follows_view" on public.follows;

commit;
