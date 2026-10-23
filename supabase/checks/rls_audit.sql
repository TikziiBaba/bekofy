-- RLS, depolama, fonksiyon ve tetikleyici denetimi. Gizli bilgi içermez.
-- Supabase SQL Editor yalnızca son sorgunun sonucunu gösterdiği için hepsi TEK sorguda, tek tabloda döner.
-- Çalıştır, sonuç tablosunun üstündeki "Export" > "Download CSV" ile indir ve
-- supabase/checks/rls_audit_output.csv olarak kaydet (git'e girmez).

with tablolar as (
  select 'tablo'::text as tur,
         c.relname::text as ad,
         case when c.relrowsecurity then 'RLS açık' else 'RLS KAPALI' end as detay,
         ''::text as kosul,
         ''::text as yazma_kosulu
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
politikalar as (
  select 'politika',
         schemaname || '.' || tablename || ' / ' || policyname,
         cmd || ' / ' || array_to_string(roles::text[], ','),
         coalesce(qual, ''),
         coalesce(with_check, '')
  from pg_policies
  where schemaname in ('public', 'storage')
),
alanlar as (
  select 'depolama',
         id::text,
         case when public then 'herkese açık' else 'özel' end || coalesce(' / sınır ' || file_size_limit, ''),
         coalesce(array_to_string(allowed_mime_types, ','), ''),
         ''
  from storage.buckets
),
fonksiyonlar as (
  select 'fonksiyon',
         p.proname::text,
         case when p.prosecdef then 'security definer' else 'invoker' end,
         coalesce(array_to_string(p.proacl::text[], ','), 'varsayılan izinler'),
         ''
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
tetikleyiciler as (
  select 'tetikleyici',
         (event_object_schema || '.' || event_object_table || ' / ' || trigger_name)::text,
         (action_timing || ' ' || event_manipulation)::text,
         action_statement::text,
         ''
  from information_schema.triggers
  where event_object_schema in ('public', 'auth')
)
select * from tablolar
union all select * from politikalar
union all select * from alanlar
union all select * from fonksiyonlar
union all select * from tetikleyiciler
order by 1, 2;
