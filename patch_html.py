import re

with open('src/pages/app.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Admin replace
admin_target = """                <div class="file-input-group" style="display:flex; gap:10px; align-items:center; margin-bottom:15px; width: 100%;">
                  <button class="btn-secondary" id="btn-admin-select-mp3" type="button" style="flex-shrink:0;">MP3 Seç</button>
                  <input type="text" id="admin-song-url" placeholder="Şarkı dosya URL'si (http/https) *" required style="margin-bottom:0; flex-grow:1;">
                </div>
                <div class="file-input-group" style="display:flex; gap:10px; align-items:center; margin-bottom:15px; width: 100%;">
                  <button class="btn-secondary" id="btn-admin-select-cover" type="button" style="flex-shrink:0;">Kapak Seç</button>
                  <input type="text" id="admin-song-cover" placeholder="Kapak resmi URL'si (http/https)" style="margin-bottom:0; flex-grow:1;">
                </div>"""

admin_replacement = """                <input type="text" id="admin-song-url" placeholder="Şarkı dosya URL'si veya YouTube linki *" required>
                <input type="text" id="admin-song-cover" placeholder="Kapak resmi URL'si (http/https)">"""

# Artist replace
artist_target = """                <div class="file-input-group" style="display:flex; gap:10px; align-items:center; margin-bottom:15px; width: 100%;">
                  <button class="btn-secondary" id="btn-artist-select-mp3" type="button" style="flex-shrink:0;">MP3 Seç</button>
                  <input type="text" id="artist-song-url" placeholder="Şarkı dosya URL'si (http/https) *" style="margin-bottom:0; flex-grow:1;">
                </div>
                <div class="file-input-group" style="display:flex; gap:10px; align-items:center; margin-bottom:15px; width: 100%;">
                  <button class="btn-secondary" id="btn-artist-select-cover" type="button" style="flex-shrink:0;">Kapak Seç</button>
                  <input type="text" id="artist-song-cover" placeholder="Kapak resmi URL'si" style="margin-bottom:0; flex-grow:1;">
                </div>"""

artist_replacement = """                <input type="text" id="artist-song-url" placeholder="Şarkı dosya URL'si veya YouTube linki *">
                <input type="text" id="artist-song-cover" placeholder="Kapak resmi URL'si">"""

if admin_target in content and artist_target in content:
    content = content.replace(admin_target, admin_replacement)
    content = content.replace(artist_target, artist_replacement)
    with open('src/pages/app.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("app.html patched successfully")
else:
    print("app.html targets not found")

# Now patch app.js
with open('src/js/app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

app_js_target_1 = """  // File selection buttons
  document.getElementById('btn-admin-select-mp3').addEventListener('click', async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'aac'] }]
    });
    if (result && !result.canceled && result.filePaths.length > 0) {
      document.getElementById('admin-song-url').value = result.filePaths[0];
    }
  });

  document.getElementById('btn-admin-select-cover').addEventListener('click', async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
    });
    if (result && !result.canceled && result.filePaths.length > 0) {
      document.getElementById('admin-song-cover').value = result.filePaths[0];
    }
  });"""

app_js_target_2 = """  const btnMp3 = document.getElementById('btn-artist-select-mp3');
  if (btnMp3) {
    btnMp3.addEventListener('click', async () => {
      const result = await window.electronAPI.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'aac'] }]
      });
      if (result && !result.canceled && result.filePaths.length > 0) {
        document.getElementById('artist-song-url').value = result.filePaths[0];
      }
    });
  }

  const btnCover = document.getElementById('btn-artist-select-cover');
  if (btnCover) {
    btnCover.addEventListener('click', async () => {
      const result = await window.electronAPI.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
      });
      if (result && !result.canceled && result.filePaths.length > 0) {
        document.getElementById('artist-song-cover').value = result.filePaths[0];
      }
    });
  }"""

if app_js_target_1 in app_js:
    app_js = app_js.replace(app_js_target_1, "")
    print("app.js target 1 patched")
if app_js_target_2 in app_js:
    app_js = app_js.replace(app_js_target_2, "")
    print("app.js target 2 patched")

with open('src/js/app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)
