// Supabase istemcisi. Oturum depolaması platforma göre dışarıdan verilir:
// web ve masaüstü varsayılan localStorage'ı kullanır, mobil kendi güvenli depolamasını geçirir.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { Database } from './db/database.types';

export type BekofyClient = SupabaseClient<Database>;

/** Supabase'in beklediği anahtar-değer deposu; eşzamanlı ya da Promise döndüren uygulamalar olabilir. */
export interface SessionStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface ClientOptions {
  url?: string;
  anonKey?: string;
  /** Verilmezse tarayıcıda localStorage kullanılır. */
  storage?: SessionStorage;
  /** Çoklu hesap: her hesabın oturumu ayrı anahtarda tutulur. Bkz. accountStorageKey(). */
  storageKey?: string;
  /** Web'de OAuth dönüşü için true; masaüstü ve mobilde false. */
  detectSessionInUrl?: boolean;
}

export function createBekofyClient(options: ClientOptions = {}): BekofyClient {
  const url = options.url ?? SUPABASE_URL;
  const anonKey = options.anonKey ?? SUPABASE_ANON_KEY;
  return createClient<Database>(url, anonKey, {
    auth: {
      storage: options.storage,
      storageKey: options.storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: options.detectSessionInUrl ?? false,
    },
  });
}

/** Çoklu hesapta her hesap için ayrı oturum anahtarı. */
export function accountStorageKey(slot: string): string {
  return `bekofy-auth-${slot}`;
}

/** Bellekte tutulan depo: testler ve sunucu tarafı çizim için. */
export function memoryStorage(): SessionStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}
