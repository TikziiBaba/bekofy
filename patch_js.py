import re

with open('src/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = """  if (!title || !file_path) {
  btn.disabled = true;
  btn.textContent = 'Gönderiliyor...';
  
  try {
    const { data: profile } = await fetchProfile(currentUserId);
    const artistName = profile.username || 'Bilinmeyen Sanatçı';"""

replacement = """  if (!title || !file_path) {
    showToast('Şarkı adı ve dosya gerekli', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-artist-submit-song');
  btn.disabled = true;
  btn.textContent = 'Yükleniyor... (Bu işlem biraz sürebilir)';
  
  try {
    // R2 Upload for MP3
    if (file_path && !file_path.startsWith('http')) {
      const ext = file_path.split('.').pop();
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const r2FileName = `songs/artist-${Date.now()}-${safeTitle}.${ext}`;
      const uploadRes = await window.electronAPI.uploadToR2(file_path, r2FileName);
      if (!uploadRes.success) throw new Error(uploadRes.error);
      file_path = uploadRes.url;
    }

    // R2 Upload for Cover
    if (cover_url && !cover_url.startsWith('http')) {
      const ext = cover_url.split('.').pop();
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const r2FileName = `covers/artist-${Date.now()}-${safeTitle}.${ext}`;
      const uploadRes = await window.electronAPI.uploadToR2(cover_url, r2FileName);
      if (!uploadRes.success) throw new Error(uploadRes.error);
      cover_url = uploadRes.url;
    }

    const { data: profile } = await fetchProfile(currentUserId);
    const artistName = profile.username || 'Bilinmeyen Sanatçı';"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/js/app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Target not found")
