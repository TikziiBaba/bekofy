import { StatusPill } from '@bekofy/ui';

const STATUS = {
  approved: { tone: 'ok', label: 'Yayında' },
  pending: { tone: 'pending', label: 'Onay bekliyor' },
  rejected: { tone: 'off', label: 'Reddedildi' },
} as const;

export function SongStatus({ status }: { status: string }) {
  const s = STATUS[status as keyof typeof STATUS] ?? { tone: 'neutral' as const, label: status };
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
}
