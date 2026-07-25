// ===== User Info Module =====

window.initUserInfo = function() {
  loadUserInfo();
  setInterval(loadUserInfo, 30000);
};

async function loadUserInfo() {
  try {
    const sb = getSupabase();
    const { data: profile, error } = await sb.from('profiles').select('*').eq('id', window.currentUserId).single();
    if (error || !profile) return;
    window.currentUserProfile = profile;
    window.currentUserRole = profile.role;

    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    const avatarPlaceholder = document.getElementById('user-avatar-placeholder');
    if (nameEl) nameEl.textContent = profile.username || 'Kullanıcı';
    if (profile.avatar_url) {
      if (avatarEl) { avatarEl.src = profile.avatar_url; avatarEl.style.display = 'block'; }
      if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
    } else {
      if (avatarEl) avatarEl.style.display = 'none';
      if (avatarPlaceholder) {
        avatarPlaceholder.style.display = 'flex';
        avatarPlaceholder.textContent = getInitials(profile.username);
      }
    }

    const { count: listenerCount } = await sb.from('listening_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('artist_name', profile.username)
      .eq('is_active', true);
    const listenerEl = document.getElementById('active-listeners');
    if (listenerEl) listenerEl.textContent = listenerCount || 0;
  } catch (err) {
    Logger.error('loadUserInfo:', err);
  }
}

window.loadUserInfo = loadUserInfo;

async function getArtistListenerCount(artistName) {
  try {
    const sb = getSupabase();
    const { count, error } = await sb.from('listening_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('artist_name', artistName)
      .eq('is_active', true);
    if (error) throw error;
    return { count: count || 0 };
  } catch (err) {
    console.error('getArtistListenerCount error:', err);
    return { count: 0 };
  }
}

window.getArtistListenerCount = getArtistListenerCount;

// user-info.js - Kullanıcı bilgileri: yükleme, avatar güncelleme, dinleyici sayısı
