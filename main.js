const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { autoUpdater } = require('electron-updater');
const { execSync } = require('child_process');
const { initDiscordRPC, updatePresence, clearPresence, destroyRPC } = require('./src/js/discord-rpc');

function isAppRunningAsAdmin() {
  if (process.platform !== 'win32') return false;
  try {
    execSync('net session', { stdio: 'ignore', windowsHide: true });
    return true;
  } catch (e) {
    return false;
  }
}

let mainWindow;
let splashWindow;
let miniPlayerWindow = null;

// Clean corrupt cache on startup
function cleanCache() {
  const userDataPath = app.getPath('userData');
  const cacheDirs = ['Cache', 'GPUCache', 'Code Cache', 'DawnCache'];
  cacheDirs.forEach(dir => {
    const cachePath = path.join(userDataPath, dir);
    try {
      if (fs.existsSync(cachePath)) {
        fs.rmSync(cachePath, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
  });
}

function createWindow() {
  // Create Splash Window
  splashWindow = new BrowserWindow({
    width: 600,
    height: 450,
    frame: false,
    transparent: true,
    backgroundColor: '#0a0a0a',
    alwaysOnTop: true,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  const isAdmin = isAppRunningAsAdmin();
  splashWindow.loadFile('src/pages/splash.html', { query: { admin: isAdmin.toString() } });

  // Create Main Window in background
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0a',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile('src/pages/auth.html');

  mainWindow.once('ready-to-show', () => {
    // Wait for the splash screen animation to finish (e.g. 3.5 seconds)
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      }
    }, 3500);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Custom titlebar controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// Navigate to main app after login
ipcMain.on('navigate-to-app', () => {
  if (mainWindow) {
    mainWindow.loadFile('src/pages/app.html');
  }
});

// Navigate to auth page (logout)
ipcMain.on('navigate-to-auth', () => {
  if (mainWindow) {
    mainWindow.loadFile('src/pages/auth.html');
  }
});

// Open external URLs (for OAuth)
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

// ===== Discord Rich Presence =====
ipcMain.on('update-discord-rpc', (event, songData) => {
  updatePresence(songData);
});

ipcMain.on('clear-discord-rpc', () => {
  clearPresence();
});

// ===== Mini Player =====
function createMiniPlayer() {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.focus();
    return;
  }

  miniPlayerWindow = new BrowserWindow({
    width: 360,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  miniPlayerWindow.loadFile('src/pages/mini-player.html');

  // Position bottom-right of screen
  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  miniPlayerWindow.setPosition(width - 380, height - 120);

  miniPlayerWindow.on('closed', () => {
    miniPlayerWindow = null;
    // Show main window when mini player closes
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

ipcMain.on('toggle-mini-player', () => {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    // Close mini player, show main
    miniPlayerWindow.close();
  } else {
    // Open mini player, minimize main
    createMiniPlayer();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  }
});

ipcMain.on('update-mini-player', (event, data) => {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.webContents.send('mini-player-update', data);
  }
});

ipcMain.on('update-mini-player-progress', (event, data) => {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.webContents.send('mini-player-progress', data);
  }
});

// Mini player sends commands back to main window
ipcMain.on('mini-player-command', (event, command, data) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  switch (command) {
    case 'toggle-play':
      mainWindow.webContents.send('mini-command', 'toggle-play');
      break;
    case 'next':
      mainWindow.webContents.send('mini-command', 'next');
      break;
    case 'prev':
      mainWindow.webContents.send('mini-command', 'prev');
      break;
    case 'seek':
      mainWindow.webContents.send('mini-command', 'seek', data);
      break;
    case 'back-to-main':
      if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
        miniPlayerWindow.close();
      }
      break;
    case 'close':
      if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
        miniPlayerWindow.close();
      }
      break;
  }
});

// ===== Offline Download =====
const https = require('https');
const http = require('http');

ipcMain.handle('download-song', async (event, songData) => {
  const offlineDir = path.join(app.getPath('userData'), 'offline-songs');
  if (!fs.existsSync(offlineDir)) fs.mkdirSync(offlineDir, { recursive: true });

  const fileName = `${songData.id}.mp3`;
  const filePath = path.join(offlineDir, fileName);

  // If already downloaded, skip
  if (fs.existsSync(filePath)) return { success: true, path: filePath };

  // Download the file
  return new Promise((resolve) => {
    const url = songData.downloadUrl;
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filePath);

    protocol.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        // Save metadata
        const metaPath = path.join(offlineDir, `${songData.id}.json`);
        fs.writeFileSync(metaPath, JSON.stringify({
          id: songData.id,
          title: songData.title,
          artist: songData.artist,
          album: songData.album,
          cover_url: songData.cover_url,
          duration: songData.duration,
          file_path: filePath,
          downloaded_at: new Date().toISOString()
        }));
        resolve({ success: true, path: filePath });
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      resolve({ success: false, error: err.message });
    });
  });
});

ipcMain.handle('get-offline-songs', async () => {
  const offlineDir = path.join(app.getPath('userData'), 'offline-songs');
  if (!fs.existsSync(offlineDir)) return [];

  const files = fs.readdirSync(offlineDir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(offlineDir, f), 'utf-8'));
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
});

ipcMain.handle('delete-offline-song', async (event, songId) => {
  const offlineDir = path.join(app.getPath('userData'), 'offline-songs');
  const mp3Path = path.join(offlineDir, `${songId}.mp3`);
  const metaPath = path.join(offlineDir, `${songId}.json`);
  try {
    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

app.whenReady().then(() => {
  cleanCache();
  createWindow();

  // Discord Rich Presence başlat
  initDiscordRPC();

  // Otomatik güncellemeleri kontrol et
  autoUpdater.checkForUpdatesAndNotify();
});

// Güncelleme bulunduğunda
autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Güncelleme Bulundu',
    message: 'Yeni bir sürüm mevcut. Arka planda indiriliyor...'
  });
});

// Güncelleme indirildiğinde
autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Güncelleme Hazır',
    message: 'Güncelleme başarıyla indirildi. Yeni sürümü kullanmak için uygulama şimdi yeniden başlatılacak.',
    buttons: ['Yeniden Başlat']
  }).then(() => {
    setImmediate(() => autoUpdater.quitAndInstall());
  });
});
app.on('window-all-closed', () => {
  destroyRPC();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
