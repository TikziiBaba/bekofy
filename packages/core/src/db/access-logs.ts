// Giriş kayıtları (admin terminali). Bilinçli olarak IP ve konum tutulmaz.

import type { BekofyClient } from '../client';
import type { Platform } from '../platform';
import { check, must } from './errors';

export async function logAccess(sb: BekofyClient, userId: string, { platform, appVersion, userAgent }: { platform: Platform; appVersion?: string; userAgent?: string }): Promise<void> {
  check(
    await sb.from('user_access_logs').insert({ user_id: userId, platform, app_version: appVersion?.slice(0, 32) ?? null, user_agent: userAgent?.slice(0, 400) ?? null }),
    'Giriş kaydedilemedi',
  );
}

/** Admin: en son girişler, kullanıcı adıyla. */
export async function recentAccessLogs(sb: BekofyClient, { userId, limit = 50 }: { userId?: string; limit?: number } = {}) {
  let q = sb.from('user_access_logs').select('*, user:profiles!user_access_logs_user_id_fkey(id, username)').order('created_at', { ascending: false }).limit(limit);
  if (userId) q = q.eq('user_id', userId);
  return must(await q, 'Giriş kayıtları alınamadı');
}
