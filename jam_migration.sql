-- =====================================================
-- Bekofy - Jam (Birlikte Dinleme) Migration
-- Bu SQL'i Supabase SQL Editor'da çalıştırın
-- =====================================================

-- 1. Jam Sessions tablosu
CREATE TABLE IF NOT EXISTS jam_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  host_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  current_song_id uuid REFERENCES songs(id) ON DELETE SET NULL,
  is_playing boolean DEFAULT false,
  current_position float DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE jam_sessions ENABLE ROW LEVEL SECURITY;

-- Herkes aktif oturumları görebilir (koda göre arama yapabilmek için)
DROP POLICY IF EXISTS "Anyone can view jam sessions" ON jam_sessions;
CREATE POLICY "Anyone can view jam sessions" ON jam_sessions
  FOR SELECT USING (true);

-- Sadece giriş yapmış kullanıcılar oluşturabilir
DROP POLICY IF EXISTS "Authenticated users can create jam sessions" ON jam_sessions;
CREATE POLICY "Authenticated users can create jam sessions" ON jam_sessions
  FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Sadece host güncelleyebilir
DROP POLICY IF EXISTS "Host can update jam session" ON jam_sessions;
CREATE POLICY "Host can update jam session" ON jam_sessions
  FOR UPDATE USING (auth.uid() = host_id);

-- Sadece host silebilir
DROP POLICY IF EXISTS "Host can delete jam session" ON jam_sessions;
CREATE POLICY "Host can delete jam session" ON jam_sessions
  FOR DELETE USING (auth.uid() = host_id);

-- 2. Jam Participants tablosu
CREATE TABLE IF NOT EXISTS jam_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES jam_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(session_id, user_id)
);

ALTER TABLE jam_participants ENABLE ROW LEVEL SECURITY;

-- Herkes katılımcıları görebilir
DROP POLICY IF EXISTS "Anyone can view jam participants" ON jam_participants;
CREATE POLICY "Anyone can view jam participants" ON jam_participants
  FOR SELECT USING (true);

-- Giriş yapan kullanıcı katılabilir
DROP POLICY IF EXISTS "Authenticated users can join jam" ON jam_participants;
CREATE POLICY "Authenticated users can join jam" ON jam_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Kullanıcı kendini çıkarabilir veya host herkesi çıkarabilir
DROP POLICY IF EXISTS "User can leave or host can remove" ON jam_participants;
CREATE POLICY "User can leave or host can remove" ON jam_participants
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM jam_sessions WHERE id = session_id AND host_id = auth.uid())
  );
