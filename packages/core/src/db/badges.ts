// Rozetler: tanımlar ve kullanıcının kazandıkları.

import type { BekofyClient } from '../client';
import type { Tables } from './database.types';
import { must } from './errors';

export type BadgeDefinition = Tables<'badge_definitions'>;

export async function badgeDefinitions(sb: BekofyClient): Promise<BadgeDefinition[]> {
  return must(await sb.from('badge_definitions').select('*').order('category').order('name'), 'Rozetler alınamadı');
}

export async function userBadges(sb: BekofyClient, userId: string) {
  const rows = must(
    await sb.from('user_badges').select('earned_at, progress, badge:badge_definitions(*)').eq('user_id', userId).order('earned_at', { ascending: false }),
    'Rozetler alınamadı',
  );
  return rows.flatMap((r) => (r.badge ? [{ ...r.badge, earned_at: r.earned_at, progress: r.progress }] : []));
}
