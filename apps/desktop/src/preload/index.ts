// Arayüze açılan tek köprü. Yalnızca tanımlı kanallar; her dinleyici için kapatma fonksiyonu döner.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { CHANNELS, MEDIA_SCHEME, type BekofyBridge } from '../shared/ipc';

const listen =
  <T>(channel: string) =>
  (cb: (payload: T) => void) => {
    const handler = (_e: IpcRendererEvent, payload: T) => cb(payload);
    ipcRenderer.on(channel, handler);
    return () => void ipcRenderer.removeListener(channel, handler);
  };

const bridge: BekofyBridge = {
  platform: process.platform,
  // Sürüm, ana süreçten webPreferences.additionalArguments ile gelir.
  version: process.argv.find((a) => a.startsWith('--bekofy-version='))?.split('=')[1] ?? '',
  window: {
    setTheme: (mode) => ipcRenderer.send(CHANNELS.setTheme, mode),
  },
  openExternal: (url) => ipcRenderer.invoke(CHANNELS.openExternal, url),
  auth: { onCallback: listen<string>(CHANNELS.authCallback) },
  mini: {
    toggle: () => ipcRenderer.send(CHANNELS.miniToggle),
    publish: (snapshot) => ipcRenderer.send(CHANNELS.miniPublish, snapshot),
    onCommand: listen(CHANNELS.miniCommand),
    onVisibility: listen<boolean>(CHANNELS.miniVisibility),
  },
  miniWindow: {
    onSnapshot: listen(CHANNELS.miniSnapshot),
    command: (command) => ipcRenderer.send(CHANNELS.miniCommand, command),
  },
  discord: {
    setActivity: (snapshot) => ipcRenderer.send(CHANNELS.discordActivity, snapshot),
    setEnabled: (enabled) => ipcRenderer.send(CHANNELS.discordEnabled, enabled),
  },
  offline: {
    list: () => ipcRenderer.invoke(CHANNELS.offlineList),
    download: (request) => ipcRenderer.invoke(CHANNELS.offlineDownload, request),
    remove: (id) => ipcRenderer.invoke(CHANNELS.offlineRemove, id),
    onEvent: listen(CHANNELS.offlineEvent),
    mediaUrl: (id) => `${MEDIA_SCHEME}://song/${encodeURIComponent(id)}`,
  },
  covers: { seed: (url) => ipcRenderer.invoke(CHANNELS.coverSeed, url) },
  updates: {
    onStatus: listen(CHANNELS.updateStatus),
    install: () => ipcRenderer.send(CHANNELS.updateInstall),
  },
};

contextBridge.exposeInMainWorld('bekofy', bridge);
