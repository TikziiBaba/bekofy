-- =====================================================
-- Bekofy - Kullanıcı IP & Cihaz Günlükleri SQL Migration
-- Bu SQL'i Supabase SQL Editor'da çalıştırın
-- =====================================================

-- 1. User Access Logs Tablosu
CREATE TABLE IF NOT EXISTS user_access_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  ip_address text,
  user_agent text,
  device_info text,
  screen_res text,
  language text,
  timezone text,
  city text,
  country text,
  created_at timestamptz DEFAULT now()
);

-- Profiles tablosuna son IP ve son giriş zamanı sütunlarını ekle (varsa es geç)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_ip text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 2. Row Level Security (RLS) Etkinleştirme
ALTER TABLE user_access_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Politikaları
-- Her kullanıcı kendi erişim kaydını ekleyebilir
DROP POLICY IF EXISTS "Users can insert own access logs" ON user_access_logs;
CREATE POLICY "Users can insert own access logs" ON user_access_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Yöneticiler (admin/yetkili) tüm erişim günlüklerini okuyabilir
DROP POLICY IF EXISTS "Admins can view all access logs" ON user_access_logs;
CREATE POLICY "Admins can view all access logs" ON user_access_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'yetkili'))
  );

-- 4. Performans İndeksleri
CREATE INDEX IF NOT EXISTS idx_user_access_logs_user_id ON user_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_logs_created_at ON user_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_access_logs_ip_address ON user_access_logs(ip_address);
