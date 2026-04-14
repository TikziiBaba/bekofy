-- =====================================================
-- Bekofy - Şarkı Sözleri (Lyrics) Migration
-- Bu SQL'i Supabase SQL Editor'da çalıştırın
-- =====================================================

-- songs tablosuna lyrics sütunları ekle
ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics text;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS synced_lyrics text;
