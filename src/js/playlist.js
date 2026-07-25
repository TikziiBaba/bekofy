// ===== Playlist Module - Çalma Listeleri =====

var currentPlaylistDetailId = null;
var playlistDetailSongs = [];

window.initPlaylistModal = function() {
  document.getElementById('create-playlist-btn').addEventListener('click', openCreatePlaylistModal);
  document.getElementById('close-create-playlist-modal').addEventListener('click', closeCreatePlaylistModal);
  document.getElementById('cancel-create-playlist').addEventListener('click', closeCreatePlaylistModal);
  document.getElementById('confirm-create-playlist').addEventListener('click', createPlaylist);

  const playlistDetailModal = document.getElementById('playlist-detail-modal');
  if (playlistDetailModal) {
    playlistDetailModal.querySelector('.modal-header-close').addEventListener('click', closePlaylistDetailModal);
  }

  document.getElementById('open-playlists-from-queue').addEventListener('click', openPlaylistsFromQueue);
};

function openCreatePlaylistModal() {
  document.getElementById('create-playlist-modal').classList.add('active');
  document.getElementById('new-playlist-name').value = '';
  document.getElementById('new-playlist-desc').value = '';
  setTimeout(() => document.getElementById('new-playlist-name').focus(), 100);
}

function closeCreatePlaylistModal() {
  document.getElementById('create-playlist-modal').classList.remove('active');
}

async function createPlaylist() {
  const name = document.getElementById('new-playlist-name').value.trim();
  const desc = document.getElementById('new-playlist-desc').value.trim();
  if (!name) {
    showToast('Playlist adı gerekli', 'error');
    return;
  }
  const btn = document.getElementById('confirm-create-playlist');
  btn.disabled = true;
  btn.textContent = 'Oluşturuluyor...';
  try {
    const { data, error } = await createNewPlaylist(name, desc);
    if (error) throw error;
    showToast('Çalma listesi oluşturuldu! 🎵', 'success');
    closeCreatePlaylistModal();
    await loadUserPlaylists();
  } catch (err) {
    showToast('Oluşturulamadı: ' + (err.message || 'Bilinmeyen hata'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Oluştur';
  }
}

async function loadUserPlaylists() {
  try {
    const sb = getSupabase();
    const { data: myPlaylists } = await sb.from('playlists')
      .select('*')
      .eq('user_id', window.currentUserId)
      .order('created_at', { ascending: false });
    const { data: publicPlaylists } = await sb.from('playlists')
      .select('*, profiles:user_id(username)')
      .eq('is_public', true)
      .neq('user_id', window.currentUserId)
      .order('created_at', { ascending: false });
    const myContainer = document.getElementById('my-playlists');
    const publicContainer = document.getElementById('public-playlists');
    if (myContainer) {
      if (myPlaylists && myPlaylists.length > 0) {
        myContainer.innerHTML = myPlaylists.map(pl => {
          const coverHtml = pl.cover_url
            ? `<img src="${pl.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`
            : `<div class="default-playlist-cover">🎵</div>`;
          return `<div class="playlist-item" data-playlist-id="${pl.id}" data-playlist-name="${escapeHtml(pl.name)}">
            <div class="playlist-item-cover">${coverHtml}</div>
            <div class="playlist-item-info">
              <h3>${escapeHtml(pl.name)}</h3>
              <p>${pl.song_ids ? pl.song_ids.length : 0} şarkı</p>
            </div>
          </div>`;
        }).join('');
      } else {
        myContainer.innerHTML = '<p class="empty-state-text">Henüz çalma listesi yok</p>';
      }
    }
    if (publicContainer) {
      if (publicPlaylists && publicPlaylists.length > 0) {
        publicContainer.innerHTML = publicPlaylists.map(pl => {
          const ownerName = pl.profiles?.username || 'Kullanıcı';
          const coverHtml = pl.cover_url
            ? `<img src="${pl.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`
            : `<div class="default-playlist-cover">🎵</div>`;
          return `<div class="playlist-item" data-playlist-id="${pl.id}" data-playlist-name="${escapeHtml(pl.name)}">
            <div class="playlist-item-cover">${coverHtml}</div>
            <div class="playlist-item-info">
              <h3>${escapeHtml(pl.name)}</h3>
              <p>${ownerName} · ${pl.song_ids ? pl.song_ids.length : 0} şarkı</p>
            </div>
          </div>`;
        }).join('');
      } else {
        publicContainer.innerHTML = '<p class="empty-state-text">Henüz herkese açık çalma listesi yok</p>';
      }
    }
  } catch (err) {
    console.error('loadUserPlaylists error:', err);
  }
}

async function openPlaylistDetail(playlistId) {
  const modal = document.getElementById('playlist-detail-modal');
  const sb = getSupabase();
  try {
    const { data: pl, error } = await sb.from('playlists').select('*, profiles:user_id(username)').eq('id', playlistId).single();
    if (error || !pl) {
      showToast('Çalma listesi bulunamadı', 'error');
      return;
    }
    currentPlaylistDetailId = pl.id;
    const ownerName = pl.profiles?.username || 'Bilinmeyen Kullanıcı';
    document.getElementById('playlist-detail-title').textContent = pl.name;
    document.getElementById('playlist-detail-owner').textContent = ownerName;
    document.getElementById('playlist-detail-count').textContent = `${pl.song_ids ? pl.song_ids.length : 0} şarkı`;
    if (pl.cover_url) {
      document.getElementById('playlist-detail-cover').innerHTML = `<img src="${pl.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover">`;
    } else {
      document.getElementById('playlist-detail-cover').innerHTML = `<div class="default-playlist-cover" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px">🎵</div>`;
    }
    playlistDetailSongs = [];
    if (pl.song_ids && pl.song_ids.length > 0) {
      const { data: songsData } = await sb.from('songs').select('*').in('id', pl.song_ids);
      playlistDetailSongs = songsData || [];
    }
    document.getElementById('playlist-detail-play-btn').onclick = () => {
      if (playlistDetailSongs.length > 0) {
        player.currentIndex = 0;
        playSongFromPlaylist(playlistDetailSongs, 0);
      }
    };
    modal.classList.add('active');
  } catch (err) {
    console.error('openPlaylistDetail error:', err);
    showToast('Çalma listesi açılamadı', 'error');
  }
}

function initPlaylistDetailActions() {
  document.getElementById('playlist-detail-shuffle').addEventListener('click', () => {
    if (playlistDetailSongs.length === 0) return;
    const shuffled = [...playlistDetailSongs].sort(() => Math.random() - 0.5);
    player.currentIndex = 0;
    playSongFromPlaylist(shuffled, 0);
  });
}

function openPlaylistsFromQueue() {
  const currentSong = player.getCurrentSong();
  if (!currentSong) {
    showToast('Önce bir şarkı seçin', 'error');
    return;
  }
  const modal = document.getElementById('add-to-playlist-modal');
  document.getElementById('add-to-playlist-song-title').textContent = currentSong.title;
  modal.classList.add('active');
}

function initPlaylistContextMenu() {
  document.getElementById('search-results').addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.song-card');
    if (!card) return;
    e.preventDefault();
    const songId = card.dataset.songId;
    const song = window.allSongs.find(s => s.id == songId);
    if (!song) return;
    showSongContextMenu(e.clientX, e.clientY, song);
  });

  document.getElementById('songs-list').addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.song-row');
    if (!row) return;
    e.preventDefault();
    const songId = row.dataset.songId;
    const song = window.allSongs.find(s => s.id == songId);
    if (!song) return;
    showSongContextMenu(e.clientX, e.clientY, song);
  });
}

// playlist.js - Çalma listeleri: oluşturma, detay, kamu/seçki listeleri
