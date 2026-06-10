-- =====================================================
-- Bekofy - Friend Activity Migration
-- Bu SQL'i Supabase SQL Editor'da çalıştırın
-- =====================================================

-- 1. Profiles tablosuna aktivite sütunlarını ekle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_song_id uuid REFERENCES songs(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_playing boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_activity timestamptz DEFAULT now();

-- Not: profiles tablosunda zaten gerekli okuma politikaları ('Everyone can view profiles' vb.) bulunuyor olmalı.
-- Kullanıcı kendi profilini zaten güncelleyebiliyor olmalı ('Users can update own profile').
