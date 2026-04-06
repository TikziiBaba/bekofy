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
