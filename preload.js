const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  navigateToApp: () => ipcRenderer.send('navigate-to-app'),
  navigateToAuth: () => ipcRenderer.send('navigate-to-auth'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
});
