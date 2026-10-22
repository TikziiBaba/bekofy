-- RLS ve depolama izinleri denetimi. Gizli bilgi içermez; çıktıyı paylaşabilirsin.
-- Supabase SQL Editor'de çalıştır. Üç sonuç tablosu döner.

-- 1) public şemasındaki tablolarda RLS açık mı?
select c.relname as tablo, c.relrowsecurity as rls_acik
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- 2) Tablo ve depolama politikaları
select schemaname as sema, tablename as tablo, policyname as politika, cmd as islem,
       roles as roller, qual as okuma_kosulu, with_check as yazma_kosulu
from pg_policies
where schemaname in ('public', 'storage')
order by 1, 2, 3;

-- 3) Depolama alanları (bucket) herkese açık mı?
select id as bucket, public as herkese_acik, file_size_limit as boyut_siniri, allowed_mime_types as izinli_turler
from storage.buckets
order by 1;
