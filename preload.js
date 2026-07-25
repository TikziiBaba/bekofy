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
  // Mini Player Window APIs
  sendMiniCommand: (command, data) => ipcRenderer.send('mini-player-command', command, data),
  onMiniPlayerUpdate: (callback) => ipcRenderer.on('mini-player-update', (event, data) => callback(data)),
  onMiniPlayerProgress: (callback) => ipcRenderer.on('mini-player-progress', (event, data) => callback(data)),
  
  // File & R2 actions
  uploadToR2: (filePath, fileName) => ipcRenderer.invoke('upload-to-r2', filePath, fileName),
  downloadConvertUploadR2: (url, title, artist) => ipcRenderer.invoke('download-convert-upload-r2', url, title, artist),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  // Navigation
  onAppGoBack: (callback) => ipcRenderer.on('app-go-back', () => callback()),
  // Auto Update
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, data) => callback(data)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-download-progress', (event, data) => callback(data)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, data) => callback(data)),
  installUpdate: () => ipcRenderer.send('install-update'),
});
