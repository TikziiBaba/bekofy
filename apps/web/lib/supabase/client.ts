import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, type BekofyClient, type Database } from '@bekofy/core';

/** Tarayıcı istemcisi. Oturum çerezde tutulur; sunucu aynı oturumu görür. */
export function getBrowserClient(): BekofyClient {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
