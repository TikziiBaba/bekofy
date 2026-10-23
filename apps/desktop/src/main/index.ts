// Bekofy masaüstü: ana süreç. Pencereler, IPC, çevrimdışı indirme, Discord, güncelleyici, mini oynatıcı.

import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { CHANNELS, DEEP_LINK_SCHEME, type MiniCommand, type PlayerSnapshot } from '../shared/ipc';
import { coverSeed } from './covers';
import { discord } from './discord';
import { download, handleMediaScheme, listOffline, registerMediaScheme, remove } from './offline';
import { lockPermissions, openExternal } from './security';
import { installUpdate, startUpdater } from './updater';
import { createMainWindow, createMiniWindow, setTitleBarTheme } from './windows';

if (process.platform === 'win32') app.setAppUserModelId('com.bekofy.app');

// Testler kendi veri klasörüyle çalışır (gerçek oturum ve indirmelere dokunmaz). Yalnızca paketlenmemiş uygulamada.
if (!app.isPackaged && process.env.BEKOFY_USER_DATA) app.setPath('userData', process.env.BEKOFY_USER_DATA);

// Tek kopya: ikinci açılış (ör. bekofy:// bağlantısı) mevcut pencereye yönlenir.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

registerMediaScheme();

// bekofy:// bağlantılarını bu uygulama açar (Google girişinden dönüş).
if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [join(process.cwd(), process.argv[1])]);
else app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);

let main: BrowserWindow | null = null;
let mini: BrowserWindow | null = null;
let pendingDeepLink: string | null = null;
/** Son oynatıcı durumu: mini oynatıcı açılınca hemen gösterilir. */
let lastSnapshot: PlayerSnapshot | null = null;

const alive = (w: BrowserWindow | null): w is BrowserWindow => Boolean(w && !w.isDestroyed());
const deepLinkFrom = (argv: string[]) => argv.find((a) => a.startsWith(`${DEEP_LINK_SCHEME}://`)) ?? null;

function deliverDeepLink(url: string | null): void {
  if (!url) return;
  if (alive(main) && !main.webContents.isLoading()) main.webContents.send(CHANNELS.authCallback, url);
  else pendingDeepLink = url;
}

function focusMain(): void {
  if (!alive(main)) return;
  if (main.isMinimized()) main.restore();
  main.show();
  main.focus();
}

function openMain(): void {
  main = createMainWindow();
  main.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) deliverDeepLink(pendingDeepLink);
    pendingDeepLink = null;
  });
  main.on('closed', () => {
    main = null;
    if (alive(mini)) mini.close();
  });
}

function toggleMini(): void {
  if (alive(mini)) {
    mini.close();
    return;
  }
  mini = createMiniWindow();
  mini.webContents.on('did-finish-load', () => {
    if (alive(mini) && lastSnapshot) mini.webContents.send(CHANNELS.miniSnapshot, lastSnapshot);
  });
  mini.on('closed', () => {
    mini = null;
    if (alive(main)) main.webContents.send(CHANNELS.miniVisibility, false);
    focusMain();
  });
  if (alive(main)) {
    main.webContents.send(CHANNELS.miniVisibility, true);
    main.minimize();
  }
}

/* ---------- IPC: yalnızca ana pencereden ya da mini oynatıcıdan gelen istekler ---------- */
const fromMain = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => alive(main) && e.sender === main.webContents;
const fromMini = (e: Electron.IpcMainEvent) => alive(mini) && e.sender === mini.webContents;

ipcMain.on(CHANNELS.setTheme, (e, mode: unknown) => {
  if (fromMain(e) && (mode === 'dark' || mode === 'light') && alive(main)) setTitleBarTheme(main, mode);
});
ipcMain.handle(CHANNELS.openExternal, (_e, url: unknown) => openExternal(url));
ipcMain.on(CHANNELS.miniToggle, (e) => {
  if (fromMain(e) || fromMini(e)) toggleMini();
});
ipcMain.on(CHANNELS.miniPublish, (e, snapshot: PlayerSnapshot) => {
  if (!fromMain(e)) return;
  lastSnapshot = snapshot;
  if (alive(mini)) mini.webContents.send(CHANNELS.miniSnapshot, snapshot);
});
ipcMain.on(CHANNELS.miniCommand, (e, command: MiniCommand) => {
  if (!fromMini(e)) return;
  if (command === 'open-main' || command === 'close') {
    mini?.close();
    return;
  }
  if (alive(main) && ['toggle-play', 'next', 'previous'].includes(command)) main.webContents.send(CHANNELS.miniCommand, command);
});
ipcMain.on(CHANNELS.discordActivity, (e, snapshot: PlayerSnapshot | null) => {
  if (fromMain(e)) discord.update(snapshot);
});
ipcMain.on(CHANNELS.discordEnabled, (e, enabled: unknown) => {
  if (fromMain(e)) discord.setEnabled(enabled === true);
});
ipcMain.handle(CHANNELS.offlineList, (e) => (fromMain(e) ? listOffline() : []));
ipcMain.handle(CHANNELS.offlineDownload, (e, request) => {
  if (!fromMain(e)) return { ok: false, error: 'İzin yok.' };
  return download(request, (event) => alive(main) && main.webContents.send(CHANNELS.offlineEvent, event));
});
ipcMain.handle(CHANNELS.offlineRemove, (e, id: unknown) => (fromMain(e) ? remove(id) : undefined));
ipcMain.handle(CHANNELS.coverSeed, (e, url: unknown) => (fromMain(e) ? coverSeed(url) : null));
ipcMain.on(CHANNELS.updateInstall, (e) => {
  if (fromMain(e)) installUpdate();
});

/* ---------- Yaşam döngüsü ---------- */
app.on('second-instance', (_e, argv) => {
  focusMain();
  deliverDeepLink(deepLinkFrom(argv));
});
app.on('open-url', (event, url) => {
  event.preventDefault();
  deliverDeepLink(url);
});

void app.whenReady().then(() => {
  lockPermissions();
  handleMediaScheme();
  pendingDeepLink = deepLinkFrom(process.argv);
  openMain();
  discord.start();
  startUpdater((status) => alive(main) && main.webContents.send(CHANNELS.updateStatus, status));
});

app.on('window-all-closed', () => {
  void discord.stop().finally(() => app.quit());
});

app.on('activate', () => {
  if (!alive(main)) openMain();
});
