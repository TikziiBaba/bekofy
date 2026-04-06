// ===== Main App Logic =====

let allSongs = [];
let searchResultSongs = [];
let currentPage = 'home';
let currentUserId = null;
let currentUserRole = 'user';
let userLikedSongIds = new Set();
let userPlaylists = [];
let currentPlaylistId = null;
let currentPlaylistSongs = [];
let artistUsernames = new Set(); // For verified ticks

document.addEventListener('DOMContentLoaded', () => {
  initTitlebar();
  initNavigation();
  initPlayerControls();
  initSearch();
  initPlaylistModal();
  initContextMenu();
  initPlaylistContextMenu();
  initPlaylistDetailActions();
  initAdminActions();
  initProfilePage();
  initArtistPage();
  initLogout();
  initVolumeToggle();
  initSidebarProfileClick();
  loadUserInfo();
  loadArtistUsernames();
  loadSongs();
  loadPlaylists();
  setGreeting();
  
  // Load saved player state (last song & volume)
  setTimeout(() => player.loadState(), 500);
});

// ===== Titlebar =====
function initTitlebar() {
  document.getElementById('btn-minimize').addEventListener('click', () => window.electronAPI.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.electronAPI.maximize());
  document.getElementById('btn-close').addEventListener('click', () => window.electronAPI.close());
}

// ===== Navigation =====
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) {
    pageEl.classList.add('active');
    pageEl.style.animation = 'none';
    pageEl.offsetHeight; // reflow
    pageEl.style.animation = 'fadeIn 0.3s ease';
  }
  // Scroll to top
  const main = document.getElementById('main-content');
  if (main) main.scrollTop = 0;
  // Focus search input when navigating to search
  if (page === 'search') {
    setTimeout(() => {
      const input = document.getElementById('search-input');
      if (input) input.focus();
    }, 100);
  }
  // Load library data when navigating to library
  if (page === 'library') {
    loadLibraryPage();
  }
  // Load admin data when navigating to admin
  if (page === 'admin') {
    if (currentUserRole !== 'admin' && currentUserRole !== 'yetkili') {
      showToast('Bu sayfaya erişim yetkiniz yok', 'error');
      navigateTo('home');
      return;
    }
    loadAdminPage();
  }
  // Profile page
  if (page === 'profile') {
    loadProfilePage();
  }
  // Artist upload page
  if (page === 'artist-upload') {
    if (currentUserRole !== 'artist' && currentUserRole !== 'admin') {
      showToast('Bu sayfa sadece sanatçılar için', 'error');
      navigateTo('home');
      return;
    }
    loadArtistPage();
  }
}

// ===== Sidebar Profile Click =====
function initSidebarProfileClick() {
  const sidebarUser = document.getElementById('sidebar-user');
  if (sidebarUser) {
    // Make user-avatar and user-info clickable (not logout button)
    const avatar = sidebarUser.querySelector('.user-avatar');
    const info = sidebarUser.querySelector('.user-info');
    [avatar, info].forEach(el => {
      if (el) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          navigateTo('profile');
        });
      }
    });
  }
}

// ===== Load Artist Usernames for Verified Ticks =====
async function loadArtistUsernames() {
  try {
    const { data } = await getArtistProfiles();
    if (data) {
      artistUsernames = new Set(data.map(p => p.username?.toLowerCase()));
    }
  } catch (e) {
    console.log('Artist profiles load error:', e);
  }
}

function getVerifiedTick(artistName) {
  if (!artistName) return '';
  if (artistUsernames.has(artistName.toLowerCase())) {
    return '<span class="verified-tick" title="Onaylı Sanatçı">✓</span>';
  }
  return '';
}

// ===== Greeting =====
function setGreeting() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 6) greeting = 'İyi Geceler';
  else if (hour < 12) greeting = 'Günaydın';
  else if (hour < 18) greeting = 'İyi Günler';
  else greeting = 'İyi Akşamlar';
  const h1 = document.querySelector('#page-home .page-header h1');
  if (h1) h1.textContent = greeting;
}

// ===== Load User Info & Ensure Profile =====
async function loadUserInfo() {
  try {
    const user = await getCurrentUser();
    if (user) {
      currentUserId = user.id;
      const displayName = user.user_metadata?.username || user.email?.split('@')[0] || 'Kullanıcı';
      
      const nameEl = document.getElementById('user-name');
      nameEl.childNodes[0].textContent = displayName + ' ';
      document.getElementById('user-email').textContent = user.email || '';
      
      // Profil yoksa oluştur
      await ensureProfile(user.id, displayName);
      // Beğenilen şarkıları yükle
      await loadLikedSongs();
      // Avatar yükle
      await loadUserAvatar(user.id, displayName);
      // Rol kontrolü
      await loadUserRole(user.id);
    }
  } catch (err) {
    console.log('User info load error:', err);
  }
}

async function loadUserRole(userId) {
  try {
    currentUserRole = await fetchUserRole(userId);
    const badge = document.getElementById('role-badge');
    const adminNav = document.getElementById('nav-admin');
    const artistNav = document.getElementById('nav-artist-upload');
    
    const roleConfig = {
      admin:   { text: 'Admin',    css: 'admin',   admin: true,  artist: true },
      yetkili: { text: 'Yetkili',  css: 'yetkili', admin: true,  artist: false },
      artist:  { text: 'Sanatçı',  css: 'artist',  admin: false, artist: true },
      premium: { text: 'Premium',  css: 'premium', admin: false, artist: false },
      user:    { text: null,       css: null,      admin: false, artist: false },
    };
    
    const cfg = roleConfig[currentUserRole] || roleConfig.user;
    
    if (cfg.text) {
      badge.textContent = cfg.text;
      badge.className = 'role-badge ' + cfg.css;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
    
    adminNav.style.display = cfg.admin ? 'flex' : 'none';
    artistNav.style.display = cfg.artist ? 'flex' : 'none';
  } catch (err) {
    console.log('Role load error:', err);
  }
}

async function loadUserAvatar(userId, displayName) {
  try {
    const sb = getSupabase();
    const { data: profile } = await sb.from('profiles').select('avatar_url').eq('id', userId).single();
    const avatarEl = document.getElementById('user-avatar');
    
    if (profile && profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    } else {
      // Varsayılan avatar (baş harfler ile)
      const initials = getInitials(displayName);
      const color = getAvatarColor(displayName);
      avatarEl.innerHTML = `<div class="avatar-initials" style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff">${initials}</div>`;
    }
    
    // Avatarı tıklayınca değiştirme
    avatarEl.style.cursor = 'pointer';
    avatarEl.title = 'Profil fotoğrafını değiştir';
    avatarEl.onclick = () => openAvatarUpload(userId, displayName);
  } catch (err) {
    console.log('Avatar load error:', err);
  }
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  const colors = ['#1DB954','#E91E63','#9C27B0','#3F51B5','#009688','#FF5722','#795548','#607D8B','#F44336','#2196F3','#4CAF50','#FF9800'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

async function openAvatarUpload(userId, displayName) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Dosya 5MB\'dan küçük olmalı', 'error');
      return;
    }
    showToast('Yükleniyor...', 'success');
    try {
      const sb = getSupabase();
      const ext = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${ext}`;
      
      const { error: uploadError } = await sb.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) { 
        console.error('Upload Error Detailed:', uploadError);
        showToast('Yükleme hatası: ' + (uploadError.message || JSON.stringify(uploadError)), 'error'); 
        return; 
      }
      
      const { data: urlData } = sb.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = urlData.publicUrl + '?t=' + Date.now();
      
      await sb.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
      
      await loadUserAvatar(userId, displayName);
      showToast('Profil fotoğrafı güncellendi! 📸', 'success');
    } catch (err) {
      showToast('Yükleme sırasında hata oluştu', 'error');
    }
  };
  input.click();
}

async function ensureProfile(userId, username) {
  try {
    const sb = getSupabase();
    // Önce profil var mı kontrol et
    const { data } = await sb.from('profiles').select('id').eq('id', userId).single();
    if (!data) {
      // Profil yoksa oluştur
      await sb.from('profiles').insert({ id: userId, username: username });
    }
  } catch (err) {
    // Profil zaten var veya hata - devam et
    try {
      const sb = getSupabase();
      await sb.from('profiles').upsert({ id: userId, username: username }, { onConflict: 'id' });
    } catch (e) {
      console.log('Profile ensure error:', e);
    }
  }
}

// ===== Load Songs =====
let _songsSubscribed = false;

async function loadSongs() {
  try {
    let { data, error } = await fetchApprovedSongs();
    if (error) {
      console.warn('Songs fetch error, falling back to fetchAllSongs:', error);
      const fallback = await fetchAllSongs();
      data = fallback.data;
      error = fallback.error;
    }
    
    if (error) {
      showEmptyState('recent-songs', 'Şarkılar yüklenemedi');
      showEmptyState('all-songs', 'Şarkılar yüklenemedi');
      return;
    }
    allSongs = data || [];
    renderRecentSongs(allSongs.slice(0, 8));
    renderAllSongs(allSongs);
    renderRecommendedSongs();
    
    // Subscribe to realtime updates only once
    if (!_songsSubscribed) {
      subscribeToSongs((payload) => {
        console.log('Realtime update:', payload);
        loadSongs();
      });
      _songsSubscribed = true;
    }
  } catch (err) {
    console.error('Songs load error:', err);
    showEmptyState('recent-songs', 'Şarkılar yüklenemedi');
    showEmptyState('all-songs', 'Şarkılar yüklenemedi');
  }
}

// ===== Render Song Cards =====
function renderRecentSongs(songs) {
  const container = document.getElementById('recent-songs');
  if (!songs || songs.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <p>Henüz şarkı eklenmemiş</p>
      <small style="color:var(--tm);font-size:13px">Supabase'den şarkı ekleyin</small>
    </div>`;
    return;
  }
  container.innerHTML = songs.map(song => createSongCard(song)).join('');
}

async function renderRecommendedSongs() {
  const container = document.getElementById('recommended-songs');
  if (!container) return;
  
  if (!currentUserId || allSongs.length === 0) {
    // Kullanıcı giriş yapmamışsa veya şarkı yoksa son eklenenlerden rastgele göster
    const shuffled = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 8);
    if (shuffled.length > 0) {
      container.innerHTML = shuffled.map(song => createSongCard(song)).join('');
    } else {
      container.innerHTML = `<div class="empty-state"><p>Henüz öneri yok</p></div>`;
    }
    return;
  }
  
  try {
    const recommended = await getRecommendedSongs(currentUserId, allSongs, userLikedSongIds);
    if (recommended.length > 0) {
      container.innerHTML = recommended.map(song => createSongCard(song)).join('');
    } else {
      // Fallback: rastgele şarkılar
      const shuffled = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 8);
      container.innerHTML = shuffled.map(song => createSongCard(song)).join('');
    }
  } catch (err) {
    console.error('Recommendations error:', err);
    const shuffled = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 8);
    container.innerHTML = shuffled.map(song => createSongCard(song)).join('');
  }
}

function createSongCard(song) {
  const coverHtml = song.cover_url 
    ? `<img src="${song.cover_url}" alt="${escapeHtml(song.title)}" onerror="this.style.display='none'">` 
    : `<svg class="default-cover" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
  
  return `
    <div class="song-card" data-song-id="${song.id}">
      <div class="song-card-cover">
        ${coverHtml}
        <button class="song-card-play" data-play-id="${song.id}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
      <div class="song-card-title">${escapeHtml(song.title)}</div>
      <div class="song-card-artist">${escapeHtml(song.artist)}${getVerifiedTick(song.artist)}</div>
    </div>
  `;
}

function renderAllSongs(songs) {
  const container = document.getElementById('all-songs');
  if (!songs || songs.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <p>Henüz şarkı eklenmemiş</p>
    </div>`;
    return;
  }
  container.innerHTML = `
    <div class="song-list-header">
      <span>#</span>
      <span>Başlık</span>
      <span>Albüm</span>
      <span>Süre</span>
    </div>
    ${songs.map((song, i) => renderSongListItem(song, i + 1)).join('')}
  `;
}

function renderSongListItem(song, num) {
  const coverHtml = song.cover_url 
    ? `<img src="${song.cover_url}" alt="" onerror="this.style.display='none'">` 
    : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;

  return `
    <div class="song-list-item" data-song-id="${song.id}">
      <div class="song-list-num">${num}</div>
      <div class="song-list-info">
        <div class="song-list-cover">${coverHtml}</div>
        <div class="song-list-details">
          <div class="song-list-title">${escapeHtml(song.title)}</div>
          <div class="song-list-subtitle">${escapeHtml(song.artist)}${getVerifiedTick(song.artist)}</div>
        </div>
      </div>
      <div class="song-list-album">${escapeHtml(song.album || '—')}</div>
      <div class="song-list-duration">${formatDuration(song.duration)}</div>
    </div>
  `;
}

// ===== Event Delegation for Song Clicks =====
document.addEventListener('click', (e) => {
  // Song card play button
  const playBtn = e.target.closest('[data-play-id]');
  if (playBtn) {
    e.stopPropagation();
    const id = playBtn.dataset.playId;
    playSongFromAny(id);
    return;
  }
  
  // Song card click
  const songCard = e.target.closest('.song-card[data-song-id]');
  if (songCard) {
    playSongFromAny(songCard.dataset.songId);
    return;
  }
  
  // Song list item click
  const songItem = e.target.closest('.song-list-item[data-song-id]');
  if (songItem) {
    playSongFromAny(songItem.dataset.songId);
    return;
  }
  
  // Playlist item click (sidebar)
  const playlistItem = e.target.closest('.playlist-item[data-playlist-id]');
  if (playlistItem) {
    openPlaylistDetail(playlistItem.dataset.playlistId);
    return;
  }
  
  // Playlist card click (library page)
  const playlistCard = e.target.closest('.playlist-card[data-playlist-id]');
  if (playlistCard) {
    openPlaylistDetail(playlistCard.dataset.playlistId);
    return;
  }
});

// ===== Play Song From Any List =====
function playSongFromAny(id) {
  // Önce playlist şarkılarında ara
  if (currentPlaylistSongs.length > 0) {
    const song = currentPlaylistSongs.find(s => s.id === id);
    if (song) {
      player.playSong(song, currentPlaylistSongs);
      return;
    }
  }
  
  // allSongs'da ara
  let song = allSongs.find(s => s.id === id);
  let songList = allSongs;
  
  // Bulamazsa search sonuçlarında ara
  if (!song && searchResultSongs.length > 0) {
    song = searchResultSongs.find(s => s.id === id);
    songList = searchResultSongs;
  }
  
  if (song) {
    player.playSong(song, songList);
  }
}

function findSongById(id) {
  // Playlist şarkılarında ara
  if (currentPlaylistSongs.length > 0) {
    const song = currentPlaylistSongs.find(s => s.id === id);
    if (song) return song;
  }
  // allSongs'da ara
  let song = allSongs.find(s => s.id === id);
  if (song) return song;
  // Search sonuçlarında ara
  if (searchResultSongs.length > 0) {
    song = searchResultSongs.find(s => s.id === id);
    if (song) return song;
  }
  return null;
}

// ===== Player Controls =====
function initPlayerControls() {
  document.getElementById('btn-play').addEventListener('click', () => player.togglePlay());
  document.getElementById('btn-next').addEventListener('click', () => player.next());
  document.getElementById('btn-prev').addEventListener('click', () => player.previous());
  document.getElementById('btn-shuffle').addEventListener('click', () => player.toggleShuffle());
  document.getElementById('btn-repeat').addEventListener('click', () => player.toggleRepeat());

  // Progress bar - click & drag
  const progressBar = document.getElementById('progress-bar');
  let isDraggingProgress = false;
  
  const seekFromEvent = (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    player.seek(percent);
  };
  
  progressBar.addEventListener('mousedown', (e) => {
    isDraggingProgress = true;
    seekFromEvent(e);
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDraggingProgress) seekFromEvent(e);
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
  
  volumeSlider.addEventListener('mousedown', (e) => {
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
  document.getElementById('btn-like').addEventListener('click', async function() {
    const currentSong = player.getCurrentSong();
    if (!currentSong || !currentUserId) return;
    await toggleLikeSong(currentSong.id);
  });
}

// ===== Volume Toggle (Mute/Unmute) =====
function initVolumeToggle() {
  let previousVolume = 0.7;
  document.getElementById('btn-volume-icon').addEventListener('click', () => {
    if (player.volume > 0) {
      previousVolume = player.volume;
      player.setVolume(0);
    } else {
      player.setVolume(previousVolume);
    }
  });
}

// ===== Search =====
function initSearch() {
  const searchInput = document.getElementById('search-input');
  let debounceTimer;

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const query = searchInput.value.trim();
      if (query.length < 1) {
        searchResultSongs = [];
        document.getElementById('search-results').innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="currentColor" width="64" height="64" opacity="0.2"><path d="M10.533 1.279c-5.18 0-9.407 4.14-9.407 9.279s4.226 9.279 9.407 9.279c2.234 0 4.29-.77 5.907-2.058l4.353 4.353a1 1 0 101.414-1.414l-4.344-4.344a9.157 9.157 0 002.077-5.816c0-5.14-4.226-9.28-9.407-9.28zm-7.407 9.279c0-4.006 3.302-7.28 7.407-7.28s7.407 3.274 7.407 7.28-3.302 7.279-7.407 7.279-7.407-3.273-7.407-7.28z"/></svg>
            <p>Dinlemek istediğin şarkıyı ara</p>
          </div>`;
        return;
      }

      // Önce lokal ara (anında sonuç)
      const localResults = allSongs.filter(s => 
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase()) ||
        (s.album && s.album.toLowerCase().includes(query.toLowerCase()))
      );
      
      if (localResults.length > 0) {
        searchResultSongs = localResults;
        renderSearchResults(localResults, query);
      }

      // Sonra Supabase'den ara (daha kapsamlı)
      if (query.length >= 2) {
        try {
          const [songsResult, playlistsResult, usersResult] = await Promise.all([
            searchSongs(query),
            searchPublicPlaylists(query),
            searchUsers(query)
          ]);
          
          const songData = (!songsResult.error && songsResult.data) ? songsResult.data : localResults;
          const playlistData = (!playlistsResult.error && playlistsResult.data) ? playlistsResult.data : [];
          const userData = (!usersResult.error && usersResult.data) ? usersResult.data : [];
          
          if (songData.length > 0 || playlistData.length > 0 || userData.length > 0) {
            searchResultSongs = songData;
            renderSearchResults(songData, query, playlistData, userData);
          } else if (localResults.length === 0) {
            searchResultSongs = [];
            document.getElementById('search-results').innerHTML = `
              <div class="empty-state"><p>"${escapeHtml(query)}" için sonuç bulunamadı</p></div>`;
          }
        } catch (err) {
          console.error('Search error:', err);
        }
      } else if (localResults.length === 0) {
        searchResultSongs = [];
        document.getElementById('search-results').innerHTML = `
          <div class="empty-state"><p>"${escapeHtml(query)}" için sonuç bulunamadı</p></div>`;
      }
    }, 200);
  });
  
  // Enter tuşu ile de arama yap
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    }
  });

  // Global click delegate for "Add Friend" buttons and "User Cards"
  document.getElementById('search-results').addEventListener('click', async (e) => {
    // 1. Check for Add Friend button
    const btn = e.target.closest('.btn-add-friend');
    if (btn) {
      e.stopPropagation(); // Prevent card click
      const friendId = btn.dataset.userId;
      btn.classList.add('loading');
      btn.disabled = true;
      try {
        const { error } = await addFriend(friendId);
        if (error) throw error;
        showToast('Arkadaş eklendi! 🎉', 'success');
        btn.textContent = 'Eklendi';
        btn.classList.add('btn-success');
      } catch (err) {
        showToast('Eklenemedi (zaten ekli olabilir)', 'error');
        btn.textContent = 'Ekle';
        btn.disabled = false;
        btn.classList.remove('loading');
      }
      return;
    }
    
    // 2. Check for User Card click
    const card = e.target.closest('.user-search-card');
    if (card) {
      const userId = card.dataset.userId;
      if (userId) {
        loadPublicUserProfile(userId);
      }
    }
  });
}

function renderSearchResults(songs, query, playlists = [], users = []) {
  const container = document.getElementById('search-results');
  let html = '';
  
  // Users section
  if (users.length > 0) {
    html += `
      <h2 class="section-title">👤 Kullanıcılar</h2>
      <div class="users-grid" style="display:flex;gap:12px;margin-bottom:24px;overflow-x:auto;padding-bottom:8px">
        ${users.map(u => {
          const avatarHtml = u.avatar_url 
            ? `<img src="${u.avatar_url}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">` 
            : `<span style="width:50px;height:50px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--ts)">${getInitials(u.username)}</span>`;
          return `
          <div class="user-search-card" data-user-id="${u.id}" style="background:var(--bg-card);padding:12px;border-radius:12px;display:flex;flex-direction:column;align-items:center;min-width:140px;border:1px solid var(--border)">
            ${avatarHtml}
            <div style="font-weight:600;margin-top:8px">${escapeHtml(u.username)}${u.role === 'artist' ? getVerifiedTick() : ''}</div>
            <button class="btn-primary-small btn-add-friend" data-user-id="${u.id}" style="margin-top:12px;width:100%;padding:6px">Arkadaş Ekle</button>
          </div>`;
        }).join('')}
      </div>
    `;
  }
  
  // Public playlists section
  if (playlists.length > 0) {
    html += `
      <h2 class="section-title">🌐 Çalma Listeleri</h2>
      <div class="songs-grid">
        ${playlists.map(pl => {
          const coverHtml = pl.cover_url 
            ? `<img src="${pl.cover_url}" alt="${escapeHtml(pl.name)}" onerror="this.style.display='none'">` 
            : `<svg class="default-cover" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
          const ownerName = pl.profiles?.username || 'Kullanıcı';
          return `
          <div class="song-card playlist-card" data-playlist-id="${pl.id}">
            <div class="song-card-cover">
              ${coverHtml}
            </div>
            <div class="song-card-title">${escapeHtml(pl.name)}</div>
            <div class="song-card-artist">${escapeHtml(ownerName)} <span class="playlist-card-public">🌐</span></div>
          </div>`;
        }).join('')}
      </div>
    `;
  }
  
  // Songs section
  if (songs.length > 0) {
    html += `
      <h2 class="section-title">"${escapeHtml(query)}" için ${songs.length} şarkı</h2>
      <div class="songs-grid">
        ${songs.map(song => createSongCard(song)).join('')}
      </div>
    `;
  }
  
  if (!html) {
    html = `<div class="empty-state"><p>"${escapeHtml(query)}" için sonuç bulunamadı</p></div>`;
  }
  
  container.innerHTML = html;
}

// ===== Playlist Modal =====
function initPlaylistModal() {
  const overlay = document.getElementById('modal-overlay');
  const input = document.getElementById('playlist-name-input');
  
  const openModal = () => {
    overlay.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
  };
  const closeModal = () => {
    overlay.style.display = 'none';
    input.value = '';
    const descInput = document.getElementById('playlist-desc-input');
    if (descInput) descInput.value = '';
    const publicToggle = document.getElementById('playlist-public-toggle');
    if (publicToggle) publicToggle.checked = false;
  };

  document.getElementById('btn-create-playlist').addEventListener('click', openModal);
  const btnLib = document.getElementById('btn-create-playlist-library');
  if (btnLib) btnLib.addEventListener('click', openModal);
  
  document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  // Enter tuşu ile oluştur
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btn-modal-create').click();
    }
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  document.getElementById('btn-modal-create').addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) { showToast('Lütfen bir ad girin', 'error'); return; }
    
    const btn = document.getElementById('btn-modal-create');
    btn.textContent = 'Oluşturuluyor...';
    btn.disabled = true;
    
    try {
      const user = await getCurrentUser();
      if (!user) { showToast('Giriş yapmanız gerekiyor', 'error'); return; }
      
      // Profili garantile
      await ensureProfile(user.id, user.user_metadata?.username || user.email?.split('@')[0]);
      
      const description = (document.getElementById('playlist-desc-input')?.value || '').trim();
      const is_public = document.getElementById('playlist-public-toggle')?.checked || false;
      
      const { data, error } = await createPlaylist(name, user.id);
      if (error) {
        console.error('Playlist create error:', error);
        showToast('Çalma listesi oluşturulamadı: ' + (error.message || ''), 'error');
        return;
      }
      
      // Update with description and public status
      if (data && data.id && (description || is_public)) {
        const updates = {};
        if (description) updates.description = description;
        if (is_public) updates.is_public = is_public;
        try {
          await updatePlaylist(data.id, updates);
        } catch (e) {
          console.log('Playlist update extras error:', e);
        }
      }
      
      // If there's a pending song from right-click, add it to the new playlist
      const pendingSongId = input.dataset.pendingSongId;
      if (pendingSongId && data && data.id) {
        try {
          await addSongToPlaylist(data.id, pendingSongId, 0);
          showToast(`"${name}" oluşturuldu ve şarkı eklendi! 🎵`, 'success');
        } catch (addErr) {
          console.error('Pending song add error:', addErr);
          showToast(`"${name}" oluşturuldu! 🎵`, 'success');
        }
        delete input.dataset.pendingSongId;
      } else {
        showToast(`"${name}" çalma listesi oluşturuldu! 🎵`, 'success');
      }
      
      closeModal();
      loadPlaylists();
    } catch (err) {
      console.error('Playlist error:', err);
      showToast('Bir hata oluştu', 'error');
    } finally {
      btn.textContent = 'Oluştur';
      btn.disabled = false;
    }
  });
}

// ===== Load Playlists =====
async function loadPlaylists() {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    const { data, error } = await fetchUserPlaylists(user.id);
    userPlaylists = data || [];
    
    const list = document.getElementById('playlist-list');
    
    if (error || !data || data.length === 0) {
      list.innerHTML = `
        <div class="playlist-empty">
          <p>Henüz çalma listen yok</p>
          <small>İlk çalma listeni oluştur!</small>
        </div>`;
      return;
    }
    
    list.innerHTML = data.map(pl => {
      const coverHtml = pl.cover_url 
        ? `<img src="${pl.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:4px">` 
        : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      const publicIcon = pl.is_public ? '<span class="pl-public-icon" title="Herkese Açık">🌐</span>' : '';
      return `
      <div class="playlist-item" data-playlist-id="${pl.id}">
        <div class="playlist-item-cover">
          ${coverHtml}
        </div>
        <div class="playlist-item-info">
          <div class="playlist-item-name">${escapeHtml(pl.name)} ${publicIcon}</div>
          <div class="playlist-item-meta">Çalma Listesi</div>
        </div>
      </div>
    `;
    }).join('');
  } catch (err) {
    console.error('Playlists load error:', err);
  }
}

// ===== Load Library Page =====
async function loadLibraryPage() {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    const { data, error } = await fetchUserPlaylists(user.id);
    
    const container = document.getElementById('library-playlists');
    
    if (error || !data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor" width="64" height="64" opacity="0.2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          <p>Henüz çalma listen yok</p>
          <button class="btn-primary-small" id="btn-create-playlist-library">Çalma Listesi Oluştur</button>
        </div>`;
      // Re-bind the button
      const btn = document.getElementById('btn-create-playlist-library');
      if (btn) btn.addEventListener('click', () => {
        document.getElementById('modal-overlay').style.display = 'flex';
        setTimeout(() => document.getElementById('playlist-name-input').focus(), 100);
      });
      return;
    }
    
    container.innerHTML = data.map(pl => {
      const coverHtml = pl.cover_url 
        ? `<img src="${pl.cover_url}" alt="${escapeHtml(pl.name)}" onerror="this.style.display='none'">` 
        : `<svg class="default-cover" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      const publicBadge = pl.is_public ? '<span class="playlist-card-public">🌐 Public</span>' : '';
      return `
      <div class="song-card playlist-card" data-playlist-id="${pl.id}">
        <div class="song-card-cover">
          ${coverHtml}
        </div>
        <div class="song-card-title">${escapeHtml(pl.name)}</div>
        <div class="song-card-artist">Çalma Listesi ${publicBadge}</div>
      </div>
    `;
    }).join('');
  } catch (err) {
    console.error('Library load error:', err);
  }
  
  // Beğenilen şarkıları yükle
  await loadLibraryLikedSongs();
}

async function loadLibraryLikedSongs() {
  if (!currentUserId) return;
  try {
    const { data, error } = await fetchLikedSongs(currentUserId);
    const container = document.getElementById('liked-songs');
    
    if (error || !data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          <p>Henüz beğendiğin şarkı yok</p>
        </div>`;
      return;
    }
    
    const songs = data.map(d => d.songs).filter(Boolean);
    if (songs.length > 0) {
      container.innerHTML = `
        <div class="song-list-header">
          <span>#</span>
          <span>Başlık</span>
          <span>Albüm</span>
          <span>Süre</span>
        </div>
        ${songs.map((song, i) => renderSongListItem(song, i + 1)).join('')}
      `;
    }
  } catch (err) {
    console.error('Liked songs load error:', err);
  }
}

// ===== Playlist Detail Page =====
async function openPlaylistDetail(playlistId) {
  currentPlaylistId = playlistId;
  navigateTo('playlist');
  
  // Fetch fresh playlist data from Supabase
  let playlist = userPlaylists.find(p => p.id === playlistId);
  try {
    const { data: freshPlaylist } = await fetchPlaylistById(playlistId);
    if (freshPlaylist) playlist = freshPlaylist;
  } catch (e) {
    console.log('Fetch playlist error, using cached:', e);
  }
  
  const playlistName = playlist ? playlist.name : 'Çalma Listesi';
  const isOwner = playlist && playlist.user_id === currentUserId;
  
  // Set banner info
  document.getElementById('playlist-detail-title').textContent = playlistName;
  
  // Description
  const descEl = document.getElementById('playlist-detail-description');
  if (playlist && playlist.description) {
    descEl.textContent = playlist.description;
    descEl.style.display = 'block';
  } else {
    descEl.style.display = 'none';
  }
  
  // Public badge
  const publicBadge = document.getElementById('playlist-public-badge');
  if (playlist && playlist.is_public) {
    publicBadge.style.display = 'inline-block';
  } else {
    publicBadge.style.display = 'none';
  }
  
  // Show/hide edit and delete buttons based on ownership
  const actionsContainer = document.getElementById('playlist-detail-actions');
  const editBtn = document.getElementById('btn-playlist-edit');
  const deleteBtn = document.getElementById('btn-playlist-delete');
  if (editBtn) editBtn.style.display = isOwner ? 'flex' : 'none';
  if (deleteBtn) deleteBtn.style.display = isOwner ? 'flex' : 'none';
  
  // User info
  if (isOwner) {
    const userName = document.getElementById('user-name').textContent;
    document.getElementById('playlist-detail-user').textContent = userName;
    const avatarEl = document.getElementById('playlist-detail-avatar');
    const sidebarAvatar = document.getElementById('user-avatar');
    if (sidebarAvatar) {
      avatarEl.innerHTML = sidebarAvatar.innerHTML;
    }
  } else if (playlist && playlist.profiles) {
    document.getElementById('playlist-detail-user').textContent = playlist.profiles.username || 'Kullanıcı';
    const avatarEl = document.getElementById('playlist-detail-avatar');
    if (playlist.profiles.avatar_url) {
      avatarEl.innerHTML = `<img src="${playlist.profiles.avatar_url}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    } else {
      avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff">${getInitials(playlist.profiles.username || '?')}</div>`;
    }
  } else {
    const userName = document.getElementById('user-name').textContent;
    document.getElementById('playlist-detail-user').textContent = userName;
    const avatarEl = document.getElementById('playlist-detail-avatar');
    const sidebarAvatar = document.getElementById('user-avatar');
    if (sidebarAvatar) avatarEl.innerHTML = sidebarAvatar.innerHTML;
  }

  // Set cover from playlist cover_url first, then fallback to first song
  const coverEl = document.getElementById('playlist-detail-cover');
  if (playlist && playlist.cover_url) {
    coverEl.innerHTML = `<img src="${playlist.cover_url}" alt="">`;
  }
  
  // Load songs
  const songsContainer = document.getElementById('playlist-detail-songs');
  songsContainer.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Şarkılar yükleniyor...</p></div>`;
  
  try {
    const { data, error } = await getPlaylistSongs(playlistId);
    if (error || !data || data.length === 0) {
      currentPlaylistSongs = [];
      document.getElementById('playlist-detail-count').textContent = '0 şarkı';
      document.getElementById('playlist-detail-duration').textContent = '0 dk';
      songsContainer.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          <p>Bu çalma listesinde henüz şarkı yok</p>
          ${isOwner ? '<small style="color:var(--tm);font-size:13px">Şarkılara sağ tıklayarak bu listeye ekleyebilirsin</small>' : ''}
        </div>`;
      return;
    }
    
    const songs = data.map(d => d.songs).filter(Boolean);
    currentPlaylistSongs = songs;
    
    // Update meta
    document.getElementById('playlist-detail-count').textContent = `${songs.length} şarkı`;
    const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0);
    const mins = Math.floor(totalDuration / 60);
    document.getElementById('playlist-detail-duration').textContent = mins > 60 ? `${Math.floor(mins/60)} sa ${mins%60} dk` : `${mins} dk`;
    
    // Update cover (only if no playlist cover_url)
    if (!playlist || !playlist.cover_url) {
      if (songs[0] && songs[0].cover_url) {
        coverEl.innerHTML = `<img src="${songs[0].cover_url}" alt="">`;
      } else {
        coverEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.5"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      }
    }
    
    // Render song list
    if (songs.length > 0) {
      songsContainer.innerHTML = `
        <div class="song-list-header">
          <span>#</span>
          <span>Başlık</span>
          <span>Albüm</span>
          <span>Süre</span>
        </div>
        ${songs.map((song, i) => renderSongListItem(song, i + 1)).join('')}
      `;
    }
  } catch (err) {
    console.error('Playlist detail error:', err);
    songsContainer.innerHTML = `<div class="empty-state"><p>Şarkılar yüklenemedi</p></div>`;
  }
}

// ===== Playlist Detail Actions =====
function initPlaylistDetailActions() {
  // Play all
  document.getElementById('btn-playlist-play').addEventListener('click', () => {
    if (currentPlaylistSongs.length > 0) {
      player.playSong(currentPlaylistSongs[0], currentPlaylistSongs);
    } else {
      showToast('Çalma listesinde şarkı yok', 'error');
    }
  });
  
  // Shuffle play
  document.getElementById('btn-playlist-shuffle').addEventListener('click', () => {
    if (currentPlaylistSongs.length > 0) {
      player.playShuffled(currentPlaylistSongs);
      showToast('Rastgele çalma başladı 🔀', 'success');
    } else {
      showToast('Çalma listesinde şarkı yok', 'error');
    }
  });
  
  // Edit playlist
  document.getElementById('btn-playlist-edit').addEventListener('click', () => {
    if (currentPlaylistId) {
      openEditPlaylistModal(currentPlaylistId);
    }
  });
  
  // Delete playlist
  document.getElementById('btn-playlist-delete').addEventListener('click', () => {
    if (currentPlaylistId) {
      confirmDeletePlaylist(currentPlaylistId);
    }
  });
  
  // Edit playlist modal events
  initEditPlaylistModal();
}

// ===== Edit Playlist Modal =====
let editPlaylistCoverFile = null;

function initEditPlaylistModal() {
  const overlay = document.getElementById('edit-playlist-overlay');
  const cancelBtn = document.getElementById('btn-edit-playlist-cancel');
  const saveBtn = document.getElementById('btn-edit-playlist-save');
  const coverFileInput = document.getElementById('edit-playlist-cover-file');
  const coverLabel = document.getElementById('edit-playlist-cover-label');
  const coverPreview = document.getElementById('edit-playlist-cover-preview');
  const coverRemove = document.getElementById('edit-playlist-cover-remove');
  
  cancelBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    editPlaylistCoverFile = null;
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
      editPlaylistCoverFile = null;
    }
  });
  
  // Cover file selection
  coverLabel.addEventListener('click', (e) => {
    e.preventDefault();
    coverFileInput.click();
  });
  
  coverFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Dosya 5MB\'dan küçük olmalı', 'error');
      return;
    }
    editPlaylistCoverFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('edit-playlist-cover-img').src = ev.target.result;
      coverPreview.style.display = 'flex';
      coverLabel.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
  
  coverRemove.addEventListener('click', () => {
    editPlaylistCoverFile = null;
    coverPreview.style.display = 'none';
    coverLabel.style.display = 'flex';
    coverFileInput.value = '';
  });
  
  // Save
  saveBtn.addEventListener('click', async () => {
    const name = document.getElementById('edit-playlist-name').value.trim();
    const description = document.getElementById('edit-playlist-desc').value.trim();
    const is_public = document.getElementById('edit-playlist-public-toggle').checked;
    
    if (!name) { showToast('Ad boş olamaz', 'error'); return; }
    
    saveBtn.textContent = 'Kaydediliyor...';
    saveBtn.disabled = true;
    
    try {
      const updates = { name, description: description || null, is_public };
      
      // Upload cover if selected
      if (editPlaylistCoverFile && currentPlaylistId) {
        const { data: coverUrl, error: coverErr } = await uploadPlaylistCover(currentPlaylistId, editPlaylistCoverFile);
        if (coverErr) {
          showToast('Kapak yüklenemedi: ' + (coverErr.message || ''), 'error');
        } else {
          updates.cover_url = coverUrl;
        }
      }
      
      const { error } = await updatePlaylist(currentPlaylistId, updates);
      if (error) throw error;
      
      showToast('Çalma listesi güncellendi ✅', 'success');
      overlay.style.display = 'none';
      editPlaylistCoverFile = null;
      
      // Refresh
      await loadPlaylists();
      openPlaylistDetail(currentPlaylistId);
    } catch (err) {
      showToast('Güncellenemedi: ' + (err.message || ''), 'error');
    } finally {
      saveBtn.textContent = 'Kaydet';
      saveBtn.disabled = false;
    }
  });
}

async function openEditPlaylistModal(playlistId) {
  const overlay = document.getElementById('edit-playlist-overlay');
  
  // Fetch current data
  let playlist = userPlaylists.find(p => p.id === playlistId);
  try {
    const { data } = await fetchPlaylistById(playlistId);
    if (data) playlist = data;
  } catch (e) {}
  
  if (!playlist) return;
  
  document.getElementById('edit-playlist-name').value = playlist.name || '';
  document.getElementById('edit-playlist-desc').value = playlist.description || '';
  document.getElementById('edit-playlist-public-toggle').checked = playlist.is_public || false;
  
  // Show current cover
  const coverLabel = document.getElementById('edit-playlist-cover-label');
  const coverPreview = document.getElementById('edit-playlist-cover-preview');
  if (playlist.cover_url) {
    document.getElementById('edit-playlist-cover-img').src = playlist.cover_url;
    coverPreview.style.display = 'flex';
    coverLabel.style.display = 'none';
  } else {
    coverPreview.style.display = 'none';
    coverLabel.style.display = 'flex';
  }
  
  editPlaylistCoverFile = null;
  overlay.style.display = 'flex';
}

// ===== Confirm Delete Playlist =====
function confirmDeletePlaylist(playlistId) {
  const playlist = userPlaylists.find(p => p.id === playlistId);
  const name = playlist ? playlist.name : 'Bu çalma listesi';
  
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <h3>Çalma Listesini Sil</h3>
      <p>"${escapeHtml(name)}" çalma listesini silmek istediğine emin misin? Bu işlem geri alınamaz.</p>
      <div class="modal-actions">
        <button class="btn-cancel" id="btn-confirm-cancel">İptal</button>
        <button class="btn-danger-solid" id="btn-confirm-delete">Sil</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  overlay.querySelector('#btn-confirm-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  
  overlay.querySelector('#btn-confirm-delete').addEventListener('click', async () => {
    try {
      await deletePlaylist(playlistId);
      showToast(`"${name}" silindi 🗑️`, 'success');
      overlay.remove();
      currentPlaylistId = null;
      currentPlaylistSongs = [];
      await loadPlaylists();
      navigateTo('library');
    } catch (err) {
      showToast('Silinemedi', 'error');
    }
  });
}

// ===== Remove Song from Playlist =====
async function removeSongFromCurrentPlaylist(songId) {
  if (!currentPlaylistId || !songId) return;
  try {
    await removeSongFromPlaylist(currentPlaylistId, songId);
    showToast('Şarkı listeden çıkarıldı', 'success');
    // Reload playlist detail
    openPlaylistDetail(currentPlaylistId);
  } catch (err) {
    showToast('Çıkarılamadı', 'error');
  }
}

// ===== Logout =====
function initLogout() {
  document.getElementById('btn-logout').addEventListener('click', async () => {
    try {
      await signOut();
      window.electronAPI.navigateToAuth();
    } catch (err) {
      showToast('Çıkış yapılırken hata oluştu', 'error');
    }
  });
}

// ===== Helpers =====
function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function showToast(message, type = 'error') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3000);
}

function showEmptyState(containerId, message) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
  }
}

// ===== Like System =====
async function loadLikedSongs() {
  if (!currentUserId) return;
  try {
    const { data } = await fetchLikedSongs(currentUserId);
    userLikedSongIds = new Set((data || []).map(d => d.song_id));
    updateLikeButtonState();
  } catch (err) {
    console.log('Liked songs load error:', err);
  }
}

async function toggleLikeSong(songId) {
  if (!currentUserId) return;
  try {
    if (userLikedSongIds.has(songId)) {
      await unlikeSong(currentUserId, songId);
      userLikedSongIds.delete(songId);
      showToast('Beğenilenlerden çıkarıldı', 'success');
    } else {
      await likeSong(currentUserId, songId);
      userLikedSongIds.add(songId);
      showToast('Beğenilenlere eklendi ❤️', 'success');
    }
    updateLikeButtonState();
  } catch (err) {
    showToast('Beğeni işlemi başarısız', 'error');
  }
}

function updateLikeButtonState() {
  const btn = document.getElementById('btn-like');
  const currentSong = player.getCurrentSong();
  if (currentSong && userLikedSongIds.has(currentSong.id)) {
    btn.classList.add('liked');
  } else {
    btn.classList.remove('liked');
  }
}

// Update like button when song changes
const origUpdateUI = player.updateUI.bind(player);
player.updateUI = function(song) {
  origUpdateUI(song);
  updateLikeButtonState();
};

// ===== Context Menu =====
let contextMenuSongId = null;
let contextMenuPlaylistId = null;

function initContextMenu() {
  const menu = document.getElementById('context-menu');
  const submenu = document.getElementById('ctx-playlist-submenu');

  // Right-click on songs
  document.addEventListener('contextmenu', (e) => {
    // Check for playlist right-click first
    const playlistEl = e.target.closest('[data-playlist-id]');
    if (playlistEl && !e.target.closest('[data-song-id]')) {
      e.preventDefault();
      contextMenuPlaylistId = playlistEl.dataset.playlistId;
      showPlaylistContextMenu(e.clientX, e.clientY);
      return;
    }
    
    const songEl = e.target.closest('[data-song-id]');
    if (songEl) {
      e.preventDefault();
      contextMenuSongId = songEl.dataset.songId;
      
      // Show/hide "remove from playlist" based on context
      const removeItem = document.getElementById('ctx-remove-from-playlist');
      const removeDivider = document.getElementById('ctx-remove-divider');
      if (currentPage === 'playlist' && currentPlaylistId) {
        removeItem.style.display = 'flex';
        removeDivider.style.display = 'block';
      } else {
        removeItem.style.display = 'none';
        removeDivider.style.display = 'none';
      }
      
      showContextMenu(e.clientX, e.clientY);
    }
  });

  // Close menu on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu') && !e.target.closest('.context-submenu')) {
      hideContextMenu();
    }
  });

  // Play
  document.getElementById('ctx-play').addEventListener('click', () => {
    if (contextMenuSongId) playSongFromAny(contextMenuSongId);
    hideContextMenu();
  });

  // Add to queue
  document.getElementById('ctx-queue').addEventListener('click', () => {
    if (contextMenuSongId) {
      const song = findSongById(contextMenuSongId);
      if (song) {
        const result = player.addToQueue(song);
        if (result === 'duplicate') {
          showToast('Bu şarkı zaten sırada', 'error');
        } else if (result === 'added') {
          showToast(`"${song.title}" sıraya eklendi 🎵`, 'success');
        } else {
          showToast(`"${song.title}" çalınıyor 🎵`, 'success');
        }
      } else {
        showToast('Şarkı bulunamadı', 'error');
      }
    }
    hideContextMenu();
  });

  // Like/Unlike
  document.getElementById('ctx-like').addEventListener('click', async () => {
    if (contextMenuSongId) {
      await toggleLikeSong(contextMenuSongId);
    }
    hideContextMenu();
  });
  
  // Remove from playlist
  document.getElementById('ctx-remove-from-playlist').addEventListener('click', async () => {
    if (contextMenuSongId) {
      await removeSongFromCurrentPlaylist(contextMenuSongId);
    }
    hideContextMenu();
  });

  // Show playlist submenu
  let submenuHideTimer = null;

  const showSubmenu = () => {
    clearTimeout(submenuHideTimer);
    loadPlaylistSubmenu();
    submenu.style.display = 'block';
  };

  const hideSubmenuDelayed = () => {
    submenuHideTimer = setTimeout(() => {
      submenu.style.display = 'none';
    }, 150);
  };

  document.getElementById('ctx-add-to-playlist').addEventListener('mouseenter', showSubmenu);
  document.getElementById('ctx-add-to-playlist').addEventListener('mouseleave', hideSubmenuDelayed);
  submenu.addEventListener('mouseenter', () => clearTimeout(submenuHideTimer));
  submenu.addEventListener('mouseleave', hideSubmenuDelayed);

  // New playlist from song
  document.getElementById('ctx-new-playlist-from-song').addEventListener('click', async () => {
    hideContextMenu();
    const overlay = document.getElementById('modal-overlay');
    overlay.style.display = 'flex';
    const input = document.getElementById('playlist-name-input');
    input.focus();
    // Store song to add after creation
    input.dataset.pendingSongId = contextMenuSongId;
  });
}

// ===== Playlist Context Menu =====
function initPlaylistContextMenu() {
  const menu = document.getElementById('playlist-context-menu');
  
  // Play all
  document.getElementById('pctx-play').addEventListener('click', async () => {
    if (contextMenuPlaylistId) {
      const { data } = await getPlaylistSongs(contextMenuPlaylistId);
      const songs = (data || []).map(d => d.songs).filter(Boolean);
      if (songs.length > 0) {
        player.playSong(songs[0], songs);
      } else {
        showToast('Çalma listesinde şarkı yok', 'error');
      }
    }
    hideContextMenu();
  });
  
  // Shuffle play
  document.getElementById('pctx-shuffle').addEventListener('click', async () => {
    if (contextMenuPlaylistId) {
      const { data } = await getPlaylistSongs(contextMenuPlaylistId);
      const songs = (data || []).map(d => d.songs).filter(Boolean);
      if (songs.length > 0) {
        player.playShuffled(songs);
        showToast('Rastgele çalma başladı 🔀', 'success');
      } else {
        showToast('Çalma listesinde şarkı yok', 'error');
      }
    }
    hideContextMenu();
  });
  
  // Delete
  document.getElementById('pctx-delete').addEventListener('click', () => {
    if (contextMenuPlaylistId) {
      confirmDeletePlaylist(contextMenuPlaylistId);
    }
    hideContextMenu();
  });
}

function showContextMenu(x, y) {
  // Hide playlist context menu if open
  document.getElementById('playlist-context-menu').style.display = 'none';
  
  const menu = document.getElementById('context-menu');
  menu.style.display = 'block';
  
  // Update like text
  const likeItem = document.getElementById('ctx-like');
  const likeSpan = likeItem.querySelector('span');
  if (userLikedSongIds.has(contextMenuSongId)) {
    likeSpan.textContent = 'Beğenmekten Vazgeç';
  } else {
    likeSpan.textContent = 'Beğen';
  }
  
  // Position check - don't overflow screen
  const menuW = 220;
  const menuH = 300;
  if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
  if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;
  
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  document.getElementById('ctx-playlist-submenu').style.display = 'none';
}

function showPlaylistContextMenu(x, y) {
  // Hide song context menu if open
  document.getElementById('context-menu').style.display = 'none';
  document.getElementById('ctx-playlist-submenu').style.display = 'none';
  
  const menu = document.getElementById('playlist-context-menu');
  menu.style.display = 'block';
  
  const menuW = 220;
  const menuH = 150;
  if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
  if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;
  
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

function hideContextMenu() {
  document.getElementById('context-menu').style.display = 'none';
  document.getElementById('ctx-playlist-submenu').style.display = 'none';
  document.getElementById('playlist-context-menu').style.display = 'none';
  contextMenuSongId = null;
  contextMenuPlaylistId = null;
}

function loadPlaylistSubmenu() {
  const list = document.getElementById('ctx-playlist-list');
  if (userPlaylists.length === 0) {
    list.innerHTML = '<div class="context-menu-item" style="color:var(--tm);cursor:default"><span>Çalma listesi yok</span></div>';
    return;
  }
  list.innerHTML = userPlaylists.map(pl => `
    <div class="context-menu-item" data-add-to-playlist="${pl.id}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <span>${escapeHtml(pl.name)}</span>
    </div>
  `).join('');

  // Bind click events
  list.querySelectorAll('[data-add-to-playlist]').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const plId = item.dataset.addToPlaylist;
      const songId = contextMenuSongId; // Store before hideContextMenu nullifies it
      if (songId && plId) {
        hideContextMenu();
        try {
          // Get current song count for position
          const { data: existing } = await getPlaylistSongs(plId);
          const position = existing ? existing.length : 0;
          const { error } = await addSongToPlaylist(plId, songId, position);
          if (error) {
            console.error('Add to playlist error:', error);
            if (error.code === '23505') {
              showToast('Bu şarkı zaten listede', 'error');
            } else {
              showToast('Eklenemedi: ' + (error.message || ''), 'error');
            }
          } else {
            showToast('Çalma listesine eklendi! 🎵', 'success');
          }
        } catch (err) {
          console.error('Add to playlist catch:', err);
          showToast('Eklenemedi', 'error');
        }
      } else {
        hideContextMenu();
      }
    });
  });
}

function findSongById(id) {
  return allSongs.find(s => s.id === id) || searchResultSongs.find(s => s.id === id) || currentPlaylistSongs.find(s => s.id === id);
}

// ===== Keyboard Shortcuts =====
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    player.togglePlay();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    navigateTo('search');
  }
  if (e.key === 'Escape') {
    hideContextMenu();
  }
});

// ===== Admin Panel =====

function initAdminActions() {
  // Add song button
  document.getElementById('btn-admin-add-song').addEventListener('click', handleAddSong);
  
  // User search
  const searchInput = document.getElementById('admin-user-search');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = searchInput.value.trim().toLowerCase();
      filterAdminUsers(query);
    }, 200);
  });
}

async function loadAdminPage() {
  // Load stats
  loadDashboardStats();
  // Load users
  loadAdminUsers();
  // Load songs
  loadAdminSongs();
}

async function loadDashboardStats() {
  try {
    const stats = await getDashboardStats();
    document.getElementById('stat-users').textContent = stats.users;
    document.getElementById('stat-songs').textContent = stats.songs;
    document.getElementById('stat-playlists').textContent = stats.playlists;
  } catch (err) {
    console.error('Stats error:', err);
  }
}

let allProfiles = [];

async function loadAdminUsers() {
  const container = document.getElementById('admin-users-table');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Y\u00fckleniyor...</p></div>';
  
  try {
    const { data, error } = await fetchAllProfiles();
    if (error) {
      container.innerHTML = '<div class="empty-state"><p>Kullan\u0131c\u0131lar y\u00fcklenemedi</p></div>';
      return;
    }
    allProfiles = data || [];
    renderAdminUsers(allProfiles);
    populateArtistDatalist(allProfiles);
  } catch (err) {
    console.error('Admin users error:', err);
  }
}

function populateArtistDatalist(profiles) {
  const datalist = document.getElementById('admin-artists-list');
  if (datalist) {
    const artists = profiles.filter(p => p.role === 'artist');
    datalist.innerHTML = artists.map(p => `<option value="${escapeHtml(p.username || 'Adsız')}"></option>`).join('');
  }
}

function renderAdminUsers(profiles) {
  const container = document.getElementById('admin-users-table');
  if (!profiles || profiles.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Kullan\u0131c\u0131 bulunamad\u0131</p></div>';
    return;
  }
  
  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Kullan\u0131c\u0131</th>
          <th>Rol</th>
          <th>Kay\u0131t Tarihi</th>
        </tr>
      </thead>
      <tbody>
        ${profiles.map(p => {
          const avatar = p.avatar_url 
            ? `<span class="user-row-avatar"><img src="${p.avatar_url}" alt=""></span>` 
            : `<span class="user-row-avatar">${getInitials(p.username || '?')}</span>`;
          const date = p.created_at ? new Date(p.created_at).toLocaleDateString('tr-TR') : '-';
          const isCurrentUser = p.id === currentUserId;
          return `
            <tr>
              <td>
                ${avatar}
                <span class="user-row-name">${escapeHtml(p.username || 'Adsız')}</span>
                ${isCurrentUser ? '<span style="color:var(--green);font-size:11px;margin-left:6px">(Sen)</span>' : ''}
              </td>
              <td>
                <select class="role-select" data-user-id="${p.id}" ${isCurrentUser ? 'disabled title="Kendi rol\u00fcn\u00fc de\u011fi\u015ftiremezsin"' : ''}>
                  <option value="user" ${(p.role || 'user') === 'user' ? 'selected' : ''}>\ud83d\udc64 Kullan\u0131c\u0131</option>
                  <option value="premium" ${p.role === 'premium' ? 'selected' : ''}>\u2b50 Premium</option>
                  <option value="artist" ${p.role === 'artist' ? 'selected' : ''}>\ud83c\udfa4 Sanat\u00e7\u0131</option>
                  <option value="yetkili" ${p.role === 'yetkili' ? 'selected' : ''}>\ud83d\udee1\ufe0f Yetkili</option>
                  <option value="admin" ${p.role === 'admin' ? 'selected' : ''}>\ud83d\udc51 Admin</option>
                </select>
              </td>
              <td class="user-row-date">${date}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  // Bind role change events
  container.querySelectorAll('.role-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const userId = select.dataset.userId;
      const newRole = e.target.value;
      try {
        const { error } = await updateUserRole(userId, newRole);
        if (error) {
          showToast('Rol g\u00fcncellenemedi: ' + (error.message || ''), 'error');
          loadAdminUsers(); // Revert
        } else {
          showToast('Rol güncellendi ✅', 'success');
        }
      } catch (err) {
        showToast('Hata oluştu', 'error');
      }
    });
  });
}

function filterAdminUsers(query) {
  if (!query) {
    renderAdminUsers(allProfiles);
    return;
  }
  const filtered = allProfiles.filter(p => 
    (p.username || '').toLowerCase().includes(query) ||
    (p.id || '').toLowerCase().includes(query)
  );
  renderAdminUsers(filtered);
}

async function loadAdminSongs() {
  const container = document.getElementById('admin-songs-list');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Y\u00fckleniyor...</p></div>';
  
  try {
    const { data, error } = await fetchAllSongs();
    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Şarkı bulunamadı</p></div>';
      return;
    }
    
    container.innerHTML = data.map((song, i) => `
      <div class="admin-song-row" data-song-id="${song.id}">
        <span class="song-num">${i + 1}</span>
        <span class="song-title-col">${escapeHtml(song.title)}</span>
        <span class="song-artist-col">${escapeHtml(song.artist)}</span>
        <span class="song-duration-col">${formatDuration(song.duration)}</span>
        <button class="btn-delete-song" data-delete-song="${song.id}" title="Şarkıyı Sil">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `).join('');
    
    // Bind delete events
    container.querySelectorAll('[data-delete-song]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const songId = btn.dataset.deleteSong;
        const song = data.find(s => s.id === songId);
        if (confirm(`"${song?.title || 'Bu şarkı'}" silinecek. Emin misin?`)) {
          try {
            const { error } = await deleteSong(songId);
            if (error) {
              showToast('Silinemedi: ' + (error.message || ''), 'error');
            } else {
              showToast('Şarkı silindi 🗑️', 'success');
              loadAdminSongs();
              loadDashboardStats();
              loadSongs(); // Refresh main song list
            }
          } catch (err) {
            showToast('Hata oluştu', 'error');
          }
        }
      });
    });
  } catch (err) {
    console.error('Admin songs error:', err);
  }
}

async function handleAddSong() {
  const title = document.getElementById('admin-song-title').value.trim();
  const artist = document.getElementById('admin-song-artist').value.trim();
  const album = document.getElementById('admin-song-album').value.trim();
  const duration = parseInt(document.getElementById('admin-song-duration').value) || null;
  const file_path = document.getElementById('admin-song-url').value.trim();
  const cover_url = document.getElementById('admin-song-cover').value.trim();
  
  if (!title || !artist || !file_path) {
    showToast('Şarkı adı, sanatçı ve dosya URL gerekli', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-admin-add-song');
  btn.disabled = true;
  btn.textContent = 'Ekleniyor...';
  
  try {
    const songData = { title, artist, file_path };
    if (album) songData.album = album;
    if (duration) songData.duration = duration;
    if (cover_url) songData.cover_url = cover_url;
    
    const { data, error } = await addSong(songData);
    if (error) {
      showToast('Eklenemedi: ' + (error.message || ''), 'error');
    } else {
      showToast(`"${title}" eklendi! 🎵`, 'success');
      // Clear form
      document.getElementById('admin-song-title').value = '';
      document.getElementById('admin-song-artist').value = '';
      document.getElementById('admin-song-album').value = '';
      document.getElementById('admin-song-duration').value = '';
      document.getElementById('admin-song-url').value = '';
      document.getElementById('admin-song-cover').value = '';
      // Refresh
      loadAdminSongs();
      loadDashboardStats();
      loadSongs(); // Refresh main song list
    }
  } catch (err) {
    showToast('Hata oluştu', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right:6px"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>Şarkı Ekle';
  }
}

// ===== Profile Page =====

function initProfilePage() {
  const saveBtn = document.getElementById('btn-save-profile');
  const changeAvatarBtn = document.getElementById('btn-change-avatar');
  if (saveBtn) saveBtn.addEventListener('click', handleSaveProfile);
  if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png, image/jpeg, image/jpg, image/webp';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          showToast('Dosya boyutu 5MB\'dan küçük olmalıdır', 'error');
          return;
        }
        
        try {
          const sb = getSupabase();
          const ext = file.name.split('.').pop();
          const fileName = `${currentUserId}-${Date.now()}.${ext}`;
          
          const { error: uploadError } = await sb.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });
            
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = sb.storage
            .from('avatars')
            .getPublicUrl(fileName);
            
          const { error: updateError } = await updateProfile(currentUserId, { avatar_url: publicUrl });
          if (updateError) throw updateError;
          
          showToast('Profil fotoğrafı güncellendi! 📸', 'success');
          loadProfilePage();
          loadUserInfo();
        } catch (err) {
          showToast('Yükleme sırasında hata oluştu', 'error');
        }
      };
      input.click();
    });
  }
  
  // Remove avatar button
  const removeAvatarBtn = document.getElementById('btn-remove-avatar');
  if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener('click', async () => {
      if (!confirm('Profil fotoğrafını kaldırmak istediğine emin misin?')) return;
      try {
        const { error } = await updateProfile(currentUserId, { avatar_url: null });
        if (error) throw error;
        showToast('Fotoğraf kaldırıldı', 'success');
        loadProfilePage();
        loadUserInfo();
      } catch (err) {
        showToast('Fotoğraf kaldırılamadı', 'error');
      }
    });
  }
}

async function loadProfilePage() {
  const user = await getCurrentUser();
  if (!user) return;
  
  try {
    const { data: profile } = await fetchProfile(user.id);
    document.getElementById('profile-email').value = user.email || '';
    if (profile) {
      document.getElementById('profile-username').value = profile.username || '';
      document.getElementById('profile-bio').value = profile.bio || '';
      document.getElementById('profile-date').textContent = new Date(profile.created_at || user.created_at).toLocaleDateString('tr-TR');
      
      const roleText = {
        admin: 'Admin',
        yetkili: 'Yetkili',
        artist: 'Sanatçı',
        premium: 'Premium'
      }[profile.role] || 'Kullanıcı';
      
      document.getElementById('profile-role-display').textContent = roleText;
      
      const avatarEl = document.getElementById('profile-avatar-large');
      const removeBtn = document.getElementById('btn-remove-avatar');
      if (profile.avatar_url) {
        avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar">`;
        if (removeBtn) removeBtn.style.display = 'block';
      } else {
        avatarEl.innerHTML = `<span style="font-size:40px;font-weight:700;color:var(--ts)">${getInitials(profile.username)}</span>`;
        if (removeBtn) removeBtn.style.display = 'none';
      }
    }
    
    const sb = getSupabase();
    const playlists = await sb.from('playlists').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const liked = await sb.from('liked_songs').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    
    // Follower count (people who added this user as a friend)
    const followers = await sb.from('friendships').select('*', { count: 'exact', head: true })
      .eq('friend_id', user.id)
      .eq('status', 'accepted'); // or ignore status, up to standard: .eq('status', 'accepted')
    
    document.getElementById('profile-stat-playlists').textContent = playlists.count || 0;
    document.getElementById('profile-stat-liked').textContent = liked.count || 0;
    
    const countEl = document.getElementById('profile-stat-followers');
    if (countEl) countEl.textContent = followers.count || 0;
  } catch (err) {
    console.error('Profile load error:', err);
  }
}

async function handleSaveProfile() {
  const username = document.getElementById('profile-username').value.trim();
  const bio = document.getElementById('profile-bio').value.trim();
  const btn = document.getElementById('btn-save-profile');
  
  if (!username) {
    showToast('Kullanıcı adı boş olamaz', 'error');
    return;
  }
  
  btn.classList.add('loading');
  btn.disabled = true;
  
  try {
    let { error } = await updateProfile(currentUserId, { username, bio });
    if (error && error.message && error.message.includes('bio')) {
      // Fallback if bio column doesn't exist
      const retry = await updateProfile(currentUserId, { username });
      error = retry.error;
    }
    if (error) throw error;
    showToast('Profil kaydedildi ✅', 'success');
    loadUserInfo(); // Update sidebar name
  } catch (err) {
    showToast('Profil kaydedilemedi', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ===== Public User Profile =====
let currentPublicUserId = null;

async function loadPublicUserProfile(userId) {
  if (userId === currentUserId) {
    navigateTo('profile');
    return;
  }
  
  try {
    const { data: profile, error } = await fetchUserPublicProfile(userId);
    if (error || !profile) {
      showToast(error?.message || 'Profil bulunamadı', 'error');
      navigateTo('home');
      return;
    }
    
    currentPublicUserId = userId;
    
    // Update Banner
    const usernameEl = document.getElementById('public-profile-username');
    usernameEl.innerHTML = `${escapeHtml(profile.username)}${profile.role === 'artist' ? getVerifiedTick() : ''}`;
    
    document.getElementById('public-profile-followers').textContent = `${profile.followers_count} Takipçi`;
    document.getElementById('public-profile-playlists').textContent = `${profile.playlists_count} Herkese Açık Liste`;
    
    const avatarEl = document.getElementById('public-profile-avatar');
    if (profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar">`;
    } else {
      avatarEl.innerHTML = `<span style="font-size:60px;font-weight:700;color:var(--ts)">${getInitials(profile.username)}</span>`;
    }
    
    // Setup Buttons
    const followBtn = document.getElementById('btn-public-follow');
    if (profile.is_following) {
      followBtn.textContent = 'Takipten Çık';
      followBtn.classList.remove('btn-primary');
      followBtn.style.border = '1px solid var(--border)';
      followBtn.style.background = 'transparent';
      followBtn.onclick = async () => {
        followBtn.textContent = '...';
        await removeFriend(userId);
        loadPublicUserProfile(userId); // reload
      };
    } else {
      followBtn.textContent = 'Takip Et';
      followBtn.classList.add('btn-primary');
      followBtn.style.border = '';
      followBtn.style.background = '';
      followBtn.onclick = async () => {
        followBtn.textContent = '...';
        await addFriend(userId);
        loadPublicUserProfile(userId); // reload
      };
    }
    
    const blockBtn = document.getElementById('btn-public-block');
    blockBtn.onclick = async () => {
      if (!confirm(`${profile.username} isimli kullanıcıyı engellemek istediğinize emin misiniz?`)) return;
      await blockUser(userId);
      showToast('Kullanıcı engellendi', 'success');
      navigateTo('home');
    };
    
    // Fetch and render public playlists
    const sb = getSupabase();
    const { data: playlists } = await sb.from('playlists').select('*').eq('user_id', userId).eq('is_public', true).order('created_at', { ascending: false });
    
    const playlistsGrid = document.getElementById('public-profile-playlists-grid');
    if (playlists && playlists.length > 0) {
      playlistsGrid.innerHTML = playlists.map(pl => {
        const coverHtml = pl.cover_url 
          ? `<img src="${pl.cover_url}" alt="${escapeHtml(pl.name)}" onerror="this.style.display='none'">` 
          : `<svg class="default-cover" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
        return `
        <div class="song-card playlist-card" data-playlist-id="${pl.id}">
          <div class="song-card-cover">
            ${coverHtml}
          </div>
          <div class="song-card-title">${escapeHtml(pl.name)}</div>
        </div>`;
      }).join('');
    } else {
      playlistsGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1"><p>Bu kullanıcının herkese açık listesi yok</p></div>`;
    }
    
    // Show page
    navigateTo('user-profile');
    
  } catch (err) {
    showToast('Profil yüklenemedi', 'error');
  }
}

// ===== Artist Upload Page =====

function initArtistPage() {
  const btn = document.getElementById('btn-artist-submit-song');
  if (btn) btn.addEventListener('click', handleArtistSubmitSong);
}

async function loadArtistPage() {
  const container = document.getElementById('artist-submitted-songs');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Y\u00fckleniyor...</p></div>';
  
  try {
    const sb = getSupabase();
    const { data: profile } = await fetchProfile(currentUserId);
    if (!profile) return;
    
    // Sadece sanatçının adına göre arama yapıyoruz (kendi yüklediklerini görebilsin diye)
    const { data, error } = await sb.from('songs')
      .select('*')
      .ilike('artist', `%${profile.username}%`)
      .order('created_at', { ascending: false });
      
    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Henüz şarkı göndermedin</p></div>';
      return;
    }
    
    container.innerHTML = data.map(song => `
      <div class="pending-song-card" style="margin-bottom:8px">
        <div class="pending-song-info">
          <div class="pending-song-title">${escapeHtml(song.title)}</div>
          <div class="pending-song-artist">${escapeHtml(song.artist)}</div>
          <div class="pending-song-meta">
            ${song.album ? `${escapeHtml(song.album)} • ` : ''} 
            Durum: <span class="status-badge ${song.status === 'pending' ? 'pending' : (song.status === 'approved' ? 'approved' : 'rejected')}">${song.status === 'pending' ? 'Bekliyor' : 'Yayınlandı'}</span>
          </div>
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('Artist songs load error:', err);
    container.innerHTML = '<div class="empty-state"><p>Hata oluştu</p></div>';
  }
}

async function handleArtistSubmitSong() {
  const title = document.getElementById('artist-song-title').value.trim();
  const album = document.getElementById('artist-song-album').value.trim();
  const duration = parseInt(document.getElementById('artist-song-duration').value) || null;
  const file_path = document.getElementById('artist-song-url').value.trim();
  const cover_url = document.getElementById('artist-song-cover').value.trim();
  
  if (!title || !file_path) {
    showToast('Şarkı adı ve dosya URL gerekli', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-artist-submit-song');
  btn.disabled = true;
  btn.textContent = 'Gönderiliyor...';
  
  try {
    const { data: profile } = await fetchProfile(currentUserId);
    const artistName = profile.username || 'Bilinmeyen Sanatçı';
    
    const songData = { title, artist: artistName, file_path };
    if (album) songData.album = album;
    if (duration) songData.duration = duration;
    if (cover_url) songData.cover_url = cover_url;
    
    const { error } = await submitSongForApproval(songData);
    if (error) throw error;
    
    showToast(`"${title}" onaya gönderildi! 🕒`, 'success');
    
    document.getElementById('artist-song-title').value = '';
    document.getElementById('artist-song-album').value = '';
    document.getElementById('artist-song-duration').value = '';
    document.getElementById('artist-song-url').value = '';
    document.getElementById('artist-song-cover').value = '';
    
    loadArtistPage();
  } catch (err) {
    showToast('Hata oluştu: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right:6px"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>Şarkı Gönder';
  }
}

// ===== Admin Pending Songs =====
const originalLoadAdminPage = loadAdminPage;
loadAdminPage = async function() {
  await originalLoadAdminPage();
  loadAdminPendingSongs();
}

async function loadAdminPendingSongs() {
  let pendingSection = document.getElementById('admin-pending-songs-section');
  if (!pendingSection) {
    const adminPage = document.getElementById('page-admin');
    pendingSection = document.createElement('section');
    pendingSection.className = 'section';
    pendingSection.id = 'admin-pending-songs-section';
    pendingSection.innerHTML = `
      <h2 class="section-title">🕒 Onay Bekleyen Şarkılar</h2>
      <div id="admin-pending-songs-list">
        <div class="loading-state"><div class="spinner"></div><p>Y\u00fckleniyor...</p></div>
      </div>
    `;
    const sections = adminPage.querySelectorAll('.section');
    // Sanatçı listesinden önce 3. sıraya koyalım
    if (sections.length > 2) {
      adminPage.insertBefore(pendingSection, sections[2]);
    } else {
      adminPage.appendChild(pendingSection);
    }
  }
  
  const container = document.getElementById('admin-pending-songs-list');
  try {
    const { data, error } = await fetchPendingSongs();
    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state" style="margin-top:0;padding:24px"><p>Onay bekleyen şarkı yok</p></div>';
      return;
    }
    
    container.innerHTML = data.map(song => {
      const coverHtml = song.cover_url 
        ? `<img src="${song.cover_url}" alt="" class="pending-song-cover">` 
        : `<div class="pending-song-cover pending-song-cover-default"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>`;
      return `
      <div class="pending-song-card" style="margin-bottom:8px">
        ${coverHtml}
        <div class="pending-song-info">
          <div class="pending-song-title">${escapeHtml(song.title)}</div>
          <div class="pending-song-artist">${escapeHtml(song.artist)}</div>
          <div class="pending-song-meta">
            ${song.album ? `${escapeHtml(song.album)} • ` : ''} 
            ${new Date(song.created_at).toLocaleDateString()}
          </div>
        </div>
        <div class="pending-actions">
          <button class="btn-preview-song" data-preview-id="${song.id}" data-preview-url="${song.file_path}" data-preview-title="${escapeHtml(song.title)}" data-preview-artist="${escapeHtml(song.artist)}" data-preview-cover="${song.cover_url || ''}" title="Dinle">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="btn-approve" data-approve="${song.id}">Onayla</button>
          <button class="btn-reject" data-reject="${song.id}">Reddet</button>
        </div>
      </div>
    `;
    }).join('');
    
    container.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.approve;
        try {
          await approveSong(id);
          showToast('Şarkı onaylandı ✅', 'success');
          loadAdminPendingSongs();
          loadAdminSongs();
          loadSongs();
        } catch (err) {
          showToast('Hata', 'error');
        }
      });
    });
    
    container.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Şarkıyı reddedip silmek istediğinize emin misiniz?')) return;
        const id = btn.dataset.reject;
        try {
          await rejectSong(id);
          showToast('Şarkı reddedildi ❌', 'success');
          loadAdminPendingSongs();
        } catch (err) {
          showToast('Hata', 'error');
        }
      });
    });
    
    // Preview play button
    container.querySelectorAll('.btn-preview-song').forEach(btn => {
      btn.addEventListener('click', () => {
        const songObj = {
          id: btn.dataset.previewId,
          title: btn.dataset.previewTitle,
          artist: btn.dataset.previewArtist,
          file_path: btn.dataset.previewUrl,
          cover_url: btn.dataset.previewCover || null
        };
        player.playSong(songObj, [songObj]);
        showToast('Önizleme: ' + songObj.title + ' 🎧', 'success');
      });
    });
    
  } catch (err) {
    console.error('Pending songs error', err);
    container.innerHTML = '<div class="empty-state"><p>Hata oluştu</p></div>';
  }
}

// ===== Admin: Reserved Usernames =====
async function loadAdminReservedNames() {
  let section = document.getElementById('admin-reserved-section');
  if (!section) {
    const adminPage = document.getElementById('page-admin');
    section = document.createElement('section');
    section.className = 'section';
    section.id = 'admin-reserved-section';
    section.innerHTML = `
      <h2 class="section-title">🚫 Alınamayacak İsimler</h2>
      <div class="admin-add-song" style="margin-bottom:16px">
        <div class="admin-form-row">
          <input type="text" id="reserved-name-input" placeholder="İsim ekle..." maxlength="30">
          <button class="btn-primary-small" id="btn-add-reserved">Ekle</button>
        </div>
      </div>
      <div id="reserved-names-list"></div>
    `;
    adminPage.appendChild(section);
    
    // Add button handler
    document.getElementById('btn-add-reserved').addEventListener('click', async () => {
      const input = document.getElementById('reserved-name-input');
      const name = input.value.trim();
      if (!name) { showToast('İsim boş olamaz', 'error'); return; }
      
      const { error } = await addReservedUsername(name, currentUserId);
      if (error) {
        if (error.message?.includes('duplicate') || error.code === '23505') {
          showToast('Bu isim zaten ekli', 'error');
        } else {
          showToast('Hata: ' + (error.message || ''), 'error');
        }
        return;
      }
      showToast(`"${name}" eklendi 🚫`, 'success');
      input.value = '';
      loadAdminReservedNames();
    });
    
    document.getElementById('reserved-name-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-add-reserved').click();
    });
  }
  
  const container = document.getElementById('reserved-names-list');
  try {
    const { data, error } = await fetchReservedUsernames();
    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:16px"><p>Henüz alınamayacak isim eklenmemiş</p></div>';
      return;
    }
    
    container.innerHTML = `<div class="reserved-names-grid">${data.map(item => `
      <div class="reserved-name-tag">
        <span>${escapeHtml(item.username)}</span>
        <button class="reserved-name-remove" data-remove-id="${item.id}" title="Kaldır">✕</button>
      </div>
    `).join('')}</div>`;
    
    container.querySelectorAll('.reserved-name-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { error } = await removeReservedUsername(btn.dataset.removeId);
        if (error) { showToast('Silinemedi', 'error'); return; }
        showToast('İsim kaldırıldı', 'success');
        loadAdminReservedNames();
      });
    });
  } catch (err) {
    console.error('Reserved names error:', err);
  }
}

// ===== Admin: Add Ban/Delete to User Table =====
async function addAdminUserActions() {
  const rows = document.querySelectorAll('.admin-table tbody tr');
  
  for (const row of rows) {
    if (row.querySelector('.admin-user-actions')) continue;
    
    const roleSelect = row.querySelector('.role-select');
    if (!roleSelect) continue;
    const userId = roleSelect.dataset.userId;
    if (!userId || userId === currentUserId) continue;
    
    // Fetch ban status
    const sb = getSupabase();
    const { data: userProfile } = await sb.from('profiles').select('is_banned').eq('id', userId).maybeSingle();
    const isBanned = userProfile?.is_banned || false;
    
    const actionsCell = document.createElement('td');
    actionsCell.className = 'admin-user-actions';
    actionsCell.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center">
        ${isBanned 
          ? `<button class="btn-admin-unban" data-unban-user="${userId}" title="Engeli Kaldır" style="padding:3px 10px;border:1px solid #4caf50;background:rgba(76,175,80,.1);color:#4caf50;border-radius:500px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font)">Engeli Kaldır</button>`
          : `<button class="btn-admin-ban" data-ban-user="${userId}" title="Engelle">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>
            </button>`
        }
        <button class="btn-admin-delete" data-delete-user="${userId}" title="Hesabı Sil">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;
    row.appendChild(actionsCell);
    
    // Ban/Unban handler
    const banBtn = actionsCell.querySelector('.btn-admin-ban');
    const unbanBtn = actionsCell.querySelector('.btn-admin-unban');
    
    if (banBtn) {
      banBtn.addEventListener('click', async () => {
        if (!confirm('Bu kullanıcıyı engellemek istediğinize emin misiniz?')) return;
        const { error } = await adminBanUser(userId);
        if (error) { showToast('Engellenemedi: ' + (error.message || ''), 'error'); return; }
        showToast('Kullanıcı engellendi 🚫', 'success');
        // Remove old actions and re-add
        row.querySelectorAll('.admin-user-actions').forEach(el => el.remove());
        addAdminUserActions();
      });
    }
    
    if (unbanBtn) {
      unbanBtn.addEventListener('click', async () => {
        if (!confirm('Bu kullanıcının engelini kaldırmak istediğinize emin misiniz?')) return;
        const { error } = await adminUnbanUser(userId);
        if (error) { showToast('Engel kaldırılamadı: ' + (error.message || ''), 'error'); return; }
        showToast('Engel kaldırıldı ✅', 'success');
        row.querySelectorAll('.admin-user-actions').forEach(el => el.remove());
        addAdminUserActions();
      });
    }
    
    // Delete handler
    actionsCell.querySelector('.btn-admin-delete').addEventListener('click', async () => {
      if (!confirm('Bu kullanıcının hesabını SİLMEK istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
      if (!confirm('GERÇEKTEN EMİN MİSİNİZ? Tüm verileri silinecek!')) return;
      const { error } = await adminDeleteUser(userId);
      if (error) { showToast('Silinemedi: ' + (error.message || ''), 'error'); return; }
      showToast('Hesap silindi', 'success');
      loadAdminPage();
    });
  }
}

// Override loadAdminPage again to include new sections
const _prevLoadAdminPage = loadAdminPage;
loadAdminPage = async function() {
  await _prevLoadAdminPage();
  loadAdminReservedNames();
  // Delay to let user table render first
  setTimeout(() => addAdminUserActions(), 500);
}

// ===== Sidebar: Show verified tick for current user =====
const _origLoadUserInfo = loadUserInfo;
loadUserInfo = async function() {
  await _origLoadUserInfo();
  // Add verified tick if current user is artist
  if (currentUserRole === 'artist') {
    const nameEl = document.getElementById('user-name');
    if (nameEl && !nameEl.querySelector('.verified-tick')) {
      const badge = nameEl.querySelector('.role-badge');
      const tickSpan = document.createElement('span');
      tickSpan.className = 'verified-tick';
      tickSpan.title = 'Onaylı Sanatçı';
      tickSpan.textContent = '✓';
      if (badge) {
        badge.parentNode.insertBefore(tickSpan, badge);
      } else {
        nameEl.appendChild(tickSpan);
      }
    }
  }
}
