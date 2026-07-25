// ===== Utils Module - Yardımcı Fonksiyonlar =====

window.escapeHtml = function(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

window.getInitials = function(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

window.getAvatarColor = function(name) {
  const colors = ['#1DB954', '#E91E63', '#9C27B0', '#3F51B5', '#009688', '#FF5722', '#795548', '#607D8B', '#F44336', '#2196F3', '#4CAF50', '#FF9800'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

window.formatDuration = function(seconds) {
  if (!seconds) return '\u2014';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

window.getVerifiedTick = function(artistName, forceOnProfile = false) {
  if (!forceOnProfile) return '';
  return '<span class="verified-tick" title="Onaylı Sanatçı">✓</span>';
};

window.formatArtistLinks = function(artistStr) {
  if (!artistStr) return '';
  const artists = artistStr.split(',').map(a => a.trim()).filter(Boolean);
  return artists.map(artist => {
    return `<span class="artist-link" data-artist-name="${escapeHtml(artist)}">${escapeHtml(artist)}${getVerifiedTick(artist)}</span>`;
  }).join(', ');
};

window.showToast = function(message, type = 'error') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3000);
};

window.showEmptyState = function(containerId, message) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
  }
};

window.setGreeting = function() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 6) greeting = '\u0130yi Geceler';
  else if (hour < 12) greeting = 'G\u00fcnayd\u0131n';
  else if (hour < 18) greeting = '\u0130yi G\u00fcnler';
  else greeting = '\u0130yi Ak\u0151amlar';
  const h1 = document.querySelector('#home-greeting');
  const sub = document.querySelector('#greeting-subtitle');
  if (h1) h1.textContent = greeting;
  if (sub) sub.textContent = 'M\u00fczi\u011fin ritmini hisset';
};

window.getAvatarFrameClass = function(frame) {
  if (!frame || frame === 'none') return '';
  return `avatar-frame avatar-frame-${frame}`;
};

window.hasPremiumAccess = function() {
  return window.currentUserIsPremium || window.currentUserRole === 'admin' || window.currentUserRole === 'yetkili' || window.currentUserRole === 'premium';
};

window.getPremiumBadge = function() {
  if (!window.currentUserIsPremium) return '';
  return '<span class="premium-badge">\uD83D\uDC8E PREMIUM</span>';
};

// Sanatçı username'lerini yükle (verified tick için)
window.loadArtistUsernames = async function() {
  try {
    const { data } = await getArtistProfiles();
    if (data) {
      window.artistUsernames = new Set(data.map(p => (p.name || p.username || '').toLowerCase()));
    }
  } catch (e) {
    Logger.error('Artist profiles load error:', e);
  }
};

// utils.js - Yardımcı fonksiyonlar: HTML escape, baş harfler, renk, süre formatı, doğrulama tikleri, toast, selamlama, premium, avatar çerçeve
