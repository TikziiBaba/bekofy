// Ana pencere ve mini oynatıcı penceresi.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dark, light } from '@bekofy/tokens';
import { app, BrowserWindow, screen } from 'electron';
import { harden } from './security';

const here = fileURLToPath(new URL('.', import.meta.url));
const devUrl = process.env.ELECTRON_RENDERER_URL;
const preload = join(here, '../preload/index.cjs');
const icon = join(here, '../../resources/icon.png');

const TITLE_BAR_HEIGHT = 40;
const overlay = (mode: 'dark' | 'light') => {
  const t = mode === 'dark' ? dark : light;
  return { color: 'rgba(0, 0, 0, 0)', symbolColor: t.color.text.primary, height: TITLE_BAR_HEIGHT };
};

const webPreferences = () => ({
  preload,
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  spellcheck: false,
  additionalArguments: [`--bekofy-version=${app.getVersion()}`],
});

function load(win: BrowserWindow, page: 'index' | 'mini'): void {
  if (devUrl) void win.loadURL(`${devUrl}/${page}.html`);
  else void win.loadFile(join(here, `../renderer/${page}.html`));
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 940,
    minHeight: 620,
    show: false,
    backgroundColor: dark.color.surface.page,
    title: 'Bekofy',
    icon,
    // Windows'un kendi pencere düğmeleri (yerleşim önerileri ve erişilebilirlik korunur), renkleri temaya uyar.
    titleBarStyle: 'hidden',
    titleBarOverlay: overlay('dark'),
    webPreferences: webPreferences(),
  });
  harden(win.webContents, devUrl);
  win.once('ready-to-show', () => win.show());
  load(win, 'index');
  return win;
}

export function setTitleBarTheme(win: BrowserWindow, mode: 'dark' | 'light'): void {
  if (process.platform === 'win32' || process.platform === 'linux') win.setTitleBarOverlay(overlay(mode));
  win.setBackgroundColor((mode === 'dark' ? dark : light).color.surface.page);
}

export function createMiniWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 380;
  const height = 104;
  const win = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + workArea.height - height - 24,
    frame: false,
    resizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: dark.color.surface.raised,
    title: 'Bekofy mini oynatıcı',
    icon,
    webPreferences: webPreferences(),
  });
  harden(win.webContents, devUrl);
  win.once('ready-to-show', () => win.showInactive());
  load(win, 'mini');
  return win;
}
