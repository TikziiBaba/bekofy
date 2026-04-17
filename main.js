const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { autoUpdater } = require('electron-updater');

let mainWindow;
let splashWindow;

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
  
  splashWindow.loadFile('src/pages/splash.html');

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
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
