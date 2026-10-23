// Pencere güvenliği: arayüz başka adrese gidemez, yeni pencere açamaz, izin isteyemez.
// Dış bağlantılar yalnızca izinli https adreslerinde sistem tarayıcısında açılır.

import { session, shell, type WebContents } from 'electron';
import { EXTERNAL_HOSTS } from './config';

export function isAllowedExternal(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && EXTERNAL_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function openExternal(raw: unknown): Promise<boolean> {
  if (!isAllowedExternal(raw)) return false;
  await shell.openExternal(raw);
  return true;
}

/** devUrl: geliştirme sunucusu (yalnızca geliştirmede); başka her adrese gitme engellenir. */
export function harden(contents: WebContents, devUrl: string | undefined): void {
  contents.on('will-navigate', (event, url) => {
    if (devUrl && url.startsWith(devUrl)) return;
    if (url.startsWith('file://')) return;
    event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    void openExternal(url);
    return { action: 'deny' };
  });
}

export function lockPermissions(): void {
  // Uygulama kamera, mikrofon, konum, bildirim gibi izinlere ihtiyaç duymaz; yalnızca Jam kodunu panoya kopyalar.
  const allowed = new Set(['clipboard-sanitized-write']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));
}
