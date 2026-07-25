async function followUser(targetId) {
  if (targetId === window.currentUserId) return showToast('Kendinizi takip edemezsiniz', 'error');

  const targetProfile = await fetchProfile(targetId);
  if (!targetProfile) return showToast('Kullanıcı bulunamadı', 'error');

  const isArtist = targetProfile.role === 'artist';

  if (isArtist) {
    return followArtist(targetId, targetProfile.username);
  } else {
    return sendFriendRequest(targetId);
  }
}

async function followArtist(artistId, artistName) {
  const sb = getSupabase();

  const { data: existing } = await sb.from('follows')
    .select('*').eq('follower_id', window.currentUserId).eq('following_id', artistId).single();

  if (existing?.status === 'accepted') {
    return unfollowUser(artistId);
  }

  await sb.from('follows').upsert({ follower_id: window.currentUserId, following_id: artistId, status: 'accepted' });

  await createOrUpdateArtistFollowPlaylist(artistId, artistName);
  showToast(`${artistName} takip edildi - şarkıları "Sanatçı Takip Listesi"ne eklendi`, 'success');
  updateFollowUI(artistId, true);
}

async function createOrUpdateArtistFollowPlaylist(artistId, artistName) {
  const sb = getSupabase();

  let { data: link } = await sb.from('artist_follow_playlists')
    .select('playlist_id').eq('user_id', window.currentUserId).eq('artist_id', artistId).single();

  let playlistId = link?.playlist_id;

  if (!playlistId) {
    const { data: pl } = await sb.from('playlists').insert({
      user_id: window.currentUserId,
      name: `🎤 ${artistName} Takip Listesi`,
      description: `${artistName} sanatçısının takip edilen şarkıları`,
      is_public: false
    }).select('id').single();
    playlistId = pl.id;
    await sb.from('artist_follow_playlists').insert({ user_id: window.currentUserId, artist_id: artistId, playlist_id: playlistId });
  }

  const { data: songs } = await sb.from('songs').select('id').eq('artist_id', artistId).eq('status', 'approved');
  if (songs?.length) {
    const rows = songs.map((s, i) => ({ playlist_id: playlistId, song_id: s.id, position: i }));
    await sb.from('playlist_songs').upsert(rows, { onConflict: 'playlist_id,song_id' });
  }
}

async function sendFriendRequest(targetId) {
  const sb = getSupabase();

  const { data: existing } = await sb.from('follows')
    .select('*').eq('follower_id', window.currentUserId).eq('following_id', targetId).single();

  if (existing?.status === 'pending') return showToast('İstek zaten gönderilmiş', 'info');
  if (existing?.status === 'accepted') return showToast('Zaten arkadaşsınız', 'info');

  await sb.from('follows').upsert({ follower_id: window.currentUserId, following_id: targetId, status: 'pending' });
  showToast('Arkadaşlık isteği gönderildi', 'success');
  updateFollowUI(targetId, 'pending');
}

async function acceptFriendRequest(followerId) {
  const sb = getSupabase();
  await sb.from('follows').update({ status: 'accepted' }).eq('follower_id', followerId).eq('following_id', window.currentUserId);
  showToast('Arkadaşlık isteği kabul edildi', 'success');
  loadFollowers(window.currentUserId);
}

async function rejectFriendRequest(followerId) {
  const sb = getSupabase();
  await sb.from('follows').delete().eq('follower_id', followerId).eq('following_id', window.currentUserId);
  showToast('İstek reddedildi', 'info');
  loadFollowers(window.currentUserId);
}

async function unfollowUser(targetId) {
  const sb = getSupabase();

  const { data: follow } = await sb.from('follows')
    .select('*').eq('follower_id', window.currentUserId).eq('following_id', targetId).single();

  if (!follow) return;

  if (follow.status === 'accepted') {
    const { data: target } = await sb.from('profiles').select('role').eq('id', targetId).single();
    if (target?.role === 'artist') {
      await sb.from('artist_follow_playlists').delete().eq('user_id', window.currentUserId).eq('artist_id', targetId);
      const { data: pl } = await sb.from('playlists').select('id').eq('user_id', window.currentUserId).ilike('name', `🎤 % Takip Listesi`).single();
      if (pl) await sb.from('playlists').delete().eq('id', pl.id);
    }
  }

  await sb.from('follows').delete().eq('follower_id', window.currentUserId).eq('following_id', targetId);
  showToast('Takip bırakıldı', 'info');
  updateFollowUI(targetId, false);
}

async function loadFollowers(userId, containerId = 'followers-list') {
  const sb = getSupabase();
  const { data } = await sb.from('follows')
    .select(`follower_id, created_at, profiles!follows_follower_id_fkey(username, avatar_url, role)`)
    .eq('following_id', userId).eq('status', 'accepted');

  const container = document.getElementById(containerId);
  if (!data?.length) {
    container.innerHTML = '<div class="empty-state" style="text-align:center;padding:40px"><p>Henüz takipçi yok</p></div>';
    return;
  }

  container.innerHTML = data.map(f => {
    const p = f.profiles;
    return `
      <div class="follow-item">
        <img class="follow-avatar" src="${p.avatar_url || ''}" alt="${escapeHtml(p.username)}" onerror="this.src='';this.outerHTML='<div class=\\'follow-avatar\\' style=\\'background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%\\'>${getInitials(p.username)}</div>'">
        <div class="follow-info">
          <div class="follow-name">${escapeHtml(p.username)}${p.role === 'artist' ? ' <span class="role-badge artist">Sanatçı</span>' : ''}</div>
          <div class="follow-meta"><span>${formatDate(f.created_at)}</span></div>
        </div>
        <button class="follow-btn following" data-id="${f.follower_id}" onclick="unfollowUser(this.dataset.id)">Takipten Çık</button>
      </div>
    `;
  }).join('');
}

async function loadFollowing(userId, containerId = 'following-list') {
  const sb = getSupabase();
  const { data } = await sb.from('follows')
    .select(`following_id, created_at, profiles!follows_following_id_fkey(username, avatar_url, role)`)
    .eq('follower_id', userId).eq('status', 'accepted');

  const container = document.getElementById(containerId);
  if (!data?.length) {
    container.innerHTML = '<div class="empty-state" style="text-align:center;padding:40px"><p>Kimseyi takip etmiyorsunuz</p></div>';
    return;
  }

  container.innerHTML = data.map(f => {
    const p = f.profiles;
    return `
      <div class="follow-item">
        <img class="follow-avatar" src="${p.avatar_url || ''}" alt="${escapeHtml(p.username)}" onerror="this.src='';this.outerHTML='<div class=\\'follow-avatar\\' style=\\'background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%\\'>${getInitials(p.username)}</div>'">
        <div class="follow-info">
          <div class="follow-name">${escapeHtml(p.username)}${p.role === 'artist' ? ' <span class="role-badge artist">Sanatçı</span>' : ''}</div>
          <div class="follow-meta"><span>${formatDate(f.created_at)}</span></div>
        </div>
        <button class="follow-btn following" data-id="${f.following_id}" onclick="unfollowUser(this.dataset.id)">Takipten Çık</button>
      </div>
    `;
  }).join('');
}

async function loadFriendRequests(userId) {
  const sb = getSupabase();
  const { data } = await sb.from('follows')
    .select(`follower_id, created_at, profiles!follows_follower_id_fkey(username, avatar_url)`)
    .eq('following_id', userId).eq('status', 'pending');

  const container = document.getElementById('friend-requests-list');
  if (!container) return;

  if (!data?.length) {
    container.innerHTML = '<div class="empty-state" style="text-align:center;padding:40px"><p>Bekleyen istek yok</p></div>';
    return;
  }

  container.innerHTML = data.map(f => {
    const p = f.profiles;
    return `
      <div class="follow-item">
        <img class="follow-avatar" src="${p.avatar_url || ''}" alt="${escapeHtml(p.username)}" onerror="this.src='';this.outerHTML='<div class=\\'follow-avatar\\' style=\\'background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%\\'>${getInitials(p.username)}</div>'">
        <div class="follow-info">
          <div class="follow-name">${escapeHtml(p.username)}</div>
          <div class="follow-meta"><span>Arkadaşlık isteği gönderdi</span></div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="follow-btn follow" onclick="acceptFriendRequest('${f.follower_id}')">Kabul Et</button>
          <button class="follow-btn pending" onclick="rejectFriendRequest('${f.follower_id}')">Reddet</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateFollowUI(targetId, status) {
  const btn = document.querySelector(`[data-follow-id="${targetId}"]`) || document.getElementById(`follow-btn-${targetId}`);
  if (!btn) return;

  if (status === true || status === 'accepted') {
    btn.textContent = 'Takipten Çık';
    btn.className = 'follow-btn following';
    btn.onclick = () => unfollowUser(targetId);
  } else if (status === 'pending') {
    btn.textContent = 'İstek Gönderildi';
    btn.className = 'follow-btn pending';
    btn.disabled = true;
  } else {
    btn.textContent = 'Takip Et';
    btn.className = 'follow-btn follow';
    btn.onclick = () => followUser(targetId);
  }
}

function getInitials(name) {
  return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function handleFollowClick(targetId, role, username) {
  try {
    const btn = document.querySelector(`[data-follow-id="${targetId}"]`);
    const isFollowing = btn && btn.classList.contains('following');

    if (isFollowing) {
      const res = await unfollowUser(targetId);
      if (res && !res.error) {
        if (typeof showToast === 'function') showToast(`${username || 'Kullanıcı'} takipten çıkarıldı`, 'info');
        if (btn) {
          btn.classList.remove('following');
          btn.classList.add('follow');
          btn.textContent = 'Takip Et';
        }
      }
    } else {
      const res = await followUser(targetId);
      if (res && !res.error) {
        if (typeof showToast === 'function') showToast(`${username || 'Kullanıcı'} takip ediliyor`, 'success');
        if (btn) {
          btn.classList.add('following');
          btn.classList.remove('follow');
          btn.textContent = 'Takip Ediliyor';
        }
      }
    }
  } catch (err) {
    console.error('handleFollowClick error:', err);
  }
}

// Export to window
window.followUser = followUser;
window.unfollowUser = unfollowUser;
window.loadFollowers = loadFollowers;
window.loadFollowing = loadFollowing;
window.loadFriendRequests = loadFriendRequests;
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;
if (typeof loadPublicProfileActions !== 'undefined') window.loadPublicProfileActions = loadPublicProfileActions;
window.handleFollowClick = handleFollowClick;