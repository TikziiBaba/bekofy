const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  navigateToApp: () => ipcRenderer.send('navigate-to-app'),
  navigateToAuth: () => ipcRenderer.send('navigate-to-auth'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  // Offline download
  downloadSong: (songData) => ipcRenderer.invoke('download-song', songData),
  getOfflineSongs: () => ipcRenderer.invoke('get-offline-songs'),
  deleteOfflineSong: (songId) => ipcRenderer.invoke('delete-offline-song', songId),
  // Discord Rich Presence
  updateDiscordRPC: (songData) => ipcRenderer.send('update-discord-rpc', songData),
  clearDiscordRPC: () => ipcRenderer.send('clear-discord-rpc'),
  // Mini Player
  toggleMiniPlayer: () => ipcRenderer.send('toggle-mini-player'),
  updateMiniPlayer: (data) => ipcRenderer.send('update-mini-player', data),
  updateMiniPlayerProgress: (data) => ipcRenderer.send('update-mini-player-progress', data),
  // Listen for mini player commands
  onMiniCommand: (callback) => ipcRenderer.on('mini-command', (event, command, data) => callback(command, data)),
});
