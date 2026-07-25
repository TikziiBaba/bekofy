-- ============================================
-- BEKOFY PROFILE REDESIGN MIGRATION
-- ============================================

-- 1. PROFILES TABLOSU GENİŞLETME
-- ============================================
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_genres text[],
  ADD COLUMN IF NOT EXISTS banner_position int DEFAULT 50 CHECK (banner_position BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS bio_format text DEFAULT 'plain' CHECK (bio_format IN ('plain','markdown')),
  ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'default';

-- 2. BADGE DEFINITIONS TABLOSU (Sabit rozet tanımları)
-- ============================================
CREATE TABLE IF NOT EXISTS badge_definitions (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon text NOT NULL,
  category text NOT NULL CHECK (category IN ('listening','social','artist','special','premium')),
  requirement jsonb NOT NULL,
  is_premium boolean DEFAULT false,
  rarity text DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  created_at timestamptz DEFAULT now()
);

-- 3. USER BADGES TABLOSU (Kullanıcı rozetleri + ilerleme)
-- ============================================
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id text REFERENCES badge_definitions(id),
  earned_at timestamptz,
  progress int DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  UNIQUE(user_id, badge_id)
);

-- 4. FOLLOWS TABLOSU (Takip / Arkadaşlık sistemi)
-- ============================================
CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'accepted' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

-- 5. ARTIST FOLLOW PLAYLISTS TABLOSU (Sanatçı takibi -> otomatik playlist)
-- ============================================
CREATE TABLE IF NOT EXISTS artist_follow_playlists (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  playlist_id uuid REFERENCES playlists(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);

-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_follow_playlists ENABLE ROW LEVEL SECURITY;

-- badge_definitions: Herkes okuyabilir (sabit veri)
DROP POLICY IF EXISTS "badge_defs_read" ON badge_definitions;
CREATE POLICY "badge_defs_read" ON badge_definitions FOR SELECT USING (true);

-- user_badges: Kullanıcı kendi rozetlerini görebilir, public profillerde herkes görebilir
DROP POLICY IF EXISTS "user_badges_own" ON user_badges;
CREATE POLICY "user_badges_own" ON user_badges FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_badges_public" ON user_badges;
CREATE POLICY "user_badges_public" ON user_badges FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = user_badges.user_id)
);

-- follows: Kullanıcı kendi takip ilişkilerini yönetebilir, iki taraflı görüntülenebilir
DROP POLICY IF EXISTS "follows_manage" ON follows;
CREATE POLICY "follows_manage" ON follows FOR ALL USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_view" ON follows;
CREATE POLICY "follows_view" ON follows FOR SELECT USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- artist_follow_playlists: Kullanıcı kendi sanatçı takip playlistlerini görebilir
DROP POLICY IF EXISTS "artist_follow_own" ON artist_follow_playlists;
CREATE POLICY "artist_follow_own" ON artist_follow_playlists FOR ALL USING (auth.uid() = user_id);

-- 7. SEED DATA - ROZET TANIMLARI (16 adet)
-- ============================================
INSERT INTO badge_definitions (id, name, description, icon, category, requirement, is_premium, rarity) VALUES
  ('first_play', 'İlk Adım', 'İlk şarkınızı dinlediniz', '🎵', 'listening', '{"type":"count","metric":"total_plays","threshold":1}', false, 'common'),
  ('top_listener_100', 'Dinleyici', '100 şarkı dinlediniz', '🎧', 'listening', '{"type":"count","metric":"total_plays","threshold":100}', false, 'common'),
  ('top_listener_1k', 'Çok Dinleyen', '1.000 şarkı dinlediniz', '🏆', 'listening', '{"type":"count","metric":"total_plays","threshold":1000}', false, 'rare'),
  ('top_listener_10k', 'Müzik Bağımlısı', '10.000 şarkı dinlediniz', '💎', 'listening', '{"type":"count","metric":"total_plays","threshold":10000}', false, 'epic'),
  ('playlist_creator_1', 'Koleksiyoner', 'İlk çalma listenizi oluşturdunuz', '📋', 'social', '{"type":"count","metric":"playlists_created","threshold":1}', false, 'common'),
  ('playlist_creator_10', 'Kuratör', '10 çalma listesi oluşturdunuz', '🎯', 'social', '{"type":"count","metric":"playlists_created","threshold":10}', false, 'rare'),
  ('liked_50', 'Beğenici', '50 şarkı beğendiniz', '❤️', 'listening', '{"type":"count","metric":"liked_songs","threshold":50}', false, 'common'),
  ('liked_500', 'Sevgi Dolu', '500 şarkı beğendiniz', '💖', 'listening', '{"type":"count","metric":"liked_songs","threshold":500}', false, 'rare'),
  ('follower_10', 'Popüler', '10 takipçiniz oldu', '👥', 'social', '{"type":"count","metric":"followers","threshold":10}', false, 'common'),
  ('follower_100', 'Etkileyici', '100 takipçiniz oldu', '⭐', 'social', '{"type":"count","metric":"followers","threshold":100}', false, 'rare'),
  ('follower_1k', 'Yıldız', '1.000 takipçiniz oldu', '✨', 'social', '{"type":"count","metric":"followers","threshold":1000}', false, 'epic'),
  ('artist_first_upload', 'İlk Şarkı', 'İlk şarkınız onaylandı', '🎤', 'artist', '{"type":"count","metric":"approved_songs","threshold":1}', false, 'common'),
  ('artist_10_songs', 'Üretken Sanatçı', '10 şarkınız onaylandı', '🎼', 'artist', '{"type":"count","metric":"approved_songs","threshold":10}', false, 'rare'),
  ('early_adopter', 'Erken Kullanıcı', 'İlk 100 kullanıcı arasındasınız', '🌟', 'special', '{"type":"account_order","threshold":100}', false, 'legendary'),
  ('premium_member', 'Premium Üye', 'Premium üyeliğiniz aktif', '💎', 'premium', '{"type":"subscription","active":true}', true, 'epic'),
  ('year_1', '1 Yıl', 'Hesabınızın 1. yıl dönümü', '🎂', 'special', '{"type":"account_age","threshold_days":365}', false, 'rare')
ON CONFLICT (id) DO NOTHING;

-- 8. BADGE PROGRESS FONKSİYONU (RPC ile çağrılacak)
-- ============================================
CREATE OR REPLACE FUNCTION update_user_badge_progress(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  bd record;
  current_value int;
  threshold int;
BEGIN
  FOR bd IN SELECT * FROM badge_definitions WHERE NOT is_premium LOOP
    threshold := (bd.requirement->>'threshold')::int;
    
    CASE bd.requirement->>'metric'
      WHEN 'total_plays' THEN
        SELECT COALESCE(SUM(play_count),0) INTO current_value FROM listening_history WHERE user_id = p_user_id;
      WHEN 'playlists_created' THEN
        SELECT COUNT(*) INTO current_value FROM playlists WHERE user_id = p_user_id;
      WHEN 'liked_songs' THEN
        SELECT COUNT(*) INTO current_value FROM liked_songs WHERE user_id = p_user_id;
      WHEN 'followers' THEN
        SELECT COUNT(*) INTO current_value FROM follows WHERE following_id = p_user_id AND status = 'accepted';
      WHEN 'approved_songs' THEN
        SELECT COUNT(*) INTO current_value FROM songs WHERE artist_id = p_user_id AND status = 'approved';
      ELSE current_value := 0;
    END CASE;
    
    INSERT INTO user_badges (user_id, badge_id, progress, earned_at)
    VALUES (p_user_id, bd.id, 
      LEAST(100, (current_value::float / NULLIF(threshold,0) * 100)::int),
      CASE WHEN current_value >= threshold THEN now() ELSE NULL END
    )
    ON CONFLICT (user_id, badge_id) DO UPDATE SET
      progress = LEAST(100, (current_value::float / NULLIF(threshold,0) * 100)::int),
      earned_at = CASE 
        WHEN current_value >= threshold AND user_badges.earned_at IS NULL THEN now()
        ELSE user_badges.earned_at
      END;
  END LOOP;
END $$;