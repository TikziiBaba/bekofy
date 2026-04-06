-- =====================================================
-- Bekofy - Yeni Özellikler SQL Migrations
-- Bu SQL'i Supabase SQL Editor'da çalıştırın
-- =====================================================

-- 1. Profiles tablosuna is_banned sütunu ekle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;

-- 2. Reserved Usernames tablosu
CREATE TABLE IF NOT EXISTS reserved_usernames (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  added_by uuid REFERENCES auth.users(id)
);

ALTER TABLE reserved_usernames ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (kayıt olurken kontrol için)
DROP POLICY IF EXISTS "Everyone can read reserved names" ON reserved_usernames;
CREATE POLICY "Everyone can read reserved names" ON reserved_usernames
  FOR SELECT USING (true);

-- Sadece admin/yetkili ekleyip silebilir
DROP POLICY IF EXISTS "Admins can manage reserved names" ON reserved_usernames;
CREATE POLICY "Admins can manage reserved names" ON reserved_usernames
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'yetkili'))
  );

-- 3. Friendships tablosu
CREATE TABLE IF NOT EXISTS friendships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can insert friendships" ON friendships;
CREATE POLICY "Users can insert friendships" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own friendships" ON friendships;
CREATE POLICY "Users can update own friendships" ON friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;
CREATE POLICY "Users can delete own friendships" ON friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 4. Blocked Users tablosu
CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, blocked_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blocks" ON blocked_users;
CREATE POLICY "Users can view own blocks" ON blocked_users
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert blocks" ON blocked_users;
CREATE POLICY "Users can insert blocks" ON blocked_users
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own blocks" ON blocked_users;
CREATE POLICY "Users can delete own blocks" ON blocked_users
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Admin ban politikası (admin/yetkili profiles update edebilsin)
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'yetkili'))
  );

-- 6. Admin delete politikası
DROP POLICY IF EXISTS "Admins can delete any profile" ON profiles;
CREATE POLICY "Admins can delete any profile" ON profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'yetkili'))
  );
