// ===== Badge System Module =====

var BADGE_CATEGORIES = ['special', 'listening', 'artist', 'premium', 'social'];
var badgeDefinitionsCache = null;

var DEFAULT_BADGE_DEFINITIONS = [
  { id: 'b_admin', name: 'Yönetici', description: 'Bekofy Platform Yöneticisi', category: 'special', icon: '👑', rarity: 'legendary', requirement: { metric: 'role_admin', threshold: 1 } },
  { id: 'b_yetkili', name: 'Yetkili', description: 'Bekofy Yetkili Ekip Üyesi', category: 'special', icon: '🛡️', rarity: 'epic', requirement: { metric: 'role_yetkili', threshold: 1 } },
  { id: 'b_artist', name: 'Sanatçı', description: 'Onaylı Bekofy Sanatçısı', category: 'artist', icon: '🎤', rarity: 'epic', requirement: { metric: 'role_artist', threshold: 1 } },
  { id: 'b_premium', name: 'Premium Üye', description: 'Kesintisiz HiFi Müzik Aboneliği', category: 'premium', icon: '⭐', rarity: 'rare', requirement: { metric: 'subscription', threshold: 1 } },
  { id: 'b_early', name: 'Erken Erişim', description: '2026 Bekofy Kurucu Üyesi', category: 'special', icon: '🚀', rarity: 'rare', requirement: { metric: 'account_age', threshold: 0 } },
  { id: 'b_music_lover', name: 'Müzik Sever', description: 'İlk şarkını beğendin veya çalma listesi oluşturdun', category: 'listening', icon: '🎵', rarity: 'common', requirement: { metric: 'liked_songs', threshold: 1 } },
  { id: 'b_playlist_master', name: 'Müzik Mimarı', description: '3 veya daha fazla çalma listesi oluşturdun', category: 'listening', icon: '💿', rarity: 'rare', requirement: { metric: 'playlists_created', threshold: 3 } },
  { id: 'b_social', name: 'Topluluk Üyesi', description: 'Profilini özelleştirdin ve aktif kullanıcısın', category: 'social', icon: '🔥', rarity: 'common', requirement: { metric: 'account_age', threshold: 0 } }
];

async function loadBadgeDefinitions() {
  if (badgeDefinitionsCache) return badgeDefinitionsCache;

  try {
    const sb = getSupabase();
    const { data } = await sb.from('badge_definitions').select('*').order('category').order('rarity');
    if (data && data.length > 0) {
      badgeDefinitionsCache = data;
      return data;
    }
  } catch (err) {
    console.warn('Supabase badge_definitions unavailable, using fallback definitions');
  }

  badgeDefinitionsCache = DEFAULT_BADGE_DEFINITIONS;
  return DEFAULT_BADGE_DEFINITIONS;
}

async function loadUserBadges(userId) {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_badges')
      .select('badge_id, earned_at, progress')
      .eq('user_id', userId);
    if (!error && data) return data;
  } catch (err) {}
  return [];
}

async function getUserMetrics(userId) {
  try {
    const sb = getSupabase();
    const profile = window.currentUserProfile || (await sb.from('profiles').select('*').eq('id', userId).single()).data || {};
    const [playlistsRes, likedRes] = await Promise.all([
      sb.from('playlists').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      sb.from('liked_songs').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    ]);

    return {
      role: profile.role || 'user',
      total_plays: profile.total_plays || 5,
      playlists_created: playlistsRes.count || 0,
      liked_songs: likedRes.count || 0,
      followers: 0,
      approved_songs: 0,
      account_age_days: 1,
      is_premium: profile.role === 'premium' || profile.role === 'admin' || profile.role === 'yetkili'
    };
  } catch (err) {
    console.error('getUserMetrics error:', err);
    return {
      role: window.currentUserProfile?.role || 'user',
      total_plays: 0,
      playlists_created: 0,
      liked_songs: 0,
      followers: 0,
      approved_songs: 0,
      account_age_days: 1,
      is_premium: false
    };
  }
}

function calculateProgress(badgeDef, metrics) {
  const threshold = badgeDef.requirement?.threshold || 0;
  let current = 0;

  switch (badgeDef.requirement?.metric) {
    case 'total_plays': current = metrics.total_plays; break;
    case 'playlists_created': current = metrics.playlists_created; break;
    case 'liked_songs': current = metrics.liked_songs; break;
    case 'followers': current = metrics.followers; break;
    case 'approved_songs': current = metrics.approved_songs; break;
    case 'account_age': current = metrics.account_age_days; break;
    case 'subscription': current = metrics.is_premium ? 1 : 0; break;
    case 'role_admin': current = metrics.role === 'admin' ? 1 : 0; break;
    case 'role_yetkili': current = metrics.role === 'yetkili' || metrics.role === 'admin' ? 1 : 0; break;
    case 'role_artist': current = metrics.role === 'artist' || metrics.role === 'admin' ? 1 : 0; break;
  }

  const earned = threshold > 0 ? current >= threshold : current >= 0 || badgeDef.id === 'b_early';
  const progress = earned ? 100 : (threshold > 0 ? Math.min(100, Math.round((current / threshold) * 100)) : 0);

  return { current, threshold, progress, earned };
}