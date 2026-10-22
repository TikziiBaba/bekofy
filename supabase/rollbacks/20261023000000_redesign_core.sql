-- Geri alma: supabase/migrations/20261023000000_redesign_core.sql
-- Yeni tablolar ve içindeki veriler (dinleme geçmişi, başvurular, giriş kayıtları, sanatçı takipleri) silinir.

begin;

drop function if exists public.review_artist_request(uuid, boolean);
drop table if exists public.user_access_logs;
drop table if exists public.artist_requests;
drop table if exists public.listening_history;
drop table if exists public.artist_follows;
drop table if exists public.song_artists;
drop index if exists public.artists_name_unique;
alter table public.artists drop column if exists profile_id;

-- follows migration'dan önce boştu; friendships'ten taşınan kayıtlar geri alınır.
delete from public.follows f
using public.friendships fr
where fr.status = 'accepted' and fr.user_id = f.follower_id and fr.friend_id = f.following_id;

drop policy if exists "bekofy: takipler herkese açık" on public.follows;
drop policy if exists "bekofy: kendi adına takip et" on public.follows;
drop policy if exists "bekofy: kendi takibini bırak" on public.follows;
-- follows'ta RLS migration'dan önce kapalıysa (supabase/checks/rls_audit.sql çıktısına bak) şunu da çalıştır:
-- alter table public.follows disable row level security;

drop function if exists public.is_admin();

commit;
