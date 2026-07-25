// ===== Friend Activity Module - Arkadaş Aktivitesi =====

window.initFriendActivity = function() {
  const btnOpen = document.getElementById('btn-top-friend-activity');
  const btnClose = document.getElementById('btn-close-friend-activity');

  if (btnOpen) {
    btnOpen.onclick = function(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (typeof window.toggleFriendActivity === 'function') {
        window.toggleFriendActivity();
      }
    };
  }

  if (btnClose) {
    btnClose.onclick = function(e) {
      if (e) e.preventDefault();
      const sidebar = document.getElementById('friend-activity-sidebar');
      if (sidebar) {
        sidebar.classList.add('collapsed');
        sidebar.style.width = '0';
      }
      if (btnOpen) btnOpen.classList.remove('active');
    };
  }

  const refreshBtn = document.getElementById('refresh-friend-activity');
  if (refreshBtn) {
    refreshBtn.onclick = function() {
      if (typeof loadFriendActivity === 'function') loadFriendActivity();
    };
  }
};

async function loadFriendActivity() {
  const container = document.getElementById('friend-activity-list');
  if (!container) return;
  try {
    const sb = getSupabase();
    const { data: friends } = await sb.from('friendships')
      .select('friend_id')
      .eq('user_id', window.currentUserId);
    if (!friends || friends.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:40px 20px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">👥</div>
        <h3 style="margin-bottom:8px">Henüz arkadaşın yok</h3>
        <p style="color:var(--ts);margin-bottom:20px">Arkadaş ekleyerek onların ne dinlediğini görebilirsin</p>
        <button onclick="navigateTo('search')" class="btn btn-primary">Arkadaş Keşfet</button>
      </div>`;
      return;
    }
    container.innerHTML = '<div class="loading-spinner"></div>';
    const friendIds = friends.map(f => f.friend_id);
    const { data: profilesData } = await sb.from('profiles')
      .select('id, username, avatar_url, avatar_frame')
      .in('id', friendIds);
    const { data: sessions } = await sb.from('listening_sessions')
      .select('user_id, song_id, songs!inner(id, title, artist, cover_url), updated_at')
      .in('user_id', friendIds)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });
    const friendMap = {};
    (profilesData || []).forEach(p => { friendMap[p.id] = p; });
    let html = '';
    const activeListeners = (sessions || []).filter(s => {
      const lastUpdate = new Date(s.updated_at);
      const now = new Date();
      return (now - lastUpdate) < 5 * 60 * 1000;
    });
    if (activeListeners.length > 0) {
      html += `<div class="friend-activity-section">
        <div class="friend-activity-section-header">
          <span class="friend-activity-status online"></span>
          <span class="friend-activity-section-title">Şu An Dinliyor</span>
        </div>
        ${activeListeners.map(session => {
        const friend = friendMap[session.user_id];
        if (!friend) return '';
        const song = session.songs;
        const isPlaying = true;
        return `
            <div class="friend-activity-item" data-user-id="${friend.id}">
              <div class="friend-activity-avatar-wrapper">
                <div class="friend-activity-avatar ${friend.avatar_frame && friend.avatar_frame !== 'none' ? 'frame-' + friend.avatar_frame : ''}">
                  ${friend.avatar_url
            ? `<img src="${friend.avatar_url}" alt="${escapeHtml(friend.username)}">`
            : `<div class="friend-avatar-fallback">${getInitials(friend.username)}</div>`
          }
                </div>
                <div class="friend-activity-status-dot ${isPlaying ? 'playing' : ''}"></div>
              </div>
              <div class="friend-activity-info">
                <div class="friend-activity-header">
                  <span class="friend-activity-name">${escapeHtml(friend.username)}</span>
                  <span class="friend-activity-time">Az önce</span>
                </div>
                <div class="friend-activity-listening">
                  <span class="friend-activity-icon">${isPlaying ? '🎵' : '🎶'}</span>
                  <div class="friend-activity-song-info">
                    <span class="friend-activity-song-title">${escapeHtml(song.title)}</span>
                    <span class="friend-activity-song-artist">${formatArtistLinks(song.artist)}</span>
                  </div>
                </div>
              </div>
            </div>
          `;
      }).join('')}
      </div>`;
    }
    const recentLimit = 20;
    const { data: recentSessions } = await sb.from('listening_sessions')
      .select('user_id, song_id, songs!inner(id, title, artist, cover_url), updated_at')
      .in('user_id', friendIds)
      .not('user_id', 'in', `(${activeListeners.map(s => s.user_id).join(',')})`)
      .order('updated_at', { ascending: false })
      .limit(recentLimit * 2);
    const seenUsers = new Set(activeListeners.map(s => s.user_id));
    const recentUnique = [];
    if (recentSessions) {
      for (const session of recentSessions) {
        if (!seenUsers.has(session.user_id) && friendMap[session.user_id]) {
          seenUsers.add(session.user_id);
          recentUnique.push(session);
          if (recentUnique.length >= recentLimit) break;
        }
      }
    }
    if (recentUnique.length > 0) {
      html += `<div class="friend-activity-section">
        <div class="friend-activity-section-header">
          <span class="friend-activity-section-title">Son Aktiviteler</span>
        </div>
        ${recentUnique.map(session => {
        const friend = friendMap[session.user_id];
        if (!friend) return '';
        const song = session.songs;
        const timeAgo = getTimeAgo(session.updated_at);
        const isRecent = (new Date() - new Date(session.updated_at)) < 60 * 60 * 1000;
        return `
            <div class="friend-activity-item" data-user-id="${friend.id}">
              <div class="friend-activity-avatar-wrapper">
                <div class="friend-activity-avatar ${friend.avatar_frame && friend.avatar_frame !== 'none' ? 'frame-' + friend.avatar_frame : ''}">
                  ${friend.avatar_url
            ? `<img src="${friend.avatar_url}" alt="${escapeHtml(friend.username)}">`
            : `<div class="friend-avatar-fallback">${getInitials(friend.username)}</div>`
          }
                </div>
              </div>
              <div class="friend-activity-info">
                <div class="friend-activity-header">
                  <span class="friend-activity-name">${escapeHtml(friend.username)}</span>
                  <span class="friend-activity-time ${isRecent ? 'recent' : ''}">${timeAgo}</span>
                </div>
                <div class="friend-activity-listening">
                  <span class="friend-activity-icon">${isRecent ? '🎶' : '🎵'}</span>
                  <div class="friend-activity-song-info">
                    <span class="friend-activity-song-title">${escapeHtml(song.title)}</span>
                    <span class="friend-activity-song-artist">${formatArtistLinks(song.artist)}</span>
                  </div>
                </div>
              </div>
            </div>
          `;
      }).join('')}
      </div>`;
    }
    if (!html) {
      html = `<div class="empty-state" style="padding:40px 20px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">🎵</div>
        <h3 style="margin-bottom:8px">Henüz aktivite yok</h3>
        <p style="color:var(--ts)">Arkadaşların dinlemeye başladığında burada görünecek</p>
      </div>`;
    }
    container.innerHTML = html;
  } catch (err) {
    console.error('loadFriendActivity error:', err);
    container.innerHTML = '<p class="empty-state-text">Aktivite yüklenemedi</p>';
  }
}

function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'Az önce';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} hafta önce`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ay önce`;
  const years = Math.floor(days / 365);
  return `${years} yıl önce`;
}

// friend-activity.js - Arkadaş aktivitesi: dinleme durumu, son aktiviteler
