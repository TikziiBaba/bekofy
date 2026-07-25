// ===== Search Module - Arama =====

var searchHistoryItems = [];
var SEARCH_HISTORY_KEY = 'bekofy_search_history';
var MAX_SEARCH_HISTORY = 8;

function loadSearchHistory() {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    searchHistoryItems = stored ? JSON.parse(stored) : [];
  } catch { searchHistoryItems = []; }
}

function saveSearchHistory() {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistoryItems.slice(0, MAX_SEARCH_HISTORY)));
  } catch { }
}

function addToSearchHistory(query) {
  if (!query || query.length < 2) return;
  searchHistoryItems = searchHistoryItems.filter(h => h.toLowerCase() !== query.toLowerCase());
  searchHistoryItems.unshift(query);
  searchHistoryItems = searchHistoryItems.slice(0, MAX_SEARCH_HISTORY);
  saveSearchHistory();
}

function removeFromSearchHistory(query) {
  searchHistoryItems = searchHistoryItems.filter(h => h.toLowerCase() !== query.toLowerCase());
  saveSearchHistory();
  showSearchDiscovery();
}

window.clearSearchHistory = function() {
  searchHistoryItems = [];
  saveSearchHistory();
  showSearchDiscovery();
};

async function showSearchDiscovery() {
  const container = document.getElementById('search-results');
  let html = '';

  if (searchHistoryItems.length > 0) {
    html += `
      <div class="search-discovery-section">
        <div class="search-discovery-header">
          <h2 class="section-title">🕐 Son Aramalar</h2>
          <button class="btn-clear-history" onclick="clearSearchHistory()">Tümünü Temizle</button>
        </div>
        <div class="search-history-list">
          ${searchHistoryItems.map(item => `
            <div class="search-history-item" data-query="${escapeHtml(item)}">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" opacity="0.4"><path d="M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
              <span class="search-history-text">${escapeHtml(item)}</span>
              <button class="search-history-remove" data-remove="${escapeHtml(item)}" title="Kaldır">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  try {
    const sb = getSupabase();
    const [artistsRes, profilesRes] = await Promise.all([
      sb.from('artists').select('id, name, avatar_url').order('name').limit(20),
      sb.from('profiles').select('id, username, avatar_url, avatar_frame, role').eq('role', 'artist').order('username').limit(10)
    ]);

    const seen = new Set();
    const allArtistsDiscovery = [];

    for (const p of (profilesRes.data || [])) {
      const key = (p.username || '').toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        allArtistsDiscovery.push({ name: p.username, avatar_url: p.avatar_url, source: 'profile' });
      }
    }
    for (const a of (artistsRes.data || [])) {
      const key = (a.name || '').toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        allArtistsDiscovery.push({ name: a.name, avatar_url: a.avatar_url, source: 'artist' });
      }
    }

    if (allArtistsDiscovery.length > 0) {
      html += `
        <div class="search-discovery-section">
          <h2 class="section-title">🎤 Sanatçılar</h2>
          <div class="discovery-artists-grid">
            ${allArtistsDiscovery.slice(0, 12).map(a => {
        const initials = getInitials(a.name);
        const color = getAvatarColor(a.name);
        const avatarHtml = a.avatar_url
          ? `<img src="${a.avatar_url}" alt="${escapeHtml(a.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : '';
        return `
                <div class="discovery-artist-card" data-artist-name="${escapeHtml(a.name)}">
                  <div class="discovery-artist-avatar">
                    ${avatarHtml}
                    <div class="discovery-artist-avatar-fallback" ${a.avatar_url ? 'style="display:none"' : ''} style="background:${color}">${initials}</div>
                  </div>
                  <div class="discovery-artist-name">${escapeHtml(a.name)}${getVerifiedTick(a.name)}</div>
                  <div class="discovery-artist-role">Sanatçı</div>
                </div>
              `;
      }).join('')}
          </div>
        </div>
      `;
    }
  } catch (err) {
    Logger.error('Discovery artists error:', err);
  }

  if (window.allSongs && window.allSongs.length > 0) {
    const recentSongs = [...window.allSongs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

    if (recentSongs.length > 0) {
      html += `
        <div class="search-discovery-section">
          <h2 class="section-title">🔥 Popüler</h2>
          <div class="discovery-songs-list">
            ${recentSongs.map((song, i) => {
        const coverHtml = song.cover_url
          ? `<img src="${song.cover_url}" alt="" onerror="this.style.display='none'">`
          : `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.3"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
        return `
                <div class="discovery-song-item" data-song-id="${song.id}">
                  <div class="discovery-song-rank">${i + 1}</div>
                  <div class="discovery-song-cover">${coverHtml}</div>
                  <div class="discovery-song-info">
                    <div class="discovery-song-title">${escapeHtml(song.title)}</div>
                    <div class="discovery-song-artist">${formatArtistLinks(song.artist)}</div>
                  </div>
                </div>
              `;
      }).join('')}
          </div>
        </div>
      `;
    }

    const categories = [
      { emoji: '🎵', label: 'Tüm Şarkılar', color: '#1DB954' },
      { emoji: '❤️', label: 'Beğenilenler', color: '#e74c3c' },
      { emoji: '🆕', label: 'Yeni Eklenenler', color: '#9b59b6' },
      { emoji: '🎲', label: 'Rastgele Keşfet', color: '#e67e22' },
    ];

    html += `
      <div class="search-discovery-section">
        <h2 class="section-title">📂 Göz At</h2>
        <div class="discovery-categories-grid">
          ${categories.map(cat => `
            <div class="discovery-category-card" data-category="${cat.label}" style="background:linear-gradient(135deg, ${cat.color}22, ${cat.color}08);border-color:${cat.color}33">
              <span class="discovery-category-emoji">${cat.emoji}</span>
              <span class="discovery-category-label">${cat.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (!html) {
    html = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor" width="64" height="64" opacity="0.2"><path d="M10.533 1.279c-5.18 0-9.407 4.14-9.407 9.279s4.226 9.279 9.407 9.279c2.234 0 4.29-.77 5.907-2.058l4.353 4.353a1 1 0 101.414-1.414l-4.344-4.344a9.157 9.157 0 002.077-5.816c0-5.14-4.226-9.28-9.407-9.28zm-7.407 9.279c0-4.006 3.302-7.28 7.407-7.28s7.407 3.274 7.407 7.28-3.302 7.279-7.407 7.279-7.407-3.273-7.407-7.28z"/></svg>
        <p>Dinlemek istediğin şarkıyı ara</p>
      </div>
    `;
  }

  container.innerHTML = html;
  bindDiscoveryEvents();
}

function bindDiscoveryEvents() {
  const container = document.getElementById('search-results');

  container.querySelectorAll('.search-history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.search-history-remove')) return;
      const query = item.dataset.query;
      document.getElementById('top-search-input').value = query;
      document.getElementById('top-search-input').dispatchEvent(new Event('input'));
    });
  });

  container.querySelectorAll('.search-history-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromSearchHistory(btn.dataset.remove);
    });
  });

  container.querySelectorAll('.discovery-artist-card').forEach(card => {
    card.addEventListener('click', () => {
      const artistName = card.dataset.artistName;
      if (artistName) openArtistProfile(artistName);
    });
  });

  container.querySelectorAll('.discovery-song-item').forEach(item => {
    item.addEventListener('click', () => {
      const songId = item.dataset.songId;
      if (songId) playSongFromAny(songId);
    });
  });

  container.querySelectorAll('.discovery-category-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.dataset.category;
      if (cat === 'Tüm Şarkılar') {
        window.searchResultSongs = [...window.allSongs];
        renderSearchResults(window.allSongs, 'Tüm Şarkılar');
      } else if (cat === 'Beğenilenler') {
        const liked = window.allSongs.filter(s => window.userLikedSongIds.has(s.id));
        window.searchResultSongs = liked;
        renderSearchResults(liked, 'Beğenilen Şarkılar');
      } else if (cat === 'Yeni Eklenenler') {
        const recent = [...window.allSongs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);
        window.searchResultSongs = recent;
        renderSearchResults(recent, 'Yeni Eklenenler');
      } else if (cat === 'Rastgele Keşfet') {
        const shuffled = [...window.allSongs].sort(() => Math.random() - 0.5).slice(0, 20);
        window.searchResultSongs = shuffled;
        renderSearchResults(shuffled, 'Rastgele Keşfet');
      }
    });
  });
}

function renderSearchResults(songs, query, playlists = [], users = []) {
  const container = document.getElementById('search-results');
  let html = '';

  if (users.length > 0) {
    html += `
      <h2 class="section-title">👤 Kullanıcılar</h2>
      <div class="users-grid" style="display:flex;gap:12px;margin-bottom:24px;overflow-x:auto;padding-bottom:8px">
        ${users.map(u => {
      let frameClass = '';
      if (u.avatar_frame && u.avatar_frame !== 'none') {
        frameClass = ' ' + getAvatarFrameClass(u.avatar_frame);
      }
      const avatarHtml = u.avatar_url
        ? `<div class="search-avatar-wrapper${frameClass}" style="width:50px;height:50px;position:relative"><img src="${u.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;position:relative;z-index:2"></div>`
        : `<div class="search-avatar-wrapper${frameClass}" style="width:50px;height:50px;position:relative"><span style="width:100%;height:100%;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--ts);position:relative;z-index:2">${getInitials(u.username)}</span></div>`;
      return `
          <div class="user-search-card" data-user-id="${u.id}" data-user-role="${u.role}" data-user-name="${escapeHtml(u.username)}" style="background:var(--bg-card);padding:12px;border-radius:12px;display:flex;flex-direction:column;align-items:center;min-width:140px;border:1px solid var(--border)">
            ${avatarHtml}
            <div style="font-weight:600;margin-top:8px">${escapeHtml(u.username)}${u.role === 'artist' ? getVerifiedTick(u.username) : ''}</div>
            ${u.role === 'artist'
          ? `<button class="btn-primary-small btn-view-artist" data-artist-name="${escapeHtml(u.username)}" style="margin-top:12px;width:100%;padding:6px;background:var(--bg-card-hover);border:1px solid var(--border);color:var(--tp)">Profili Gör</button>`
          : `<button class="btn-primary-small btn-add-friend" data-user-id="${u.id}" style="margin-top:12px;width:100%;padding:6px">Arkadaş Ekle</button>`
        }
          </div>`;
    }).join('')}
      </div>
    `;
  }

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

window.initSearch = function() {
  const searchInput = document.getElementById('top-search-input');
  if (!searchInput) return;
  let debounceTimer;

  searchInput.addEventListener('focus', () => {
    if (window.currentPage !== 'search') {
      navigateTo('search');
    }
  });

  loadSearchHistory();
  showSearchDiscovery();

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const query = searchInput.value.trim();
      if (query.length < 1) {
        window.searchResultSongs = [];
        showSearchDiscovery();
        return;
      }

      const localResults = window.allSongs.filter(s =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase()) ||
        (s.album && s.album.toLowerCase().includes(query.toLowerCase()))
      );

      if (localResults.length > 0) {
        window.searchResultSongs = localResults;
        renderSearchResults(localResults, query);
      }

      if (query.length >= 2) {
        addToSearchHistory(query);
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
            window.searchResultSongs = songData;
            renderSearchResults(songData, query, playlistData, userData);
          } else if (localResults.length === 0) {
            window.searchResultSongs = [];
            document.getElementById('search-results').innerHTML = `
              <div class="empty-state"><p>"${escapeHtml(query)}" için sonuç bulunamadı</p></div>`;
          }
        } catch (err) {
          console.error('Search error:', err);
        }
      } else if (localResults.length === 0) {
        window.searchResultSongs = [];
        document.getElementById('search-results').innerHTML = `
          <div class="empty-state"><p>"${escapeHtml(query)}" için sonuç bulunamadı</p></div>`;
      }
    }, 200);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    }
  });

  document.getElementById('search-results').addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-add-friend');
    if (btn) {
      e.stopPropagation();
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

    const card = e.target.closest('.user-search-card');
    if (card) {
      if (e.target.closest('.btn-add-friend') || e.target.closest('.btn-view-artist')) return;
      const role = card.dataset.userRole;
      if (role === 'artist') {
        const artistName = card.dataset.userName;
        if (artistName) openArtistProfile(artistName);
      } else {
        const userId = card.dataset.userId;
        if (userId) loadPublicUserProfile(userId);
      }
    }

    const viewArtistBtn = e.target.closest('.btn-view-artist');
    if (viewArtistBtn) {
      e.stopPropagation();
      const artistName = viewArtistBtn.dataset.artistName;
      if (artistName) openArtistProfile(artistName);
    }
  });
};

// search.js - Arama: debounce, arama geçmişi, keşfet içeriği, sonuç renderleme
