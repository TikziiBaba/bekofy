// Supabase Client Initialization
// NOTE: In Electron, we load the Supabase JS from a CDN in HTML,
// or we can bundle it. For simplicity, we'll use the global supabase from CDN.

const SUPABASE_URL = 'https://dtdsawyynetqlbosrvqo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHNhd3l5bmV0cWxib3NydnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDU0MDUsImV4cCI6MjA5MDEyMTQwNX0.6rKxp51OOj_b1iKtz_21ZkHcvbThNF4w5sPdP7RAua4';

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient) {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.error('Supabase JS library not loaded!');
    }
  }
  return supabaseClient;
}

// ===== Auth Functions =====

async function signUpWithEmail(email, password, username) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });
  return { data, error };
}

async function signInWithEmail(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

async function signInWithGoogle() {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'http://localhost'
    }
  });
  return { data, error };
}

async function signInWithApple() {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: 'http://localhost'
    }
  });
  return { data, error };
}

async function signOut() {
  const sb = getSupabase();
  const { error } = await sb.auth.signOut();
  return { error };
}

async function getCurrentUser() {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function getSession() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

// ===== Songs Functions =====

async function fetchAllSongs() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

async function searchSongs(query) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .select('*')
    .or(`title.ilike.%${query}%,artist.ilike.%${query}%,album.ilike.%${query}%`)
    .order('title');
  return { data, error };
}

async function getSongUrl(filePath) {
  // Eğer direkt URL ise (http/https), olduğu gibi kullan
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  // Değilse Supabase Storage'dan al
  const sb = getSupabase();
  const { data } = sb.storage
    .from('songs')
    .getPublicUrl(filePath);
  return data.publicUrl;
}

// ===== Playlist Functions =====

async function fetchUserPlaylists(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
}

async function createPlaylist(name, userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .insert({ name, user_id: userId })
    .select()
    .single();
  return { data, error };
}

async function getPlaylistSongs(playlistId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlist_songs')
    .select(`
      position,
      songs (*)
    `)
    .eq('playlist_id', playlistId)
    .order('position');
  return { data, error };
}

async function addSongToPlaylist(playlistId, songId, position) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlist_songs')
    .insert({ playlist_id: playlistId, song_id: songId, position });
  return { data, error };
}

async function removeSongFromPlaylist(playlistId, songId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('playlist_songs')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('song_id', songId);
  return { error };
}

async function deletePlaylist(playlistId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('playlists')
    .delete()
    .eq('id', playlistId);
  return { error };
}

// ===== Liked Songs =====

async function likeSong(userId, songId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('liked_songs')
    .insert({ user_id: userId, song_id: songId });
  return { data, error };
}

async function unlikeSong(userId, songId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('liked_songs')
    .delete()
    .eq('user_id', userId)
    .eq('song_id', songId);
  return { error };
}

async function isLiked(userId, songId) {
  const sb = getSupabase();
  const { data } = await sb
    .from('liked_songs')
    .select('song_id')
    .eq('user_id', userId)
    .eq('song_id', songId)
    .single();
  return !!data;
}

async function fetchLikedSongs(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('liked_songs')
    .select(`
      song_id,
      songs (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
}

// ===== Realtime =====

function subscribeToSongs(callback) {
  const sb = getSupabase();
  return sb
    .channel('songs-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, callback)
    .subscribe();
}

// ===== Role & Admin Functions =====

async function fetchUserRole(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error || !data) return 'user';
  return data.role || 'user';
}

async function updateUserRole(userId, newRole) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}

async function fetchAllProfiles() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

async function getDashboardStats() {
  const sb = getSupabase();
  
  const [profilesRes, songsRes, playlistsRes] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('songs').select('id', { count: 'exact', head: true }),
    sb.from('playlists').select('id', { count: 'exact', head: true }),
  ]);
  
  return {
    users: profilesRes.count || 0,
    songs: songsRes.count || 0,
    playlists: playlistsRes.count || 0,
  };
}

async function addSong(songData) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .insert(songData)
    .select()
    .single();
  return { data, error };
}

async function deleteSong(songId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('songs')
    .delete()
    .eq('id', songId);
  return { error };
}

// ===== Profile Functions =====

async function fetchProfile(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
}

async function updateProfile(userId, updates) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}

// ===== Song Approval System =====

async function submitSongForApproval(songData) {
  const sb = getSupabase();
  songData.status = 'pending';
  const { data, error } = await sb
    .from('songs')
    .insert(songData)
    .select()
    .single();
  return { data, error };
}

async function fetchPendingSongs() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return { data, error };
}

async function approveSong(songId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .update({ status: 'approved' })
    .eq('id', songId)
    .select()
    .single();
  return { data, error };
}

async function rejectSong(songId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('songs')
    .delete()
    .eq('id', songId);
  return { error };
}

async function fetchApprovedSongs() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .select('*')
    .or('status.eq.approved,status.is.null')
    .order('created_at', { ascending: false });
  return { data, error };
}

// ===== Playlist Enhanced Functions =====

async function updatePlaylist(playlistId, updates) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .update(updates)
    .eq('id', playlistId)
    .select()
    .single();
  return { data, error };
}

async function fetchPlaylistById(playlistId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .select('*')
    .eq('id', playlistId)
    .single();
  return { data, error };
}

async function searchPublicPlaylists(query) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .select('*, profiles(username, avatar_url)')
    .eq('is_public', true)
    .ilike('name', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);
  return { data, error };
}

// ===== Friend System =====

async function searchUsers(query) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: [], error: null };

  const { data, error } = await sb
    .from('profiles')
    .select('id, username, avatar_url, role')
    .neq('id', user.id) // Don't search self
    .ilike('username', `%${query}%`)
    .limit(10);
    
  return { data, error };
}

async function addFriend(friendId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: null, error: { message: 'Giriş yapılmalı' } };

  const { data, error } = await sb
    .from('friendships')
    .insert([{ user_id: user.id, friend_id: friendId, status: 'accepted' }]);
    
  return { data, error };
}

async function removeFriend(friendId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: null, error: { message: 'Giriş yapılmalı' } };

  const { data, error } = await sb
    .from('friendships')
    .delete()
    .eq('user_id', user.id)
    .eq('friend_id', friendId);
    
  return { data, error };
}

// ===== Block & Public User System =====

async function fetchUserPublicProfile(userId) {
  const sb = getSupabase();
  
  // Check if blocked first
  const isBlocked = await checkIfBlockedInternal(userId);
  if (isBlocked) return { data: null, error: { message: 'Bu profil bulunamadı veya gizli.' } };
  
  // Fetch profile
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('id, username, avatar_url, role')
    .eq('id', userId)
    .single();
    
  if (profileError) return { data: null, error: profileError };
  
  // Fetch followers count
  const { count: followersCount } = await sb
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('friend_id', userId)
    .eq('status', 'accepted');
    
  // Fetch public playlists count
  const { count: playlistsCount } = await sb
    .from('playlists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_public', true);
    
  // Check friendship status
  const isFriend = await checkFriendshipInternal(userId);
    
  return { 
    data: { 
      ...profile, 
      followers_count: followersCount || 0,
      playlists_count: playlistsCount || 0,
      is_following: isFriend
    }, 
    error: null 
  };
}

async function blockUser(blockedId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: null, error: { message: 'Geçersiz oturum' } };

  // Remove friendship if exists (both ways)
  await sb.from('friendships').delete().or(`and(user_id.eq.${user.id},friend_id.eq.${blockedId}),and(user_id.eq.${blockedId},friend_id.eq.${user.id})`);

  // Insert block
  const { data, error } = await sb
    .from('blocked_users')
    .insert([{ user_id: user.id, blocked_id: blockedId }]);
    
  return { data, error };
}

async function unblockUser(blockedId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: null, error: { message: 'Geçersiz oturum' } };

  const { data, error } = await sb
    .from('blocked_users')
    .delete()
    .eq('user_id', user.id)
    .eq('blocked_id', blockedId);
    
  return { data, error };
}

async function checkIfBlockedInternal(targetUserId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;

  // Check if I blocked them OR they blocked me
  const { data, error } = await sb
    .from('blocked_users')
    .select('id')
    .or(`and(user_id.eq.${user.id},blocked_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},blocked_id.eq.${user.id})`)
    .limit(1);

  if (error || !data || data.length === 0) return false;
  return true;
}

async function checkFriendshipInternal(targetUserId) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;

  const { data, error } = await sb
    .from('friendships')
    .select('id')
    .eq('user_id', user.id)
    .eq('friend_id', targetUserId)
    .limit(1);

  if (error || !data || data.length === 0) return false;
  return true;
}


async function uploadPlaylistCover(playlistId, file) {
  const sb = getSupabase();
  const ext = file.name.split('.').pop();
  
  // Get current user's ID for storage policy compatibility
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: null, error: { message: 'Oturum bulunamadı' } };
  
  // FLAT FILE PATH! No slashes. Exactly like profile photo: userId-playlistId-time.jpg
  const fileName = `${user.id}-playlist-${playlistId}-${Date.now()}.${ext}`;
  
  try {
    const { error: uploadError } = await sb.storage
      .from('avatars')
      .upload(fileName, file, { 
        upsert: true,
        contentType: file.type
      });
      
    if (uploadError) {
      console.error('Cover upload error:', JSON.stringify(uploadError));
      return { data: null, error: uploadError };
    }
    
    const { data: urlData } = sb.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    // Update the playlist row in the database since the user might complain it doesn't persist
    const coverUrl = urlData.publicUrl + '?t=' + Date.now();
    await sb.from('playlists').update({ cover_url: coverUrl }).eq('id', playlistId);
    
    return { data: coverUrl, error: null };
  } catch (err) {
    console.error('Cover upload exception:', err);
    return { data: null, error: err };
  }
}

// ===== Play History (for recommendations) =====

async function recordPlay(userId, songId) {
  const sb = getSupabase();
  // Upsert to play_history or simply track in liked_songs context
  // For now, we'll use liked_songs + artist matching for recommendations
  return;
}

async function getRecommendedSongs(userId, allSongs, likedSongIds) {
  // Algoritma:
  // 1. Beğenilen şarkıların sanatçılarını bul
  // 2. Bu sanatçıların beğenilmemiş şarkılarını öner
  // 3. Yeterli değilse rastgele şarkılar ekle
  
  const likedSongs = allSongs.filter(s => likedSongIds.has(s.id));
  const likedArtists = new Set(likedSongs.map(s => s.artist?.toLowerCase()));
  const likedAlbums = new Set(likedSongs.filter(s => s.album).map(s => s.album?.toLowerCase()));
  
  let recommended = [];
  
  // Beğenilen sanatçıların diğer şarkıları
  if (likedArtists.size > 0) {
    const artistMatches = allSongs.filter(s => 
      !likedSongIds.has(s.id) && 
      likedArtists.has(s.artist?.toLowerCase())
    );
    recommended.push(...artistMatches);
  }
  
  // Beğenilen albümlerin diğer şarkıları
  if (likedAlbums.size > 0) {
    const albumMatches = allSongs.filter(s => 
      !likedSongIds.has(s.id) && 
      !recommended.find(r => r.id === s.id) &&
      s.album && likedAlbums.has(s.album.toLowerCase())
    );
    recommended.push(...albumMatches);
  }
  
  // Karıştır
  recommended = recommended.sort(() => Math.random() - 0.5);
  
  // Yeterli değilse, hiç beğenilmemiş rastgele şarkılar ekle
  if (recommended.length < 8) {
    const remaining = allSongs.filter(s => 
      !likedSongIds.has(s.id) && 
      !recommended.find(r => r.id === s.id)
    ).sort(() => Math.random() - 0.5);
    recommended.push(...remaining.slice(0, 8 - recommended.length));
  }
  
  return recommended.slice(0, 8);
}

// ===== Reserved Usernames (Admin) =====

async function fetchReservedUsernames() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('reserved_usernames')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

async function addReservedUsername(username, addedBy) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('reserved_usernames')
    .insert({ username: username.toLowerCase().trim(), added_by: addedBy })
    .select()
    .single();
  return { data, error };
}

async function removeReservedUsername(id) {
  const sb = getSupabase();
  const { error } = await sb
    .from('reserved_usernames')
    .delete()
    .eq('id', id);
  return { error };
}

async function isUsernameReserved(username) {
  const sb = getSupabase();
  const { data } = await sb
    .from('reserved_usernames')
    .select('id')
    .eq('username', username.toLowerCase().trim())
    .maybeSingle();
  return !!data;
}

// ===== Admin: Ban/Delete Users =====

async function adminBanUser(userId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('profiles')
    .update({ is_banned: true })
    .eq('id', userId);
  return { error };
}

async function adminUnbanUser(userId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('profiles')
    .update({ is_banned: false })
    .eq('id', userId);
  return { error };
}

async function adminDeleteUser(userId) {
  const sb = getSupabase();
  // Delete profile (cascade will handle related data)
  const { error: profileError } = await sb
    .from('profiles')
    .delete()
    .eq('id', userId);
  return { error: profileError };
}

// ===== Friend System =====

async function sendFriendRequest(userId, friendId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('friendships')
    .insert({ user_id: userId, friend_id: friendId, status: 'pending' })
    .select()
    .single();
  return { data, error };
}

async function acceptFriendRequest(friendshipId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  return { error };
}

async function rejectFriendRequest(friendshipId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('friendships')
    .delete()
    .eq('id', friendshipId);
  return { error };
}

async function removeFriend(friendshipId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('friendships')
    .delete()
    .eq('id', friendshipId);
  return { error };
}

async function fetchFriends(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('friendships')
    .select('*, profiles!friendships_friend_id_fkey(id, username, avatar_url, role)')
    .eq('user_id', userId)
    .eq('status', 'accepted');
  
  // Also fetch where user is friend_id
  const { data: data2 } = await sb
    .from('friendships')
    .select('*, profiles!friendships_user_id_fkey(id, username, avatar_url, role)')
    .eq('friend_id', userId)
    .eq('status', 'accepted');
  
  return { data: [...(data || []), ...(data2 || [])], error };
}

async function fetchPendingFriendRequests(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('friendships')
    .select('*, profiles!friendships_user_id_fkey(id, username, avatar_url, role)')
    .eq('friend_id', userId)
    .eq('status', 'pending');
  return { data, error };
}

async function searchUsers(query) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('id, username, avatar_url, role, is_banned')
    .ilike('username', `%${query}%`)
    .limit(20);
  return { data, error };
}

// ===== Block System =====

async function blockUser(userId, blockedId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('blocked_users')
    .insert({ user_id: userId, blocked_id: blockedId })
    .select()
    .single();
  return { data, error };
}

async function unblockUser(userId, blockedId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('blocked_users')
    .delete()
    .eq('user_id', userId)
    .eq('blocked_id', blockedId);
  return { error };
}

async function fetchBlockedUsers(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('blocked_users')
    .select('*, profiles!blocked_users_blocked_id_fkey(id, username, avatar_url)')
    .eq('user_id', userId);
  return { data, error };
}

// ===== Artist Lookup =====

async function getArtistProfiles() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('id, username, role')
    .eq('role', 'artist');
  return { data, error };
}
