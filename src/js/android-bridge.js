/**
 * Bekofy Android Native Platform Bridge
 * Connects Web UI events & audio state to Kotlin Android Native Interface (window.AndroidNative).
 */

(function () {
  const isAndroidNative = typeof window.AndroidNative !== 'undefined' || navigator.userAgent.includes('BekofyAndroidNative');

  if (isAndroidNative) {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('android-env', 'android-native-env');

      // Request notification permissions for Android 13+
      if (window.AndroidNative && window.AndroidNative.requestNotificationPermission) {
        window.AndroidNative.requestNotificationPermission();
      }

      // Add haptic feedback to interactive UI elements
      document.addEventListener('click', (e) => {
        const target = e.target.closest('button, .btn, .nav-item, .song-card, .playlist-card, .menu-item');
        if (target && window.AndroidNative && window.AndroidNative.vibrate) {
          window.AndroidNative.vibrate(10);
        }
      });
    });

    // Native toast notification bridge
    window.nativeNotify = function (title, body) {
      if (window.AndroidNative && window.AndroidNative.showToast) {
        window.AndroidNative.showToast(`${title}: ${body}`);
      }
    };

    // Update Android MediaSession and Notification Controls
    window.updateNativeMediaSession = function (title, artist, coverUrl, isPlaying) {
      if (window.AndroidNative && window.AndroidNative.updateMediaSession) {
        let cover = coverUrl || '';
        if (typeof coverUrl === 'boolean') {
          isPlaying = coverUrl;
          cover = '';
        }
        window.AndroidNative.updateMediaSession(
          title || 'Bekofy',
          artist || 'Bekofy Music',
          cover || '',
          !!isPlaying
        );
      }
    };

    // Receiver function invoked from Kotlin MainActivity when system / notification buttons are pressed
    window.onNativeMediaControl = function (action) {
      console.log('[AndroidNativeBridge] Action received from Android:', action);
      if (!window.player) return;

      switch (action) {
        case 'play':
          if (!window.player.isPlaying) {
            window.player.togglePlay();
          }
          break;
        case 'pause':
          if (window.player.isPlaying) {
            window.player.togglePlay();
          }
          break;
        case 'next':
          window.player.next();
          break;
        case 'prev':
        case 'previous':
          window.player.previous();
          break;
        case 'stop':
          if (window.player.isPlaying) {
            window.player.togglePlay();
          }
          break;
      }
    };

    // Provide safe fallbacks for desktop Electron window controls
    if (!window.electronAPI) {
      window.electronAPI = {
        minimize: () => console.log('[AndroidNativeBridge] minimize ignored'),
        maximize: () => console.log('[AndroidNativeBridge] maximize ignored'),
        close: () => console.log('[AndroidNativeBridge] close ignored'),
        updateDiscordRPC: () => console.log('[AndroidNativeBridge] Discord RPC ignored'),
        clearDiscordRPC: () => console.log('[AndroidNativeBridge] Discord RPC cleared'),
        isElectron: false
      };
    }
  }
})();
