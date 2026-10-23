'use client';

import { Select, Switch } from '@bekofy/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateUser } from '@/app/actions/admin';
import { showToast } from '@/components/toast';

const ROLE_LABELS: Record<string, string> = { user: 'Kullanıcı', premium: 'Premium', artist: 'Sanatçı', admin: 'Admin', yetkili: 'Yetkili' };

/** Bir kullanıcının rol, Premium ve askı denetimleri. Kendi satırında rol ve askı kilitlidir. */
export function UserControls({ id, username, role, premium, banned, self }: { id: string; username: string; role: string; premium: boolean; banned: boolean; self: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function apply(change: { role?: string; premium?: boolean; banned?: boolean }, success: string) {
    setBusy(true);
    const res = await updateUser(id, change);
    setBusy(false);
    showToast(res.ok ? success : res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3" aria-busy={busy || undefined}>
      <label className="flex items-center gap-2 type-body-sm">
        <span className="text-fg-muted">Rol</span>
        <span className="w-36">
          <Select value={role} disabled={busy || self} aria-describedby={self ? `self-${id}` : undefined} onChange={(e) => apply({ role: e.target.value }, `@${username} rolü ${ROLE_LABELS[e.target.value] ?? e.target.value} oldu.`)}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </span>
      </label>
      <span className="flex items-center gap-2 type-body-sm">
        <span id={`premium-${id}`} className="text-fg-muted">
          Premium
        </span>
        <Switch checked={premium} disabled={busy} aria-labelledby={`premium-${id}`} onCheckedChange={(v) => apply({ premium: v }, v ? `@${username} Premium oldu.` : `@${username} Premium’dan çıkarıldı.`)} />
      </span>
      <span className="flex items-center gap-2 type-body-sm">
        <span id={`banned-${id}`} className="text-fg-muted">
          Askıda
        </span>
        <Switch checked={banned} disabled={busy || self} aria-labelledby={`banned-${id}`} onCheckedChange={(v) => apply({ banned: v }, v ? `@${username} askıya alındı.` : `@${username} askıdan çıkarıldı.`)} />
      </span>
      {self ? (
        <span id={`self-${id}`} className="type-caption text-fg-muted">
          Bu sensin: rolünü ve askını buradan değiştiremezsin.
        </span>
      ) : null}
    </div>
  );
}
