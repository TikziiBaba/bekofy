import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, type BekofyClient, type Database } from '@bekofy/core';
import { cookies } from 'next/headers';

/** Sunucu bileşenleri, Server Action'lar ve route'lar için: oturum çerezden okunur, yetkiyi RLS denetler. */
export async function createClient(): Promise<BekofyClient> {
  const store = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Sunucu bileşeninden çağrıldıysa çerez yazılamaz; oturumu proxy.ts yeniler.
        }
      },
    },
  });
}
