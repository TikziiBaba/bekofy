// ===== Controls Module - Oynatma Kontrolleri =====

var sleepTimerTimeout = null;
var sleepTimerInterval = null;
var sleepTimerEndTime = null;

window.initControls = function() {
  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) {
    let isDragging = false;
    progressContainer.addEventListener('mousedown', (e) => {
      isDragging = true;
      updateProgress(e);
    });
    document.addEventListener('mousemove', (e) => {
      if (isDragging) updateProgress(e);
    });
    document.addEventListener('mouseup', () => { isDragging = false; });
  }

  document.getElementById('sleep-timer-btn')?.addEventListener('click', openSleepTimerModal);
  document.getElementById('close-sleep-timer-modal')?.addEventListener('click', () => document.getElementById('sleep-timer-modal').classList.remove('active'));
  document.querySelectorAll('[data-sleep-minutes]').forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.sleepMinutes);
      setSleepTimer(minutes);
      document.getElementById('sleep-timer-modal').classList.remove('active');
    });
  });
  document.getElementById('cancel-sleep-timer')?.addEventListener('click', cancelSleepTimer);

  const miniPlayerBtn = document.getElementById('mini-player-btn');
  if (miniPlayerBtn) {
    miniPlayerBtn.addEventListener('click', toggleMiniPlayer);
  }
};

function updateProgress(e) {
  if (!player.audio || !player.getCurrentSong()) return;
  const rect = document.getElementById('progress-container').getBoundingClientRect();
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  const percent = x / rect.width;
  player.audio.currentTime = percent * player.audio.duration;
}

function openSleepTimerModal() {
  document.getElementById('sleep-timer-modal').classList.add('active');
}

function setSleepTimer(minutes) {
  cancelSleepTimer();
  sleepTimerEndTime = Date.now() + minutes * 60 * 1000;
  sleepTimerTimeout = setTimeout(() => {
    if (player.audio) player.audio.pause();
    player.isPlaying = false;
    player.updatePlayButton();
    showToast('Uyku zamanlayıcı: Şarkı duraklatıldı 💤', 'success');
  }, minutes * 60 * 1000);

  sleepTimerInterval = setInterval(() => {
    const remaining = Math.max(0, sleepTimerEndTime - Date.now());
    if (remaining <= 0) {
      clearInterval(sleepTimerInterval);
      sleepTimerInterval = null;
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const btn = document.getElementById('sleep-timer-btn');
    if (btn) btn.textContent = `💤 ${mins}:${secs.toString().padStart(2, '0')}`;
  }, 1000);

  showToast(`Uyku zamanlayıcı: ${minutes} dakika ⏰`, 'success');
}

function cancelSleepTimer() {
  if (sleepTimerTimeout) clearTimeout(sleepTimerTimeout);
  if (sleepTimerInterval) clearInterval(sleepTimerInterval);
  sleepTimerTimeout = null;
  sleepTimerInterval = null;
  sleepTimerEndTime = null;
  const btn = document.getElementById('sleep-timer-btn');
  if (btn) btn.textContent = 'Uyku Zamanlayıcı';
}

function toggleMiniPlayer() {
  if (window.electronAPI && window.electronAPI.toggleMiniPlayer) {
    window.electronAPI.toggleMiniPlayer();
  }
}

window.updatePlayButton = function() {
  const btns = document.querySelectorAll('.play-btn');
  btns.forEach(btn => {
    btn.textContent = player.isPlaying ? '⏸' : '▶';
  });
};

window.updateProgress = updateProgress;

// controls.js - Kontroller: ilerleme çubuğu, uyku zamanlayıcı, mini oynatıcı
