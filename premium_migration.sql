-- ===== Bekofy Premium Migration =====
-- Run this in Supabase SQL Editor

-- Add premium fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme text DEFAULT 'default';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_frame text DEFAULT 'none';
