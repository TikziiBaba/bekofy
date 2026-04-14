-- =====================================================
-- Sanatçılar tablosu (Admin Panel için)
-- Bu SQL'i Supabase SQL Editor'da çalıştırın
-- =====================================================

-- Sanatçılar tablosu (auth.users'a bağlı DEĞİL)
CREATE TABLE IF NOT EXISTS artists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE artists ENABLE ROW LEVEL SECURITY;

-- Herkes sanatçıları görebilsin (uygulamada arama vs. için)
DROP POLICY IF EXISTS "Everyone can read artists" ON artists;
CREATE POLICY "Everyone can read artists" ON artists
  FOR SELECT USING (true);

-- Admin/yetkili sanatçı ekleyip düzenleyebilsin
DROP POLICY IF EXISTS "Admins can manage artists" ON artists;
CREATE POLICY "Admins can manage artists" ON artists
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'yetkili'))
  );
