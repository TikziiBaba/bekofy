// ===== Player Controls - Oynatma Kontrolleri, Sıra & Uyku Zamanlayıcı =====

// ===== Sleep Timer =====
var sleepTimerId = null;
var sleepTimeRemaining = 0;
var sleepTimerInterval = null;

function initSleepTimer() {
  const btn = document.getElementById('btn-sleep-timer');
  const popup = document.getElementById('sleep-timer-popup');
  const badge = document.getElementById('sleep-timer-badge');
  const cancelBtn = document.getElementById('sleep-cancel');
  if (!btn || !popup) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.sleep-timer-wrapper')) {
      popup.style.display = 'none';
    }
  });

  popup.querySelectorAll('.sleep-option[data-minutes]').forEach(opt => {
    opt.addEventListener('click', () => {
      const minutes = parseInt(opt.dataset.minutes);
      startSleepTimer(minutes);
      popup.style.display = 'none';
    });
  });

  cancelBtn.addEventListener('click', () => {
    cancelSleepTimer();
    popup.style.display = 'none';
  });
}

function startSleepTimer(minutes) {
  cancelSleepTimer();
  sleepTimeRemaining = minutes * 60;
  const badge = document.getElementById('sleep-timer-badge');
  const cancelBtn = document.getElementById('sleep-cancel');
  const btn = document.getElementById('btn-sleep-timer');

  badge.style.display = 'block';
  cancelBtn.style.display = 'block';
  btn.classList.add('active');
  updateSleepBadge();

  sleepTimerInterval = setInterval(() => {
    sleepTimeRemaining--;
    updateSleepBadge();

    if (sleepTimeRemaining <= 0) {
      // Fade out and pause
      fadeOutAndPause();
      cancelSleepTimer();
    }
  }, 1000);
}

function updateSleepBadge() {
  const badge = document.getElementById('sleep-timer-badge');
  if (!badge) return;
  const m = Math.floor(sleepTimeRemaining / 60);
  const s = sleepTimeRemaining % 60;
  badge.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function fadeOutAndPause() {
  const originalVol = player.audio.volume;
  let vol = originalVol;
  const fadeInterval = setInterval(() => {
    vol -= 0.05;
    if (vol <= 0) {
      clearInterval(fadeInterval);
      player.audio.pause();
      player.isPlaying = false;
      player.updatePlayButton();
      player.audio.volume = originalVol;
      showToast('Uyku zamanlayıcı: Müzik durduruldu 💤', 'success');
    } else {
      player.audio.volume = vol;
    }
  }, 100);
}

function cancelSleepTimer() {
  if (sleepTimerInterval) clearInterval(sleepTimerInterval);
  sleepTimerInterval = null;
  sleepTimeRemaining = 0;
  const badge = document.getElementById('sleep-timer-badge');
  const cancelBtn = document.getElementById('sleep-cancel');
  const btn = document.getElementById('btn-sleep-timer');
  if (badge) badge.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (btn) btn.classList.remove('active');
}

// ===== Player Controls (Play, Pause, Progress, Volume) =====
function initPlayerControls() {
  const btnPlay = document.getElementById('btn-play');
  const btnNext = document.getElementById('btn-next');
  const btnPrev = document.getElementById('btn-prev');
  const btnShuffle = document.getElementById('btn-shuffle');
  const btnRepeat = document.getElementById('btn-repeat');
  if (btnPlay) btnPlay.addEventListener('click', () => player.togglePlay());
  if (btnNext) btnNext.addEventListener('click', () => player.next());
  if (btnPrev) btnPrev.addEventListener('click', () => player.previous());
  if (btnShuffle) btnShuffle.addEventListener('click', () => player.toggleShuffle());
  if (btnRepeat) btnRepeat.addEventListener('click', () => player.toggleRepeat());

  // Fullscreen controls
  const fsBtnPlay = document.getElementById('fs-btn-play-pause');
  const fsBtnNext = document.getElementById('fs-btn-next');
  const fsBtnPrev = document.getElementById('fs-btn-prev');
  if (fsBtnPlay) fsBtnPlay.addEventListener('click', () => player.togglePlay());
  if (fsBtnNext) fsBtnNext.addEventListener('click', () => player.next());
  if (fsBtnPrev) fsBtnPrev.addEventListener('click', () => player.previous());

  // Fullscreen open/close
  const npCover = document.getElementById('now-playing-cover');
  const fsClose = document.getElementById('fs-close');
  if (npCover) {
    npCover.addEventListener('click', () => player.toggleFullscreen());
    npCover.style.cursor = 'pointer';
  }
  if (fsClose) fsClose.addEventListener('click', () => player.toggleFullscreen());

  // Progress bar - click & drag
  const progressBar = document.getElementById('progress-bar');
  const fsProgressBar = document.getElementById('fs-progress-bar');
  let isDraggingProgress = false;

  const seekFromEvent = (e, bar) => {
    const rect = bar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    player.seek(percent);
  };

  if (progressBar) progressBar.addEventListener('mousedown', (e) => {
    isDraggingProgress = true;
    seekFromEvent(e, progressBar);
  });

  if (fsProgressBar) {
    fsProgressBar.addEventListener('mousedown', (e) => {
      isDraggingProgress = true;
      seekFromEvent(e, fsProgressBar);
    });
  }

  document.addEventListener('mousemove', (e) => {
    if (isDraggingProgress) {
      if (player.isFullscreen) {
        seekFromEvent(e, fsProgressBar);
      } else {
        seekFromEvent(e, progressBar);
      }
    }
  });

  document.addEventListener('mouseup', () => {
    isDraggingProgress = false;
  });

  // Volume slider - click & drag
  const volumeSlider = document.getElementById('volume-slider');
  let isDraggingVolume = false;

  const setVolumeFromEvent = (e) => {
    const rect = volumeSlider.getBoundingClientRect();
    const vol = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    player.setVolume(vol);
  };

  if (volumeSlider) volumeSlider.addEventListener('mousedown', (e) => {
    isDraggingVolume = true;
    setVolumeFromEvent(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (isDraggingVolume) setVolumeFromEvent(e);
  });

  document.addEventListener('mouseup', () => {
    isDraggingVolume = false;
  });

  // Like button (player bar)
  const btnLike = document.getElementById('btn-like');
  if (btnLike) btnLike.addEventListener('click', async function () {
    const currentSong = player.getCurrentSong();
    if (!currentSong || !currentUserId) return;
    await toggleLikeSong(currentSong.id);
  });
}

// ===== Volume Toggle (Mute/Unmute) =====
function initVolumeToggle() {
  let previousVolume = 0.7;
  const btnVolume = document.getElementById('btn-volume-icon');
  if (btnVolume) btnVolume.addEventListener('click', () => {
    if (player.volume > 0) {
      previousVolume = player.volume;
      player.setVolume(0);
    } else {
      player.setVolume(previousVolume);
    }
  });
}

// ===== QUEUE PANEL =====
var queuePanelOpen = false;

function initQueuePanel() {
  const btn = document.getElementById('btn-queue');
  const closeBtn = document.getElementById('queue-panel-close');
  if (btn) btn.addEventListener('click', toggleQueuePanel);
  if (closeBtn) closeBtn.addEventListener('click', toggleQueuePanel);
}

function toggleQueuePanel() {
  const panel = document.getElementById('queue-panel');
  if (!panel) return;
  queuePanelOpen = !queuePanelOpen;
  panel.classList.toggle('open', queuePanelOpen);
  if (queuePanelOpen) renderQueuePanel();
}

function renderQueuePanel() {
  const nowEl = document.getElementById('queue-now-playing');
  const listEl = document.getElementById('queue-list');
  if (!nowEl || !listEl) return;

  const currentSong = player.getCurrentSong();
  if (currentSong) {
    const coverHtml = currentSong.cover_url
      ? `<img src="${currentSong.cover_url}" alt="">`
      : `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" opacity=".3"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    nowEl.innerHTML = `
      <div class="queue-now-label">Şimdi Çalıyor</div>
      <div class="queue-item playing queue-animated" style="animation-delay: 0s">
        <div class="queue-item-cover">${coverHtml}</div>
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(currentSong.title)}</div>
          <div class="queue-item-artist">${formatArtistLinks(currentSong.artist)}</div>
        </div>
      </div>`;
  } else {
    nowEl.innerHTML = '<div class="queue-empty">Şarkı çalmıyor</div>';
  }

  const upcoming = player.queue.filter((_, i) => i > player.currentIndex);
  if (upcoming.length === 0) {
    listEl.innerHTML = '<div class="queue-empty">Sırada şarkı yok</div>';
    return;
  }

  listEl.innerHTML = upcoming.map((song, i) => {
    const idx = player.currentIndex + 1 + i;
    const coverHtml = song.cover_url
      ? `<img src="${song.cover_url}" alt="">`
      : `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" opacity=".3"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    return `
      <div class="queue-item queue-animated" data-queue-idx="${idx}" style="animation-delay: ${i * 0.05}s">
        <div class="queue-item-cover">${coverHtml}</div>
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(song.title)}</div>
          <div class="queue-item-artist">${escapeHtml(song.artist)}</div>
        </div>
        <button class="queue-item-remove" data-remove-idx="${idx}" title="Kaldır">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
        </button>
      </div>`;
  }).join('');

  // Click to play
  listEl.querySelectorAll('.queue-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.queue-item-remove')) return;
      const idx = parseInt(el.dataset.queueIdx);
      player.currentIndex = idx;
      player.playSong(player.queue[idx]);
      setTimeout(() => renderQueuePanel(), 300);
    });
  });

  // Remove from queue
  listEl.querySelectorAll('.queue-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.removeIdx);
      player.queue.splice(idx, 1);
      if (player.currentIndex > idx) player.currentIndex--;
      renderQueuePanel();
    });
  });
}


