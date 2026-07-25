const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');

if (process.platform === 'win32') {
  app.setAppUserModelId("com.bekir.bekofy");
}
const fs = require('fs');
require('dotenv').config();
const { execSync } = require('child_process');
const { initDiscordRPC, updatePresence, clearPresence, destroyRPC } = require('./src/js/discord-rpc');
const { uploadFileToR2 } = require('./r2-uploader');
const { downloadToMp3 } = require('./downloader');

// Auto updater - opsiyonel, electron-updater yüklü değilse sessizce atla
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  console.log('[AutoUpdater] electron-updater paketi bulunamadı, otomatik güncelleme devre dışı.');
}

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
        console.log('[Cache] Silindi:', cachePath);
      }
    } catch (e) {
      console.warn('[Cache] Silinemedi (kilitli olabilir):', cachePath, e.message);
    }
  });
}

function createWindow() {
  // Create Splash Window
  splashWindow = new BrowserWindow({
    width: 600,
    height: 450,
    frame: false,
    backgroundColor: '#0a0a0a',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  const isAdmin = isAppRunningAsAdmin();
  const splashPath = path.join(__dirname, 'src/pages/splash.html');
  splashWindow.loadFile(splashPath, { query: { admin: isAdmin.toString() } });

  // Splash page fail handler
  splashWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Splash] Yüklenemedi:', errorCode, errorDescription, validatedURL);
  });

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

  // Auth page fail handler
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Main] Auth sayfası yüklenemedi:', errorCode, errorDescription, validatedURL);
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<html><body style="background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;font-family:sans-serif;height:100vh;margin:0"><div style="text-align:center"><h2>Bekofy</h2><p>Sayfa yüklenemedi. İnternet bağlantınızı kontrol edin.</p><button onclick="location.reload()" style="background:#1DB954;color:#000;border:none;padding:10px 24px;border-radius:6px;margin-top:12px;cursor:pointer">Tekrar Dene</button></div></html>'));
  });

  const authPath = path.join(__dirname, 'src/pages/auth.html');
  mainWindow.loadFile(authPath);

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Log L${level}] ${message} (${sourceId}:${line})`);
  });

  // Tarayıcı geri tuşuyla sayfa geçişini engelle ve uygulama içi geri tuşunu tetikle
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F12 ile DevTools aç
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }

    // Mouse geri/ileri tuşları veya Alt+Left/Right ile sayfa geçişini engelle
    if (input.type === 'keyDown') {
      const isBack = (input.alt && input.key === 'Left') || input.key === 'BrowserBack';
      const isForward = (input.alt && input.key === 'Right') || input.key === 'BrowserForward';
      
      // Always prevent default browser navigation
      if (isBack || isForward) {
        event.preventDefault();
      }

      if (isBack) {
        // Only send go-back if we're on the app page (not auth)
        const currentUrl = mainWindow.webContents.getURL();
        if (currentUrl.includes('app.html')) {
          mainWindow.webContents.send('app-go-back');
        }
      }
    }
  });

  // Also handle mouse back/forward buttons at OS level
  mainWindow.webContents.on('did-navigate', () => {
    // Clear history after any navigation to prevent back to auth
    const currentUrl = mainWindow.webContents.getURL();
    if (currentUrl.includes('app.html')) {
      setTimeout(() => mainWindow.webContents.clearHistory(), 100);
    }
  });

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      }
    }, 3500);
  });

  // Safety fallback: splash'i 15 saniye sonra zorla kapat
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  }, 15000);

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
    const appPath = path.join(__dirname, 'src/pages/app.html');
    mainWindow.loadFile(appPath).then(() => {
      // Clear navigation history so back button can't return to auth.html
      mainWindow.webContents.clearHistory();
    });
  }
});

// Navigate to auth page (logout)
ipcMain.on('navigate-to-auth', () => {
  if (mainWindow) {
    const authPath = path.join(__dirname, 'src/pages/auth.html');
    mainWindow.loadFile(authPath);
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
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#0a0a0a',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  miniPlayerWindow.loadFile('src/pages/mini-player.html');

  // When mini-player finishes loading, request current song data from main window
  miniPlayerWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mini-command', 'request-current-song');
    }
  });

  // Position bottom-right of screen
  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  miniPlayerWindow.setPosition(width - 380, height - 120);

  miniPlayerWindow.on('closed', () => {
    miniPlayerWindow = null;
    // Show main window when mini player closes
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
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

// ===== R2 Upload & Dialog =====
ipcMain.handle('upload-to-r2', async (event, filePath, fileName) => {
  try {
    const url = await uploadFileToR2(filePath, fileName);
    return { success: true, url };
  } catch (error) {
    console.error('R2 Upload error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-convert-upload-r2', async (event, sourceUrl, title, artist) => {
  try {
    // 1. Download to MP3
    const localMp3Path = await downloadToMp3(sourceUrl);
    
    // 2. Upload to R2 (under music/ folder)
    const ext = '.mp3';
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeArtist = artist.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const r2FileName = `music/${safeArtist}_${safeTitle}${ext}`;
    
    const r2Url = await uploadFileToR2(localMp3Path, r2FileName);
    
    // 3. Cleanup local file
    if (fs.existsSync(localMp3Path)) {
      fs.unlinkSync(localMp3Path);
    }
    
    return { success: true, url: r2Url };
  } catch (error) {
    console.error('Download/Convert/Upload error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

app.whenReady().then(() => {
  cleanCache();
  createWindow();

  // Discord Rich Presence başlat
  initDiscordRPC();

  // Otomatik güncellemeleri kontrol et (dev modda sessizce atla)
  if (autoUpdater) {
    // Dialog gösterme, renderer'a IPC ile bildir
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      console.log('[AutoUpdater] Güncelleme bulundu:', info.version);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', { version: info.version });
      }
    });

    autoUpdater.on('download-progress', (progress) => {
      console.log(`[AutoUpdater] İndirme: %${Math.round(progress.percent)}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', {
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AutoUpdater] Güncelleme indirildi:', info.version);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded', { version: info.version });
      }
    });

    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.log('[AutoUpdater] Güncelleme kontrolü atlandı:', err.message);
    });
  }
});

// Kullanıcı güncellemeyi yüklemek istediğinde
ipcMain.on('install-update', () => {
  if (autoUpdater) {
    setImmediate(() => autoUpdater.quitAndInstall());
  }
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
