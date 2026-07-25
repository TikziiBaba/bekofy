// ===== Queue Module - Sıra Yönetimi =====

window.initQueueModal = function() {
  document.getElementById('open-queue-btn').addEventListener('click', openQueueModal);
  document.getElementById('close-queue-modal').addEventListener('click', closeQueueModal);
  document.getElementById('clear-queue-btn').addEventListener('click', clearQueue);
  document.getElementById('shuffle-queue-btn').addEventListener('click', shuffleQueue);
  document.getElementById('save-queue-btn').addEventListener('click', saveQueueAsPlaylist);
};

function openQueueModal() {
  const modal = document.getElementById('queue-modal');
  const modalSongsContainer = document.getElementById('modal-queue-songs');
  renderQueueSongs(modalSongsContainer, player.queue);
  modal.classList.add('active');
}

function closeQueueModal() {
  document.getElementById('queue-modal').classList.remove('active');
}

function renderQueueSongs(container, songs) {
  if (songs.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Sırada şarkı yok</p></div>`;
    return;
  }
  container.innerHTML = songs.map((song, i) => {
    const coverHtml = song.cover_url
      ? `<img src="${song.cover_url}" alt="" class="song-row-cover" onerror="this.style.display='none'">`
      : `<div class="song-row-cover-placeholder"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" opacity="0.3"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>`;
    const isPlaying = i === player.currentIndex;
    const liked = userLikedSongIds.has(song.id);
    return `
      <div class="song-row ${isPlaying ? 'playing' : ''}" data-song-index="${i}" data-song-id="${song.id}">
        <div class="song-row-index">${isPlaying ? '<span class="playing-indicator"><span></span><span></span><span></span></span>' : `<span class="index-text">${i + 1}</span>`}</div>
        <div class="song-row-cover">${coverHtml}</div>
        <div class="song-row-info">
          <div class="song-row-title">${escapeHtml(song.title)}</div>
          <div class="song-row-artist">${formatArtistLinks(song.artist)}</div>
        </div>
        <div class="song-row-duration">${formatDuration(song.duration)}</div>
        <div class="song-row-actions">
          <button class="btn-icon btn-like-song ${liked ? 'liked' : ''}" data-song-id="${song.id}">
            <svg viewBox="0 0 24 24" fill="${liked ? 'var(--ts)' : 'none'}" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </button>
          <button class="btn-icon btn-remove-from-queue" data-song-index="${i}" title="Sıradan Kaldır">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.song-row').forEach(row => {
    row.addEventListener('dblclick', (e) => {
      if (e.target.closest('.btn-icon')) return;
      const idx = parseInt(row.dataset.songIndex);
      player.currentIndex = idx;
      playCurrentQueueSong();
      renderQueueSongs(container, player.queue);
    });
  });

  container.querySelectorAll('.btn-like-song').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleLikeSong(btn.dataset.songId);
      renderQueueSongs(container, player.queue);
    });
  });

  container.querySelectorAll('.btn-remove-from-queue').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.songIndex);
      removeFromQueue(idx);
      renderQueueSongs(container, player.queue);
    });
  });
}

function clearQueue() {
  player.queue = [];
  player.currentIndex = 0;
  const container = document.getElementById('modal-queue-songs');
  renderQueueSongs(container, player.queue);
  showToast('Sıra temizlendi', 'success');
}

function shuffleQueue() {
  if (player.queue.length === 0) return;
  const currentSong = player.queue[player.currentIndex];
  const remaining = player.queue.filter((_, i) => i !== player.currentIndex);
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  player.queue = currentSong ? [currentSong, ...remaining] : remaining;
  player.currentIndex = 0;
  const container = document.getElementById('modal-queue-songs');
  renderQueueSongs(container, player.queue);
  showToast('Sıra karıştırıldı', 'success');
}

async function saveQueueAsPlaylist() {
  if (player.queue.length === 0) {
    showToast('Sırada şarkı yok', 'error');
    return;
  }
  const name = `Sıra - ${new Date().toLocaleDateString('tr-TR')}`;
  try {
    const sb = getSupabase();
    const { error } = await sb.from('playlists').insert({
      name, user_id: currentUserId,
      song_ids: player.queue.map(s => s.id),
      is_public: false
    });
    if (error) throw error;
    showToast('Sıra çalma listesine kaydedildi! 🎵', 'success');
  } catch (err) {
    showToast('Kaydedilemedi', 'error');
  }
}

window.addToQueue = function(song) {
  player.queue.push(song);
  showToast(`${song.title} sıraya eklendi`, 'success');
};

window.removeFromQueue = function(index) {
  if (index === player.currentIndex) {
    showToast('Şu an çalan şarkı çıkarılamaz', 'error');
    return;
  }
  player.queue.splice(index, 1);
  if (index < player.currentIndex) player.currentIndex--;
  showToast('Sıradan kaldırıldı', 'success');
};

window.playSongFromPlaylist = function(playlist, index) {
  player.queue = [...playlist];
  player.currentIndex = index;
  player.playSong(player.queue[player.currentIndex], player.queue);
  updateQueueDisplay();
};

window.playCurrentQueueSong = function() {
  if (player.queue.length === 0 || player.currentIndex < 0 || player.currentIndex >= player.queue.length) return;
  const song = player.queue[player.currentIndex];
  player.playSong(song, player.queue);
  updateQueueDisplay();
  document.title = `${song.title} - ${song.artist} | Bekofy`;
};

function updateNowPlaying() {
  const song = player.getCurrentSong();
  if (!song) return;
  const titleEl = document.getElementById('now-playing-title');
  const artistEl = document.getElementById('now-playing-artist');
  const coverEl = document.getElementById('now-playing-cover');
  if (titleEl) titleEl.textContent = song.title;
  if (artistEl) artistEl.innerHTML = formatArtistLinks(song.artist);
  if (coverEl) {
    if (song.cover_url) {
      coverEl.innerHTML = `<img src="${song.cover_url}" alt="" onerror="this.style.display='none'">`;
    } else {
      coverEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.3" width="24" height="24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    }
  }
}

window.updateNowPlaying = updateNowPlaying;

function updateQueueDisplay() {
  const container = document.getElementById('sidebar-queue-songs');
  if (!container) return;
  const songs = player.queue.slice(Math.max(0, player.currentIndex - 2), player.currentIndex + 8);
  if (songs.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Sırada şarkı yok</p></div>`;
    return;
  }
  container.innerHTML = songs.map((song, i) => {
    const actualIndex = Math.max(0, player.currentIndex - 2) + i;
    const isPlaying = actualIndex === player.currentIndex;
    return `
      <div class="song-row ${isPlaying ? 'playing' : ''}" data-song-index="${actualIndex}">
        <div class="song-row-index">${isPlaying ? '<span class="playing-indicator"><span></span><span></span><span></span></span>' : `<span class="index-text">${actualIndex + 1}</span>`}</div>
        <div class="song-row-info">
          <div class="song-row-title">${escapeHtml(song.title)}</div>
          <div class="song-row-artist">${formatArtistLinks(song.artist)}</div>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.song-row').forEach(row => {
    row.addEventListener('dblclick', (e) => {
      if (e.target.closest('.btn-icon')) return;
      const idx = parseInt(row.dataset.songIndex);
      player.currentIndex = idx;
      playCurrentQueueSong();
      updateQueueDisplay();
    });
  });
}

window.updateQueueDisplay = updateQueueDisplay;

// queue.js - Sıra: ekleme, kaldırma, karıştırma, kaydetme, now-playing güncelleme
