-- Geri alma: supabase/migrations/20261023010000_security_hardening.sql
-- Eski politikalar RLS denetim çıktısındaki (2026-10-23) tanımlarıyla birebir geri kurulur.
-- UYARI: bu dosya bilinen güvenlik açıklarını geri getirir. Yalnızca sıkılaştırma bir şeyi bozduysa, kısa süreliğine kullan.

begin;

-- 7) follows
create policy "follows_manage" on public.follows for all using (auth.uid() = follower_id);
create policy "follows_view" on public.follows for select using ((auth.uid() = follower_id) or (auth.uid() = following_id));

-- 6) rozet fonksiyonu
grant execute on function public.update_user_badge_progress(uuid) to public, anon;

-- 5) şarkı onayı
drop trigger if exists bekofy_force_pending_song on public.songs;
drop function if exists public.force_pending_song();

-- 4) avatars
update storage.buckets set allowed_mime_types = null where id = 'avatars';
drop policy if exists "bekofy: avatars kendi klasörüne yükle" on storage.objects;
drop policy if exists "bekofy: avatars kendi dosyasını güncelle" on storage.objects;
drop policy if exists "bekofy: avatars kendi dosyasını sil" on storage.objects;
create policy "Avatar Guncelleme" on storage.objects for update to authenticated with check (bucket_id = 'avatars');
create policy "Kullanicilar kendi avatarlarini yukleyebilir" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');

-- 3) çalma listeleri
drop policy if exists "bekofy: liste şarkısı çıkar" on public.playlist_songs;
drop policy if exists "bekofy: liste sırasını değiştir" on public.playlist_songs;
drop policy if exists "bekofy: liste şarkısı ekle" on public.playlist_songs;
drop policy if exists "bekofy: liste şarkıları görünürlüğü" on public.playlist_songs;
create policy "Herkes playlist sarkilarini gorebilir" on public.playlist_songs for select using (true);
create policy "playlist_songs_select" on public.playlist_songs for select to authenticated
  using (exists (select 1 from public.playlists where playlists.id = playlist_songs.playlist_id and (playlists.user_id = auth.uid() or playlists.is_public = true)));
create policy "playlist_songs_insert" on public.playlist_songs for insert
  with check ((exists (select 1 from public.playlists where playlists.id = playlist_songs.playlist_id and playlists.user_id = auth.uid()))
    or (exists (select 1 from public.playlist_collaborators pc where pc.playlist_id = pc.playlist_id and pc.user_id = auth.uid())));
create policy "playlist_songs_delete" on public.playlist_songs for delete
  using ((exists (select 1 from public.playlists where playlists.id = playlist_songs.playlist_id and playlists.user_id = auth.uid()))
    or (exists (select 1 from public.playlist_collaborators pc where pc.playlist_id = pc.playlist_id and pc.user_id = auth.uid())));

drop policy if exists "bekofy: liste görünürlüğü" on public.playlists;
create policy "Herkes playlistleri gorebilir" on public.playlists for select using (true);
create policy "Playlist gorunurluk" on public.playlists for select
  using ((auth.uid() = user_id) or (is_public = true) or (exists (select 1 from public.playlist_collaborators pc where pc.playlist_id = pc.id and pc.user_id = auth.uid())));
create policy "playlist_select" on public.playlists for select
  using ((auth.uid() = user_id) or (is_public = true) or (exists (select 1 from public.playlist_collaborators pc where pc.playlist_id = pc.id and pc.user_id = auth.uid())));
create policy "playlists_select" on public.playlists for select to authenticated using ((user_id = auth.uid()) or (is_public = true));

drop function if exists public.can_view_playlist(uuid);
drop function if exists public.can_edit_playlist(uuid);

-- 2) jam
drop policy if exists "bekofy: jam'den çık ya da sahip çıkarır" on public.jam_participants;
drop policy if exists "bekofy: jam'e kendi adına katıl" on public.jam_participants;
drop policy if exists "bekofy: jam katılımcıları herkese açık" on public.jam_participants;
create policy "Authenticated users can join jam" on public.jam_participants for insert with check (true);
create policy "User can leave or host can remove" on public.jam_participants for delete using (true);

drop policy if exists "bekofy: jam'i yalnız sahibi bitirir" on public.jam_sessions;
drop policy if exists "bekofy: jam durumunu sahip ya da katılımcı günceller" on public.jam_sessions;
drop policy if exists "bekofy: jam başlat" on public.jam_sessions;
drop policy if exists "bekofy: jam herkese açık" on public.jam_sessions;
create policy "Authenticated users can create jam sessions" on public.jam_sessions for insert with check (true);
create policy "Host can update jam session" on public.jam_sessions for update using (true);
create policy "Host can delete jam session" on public.jam_sessions for delete using (true);

alter table public.jam_participants disable row level security;
alter table public.jam_sessions disable row level security;

-- 1) profil yetkileri
drop trigger if exists bekofy_protect_profile_privileges on public.profiles;
drop function if exists public.protect_profile_privileges();

commit;
