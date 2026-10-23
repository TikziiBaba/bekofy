// GitHub sürümlerinden otomatik güncelleme. İndirme arka planda; kurulum kullanıcı onayıyla ya da çıkışta.

import { app } from 'electron';
import electronUpdater from 'electron-updater';
import type { UpdateStatus } from '../shared/ipc';

const { autoUpdater } = electronUpdater;

export function startUpdater(send: (status: UpdateStatus) => void): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  let version = '';
  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => {
    version = info.version;
    send({ state: 'available', version });
  });
  autoUpdater.on('update-not-available', () => send({ state: 'idle' }));
  autoUpdater.on('download-progress', (p) => send({ state: 'downloading', version, percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => send({ state: 'ready', version: info.version }));
  autoUpdater.on('error', (err) => {
    console.error('[updater]', err);
    send({ state: 'error', message: 'Güncelleme denetlenemedi.' });
  });
  const check = () => autoUpdater.checkForUpdates().catch(() => undefined);
  void check();
  setInterval(check, 4 * 60 * 60 * 1000);
}

export function installUpdate(): void {
  if (app.isPackaged) setImmediate(() => autoUpdater.quitAndInstall());
}
