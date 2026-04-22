import os
import re

def insert_before(content, pattern, injection):
    idx = content.find(pattern)
    if idx == -1: return content
    return content[:idx] + injection + '\n' + content[idx:]

def insert_after(content, pattern, injection):
    idx = content.find(pattern)
    if idx == -1: return content
    idx += len(pattern)
    return content[:idx] + '\n' + injection + '\n' + content[idx:]

def patch_html(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Share Button injection
    share_btn = '''
            <button class="np-lyrics-toggle" id="btn-share-lyrics" title="Sözleri Paylaş">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
            </button>'''
    if 'id="btn-share-lyrics"' not in content:
        content = insert_before(content, '<button class="np-lyrics-toggle" id="np-lyrics-toggle"', share_btn)

    # Action Bar injection
    action_bar = '''
          <div class="lyrics-share-action-bar" id="lyrics-share-action-bar" style="display:none; position:absolute; bottom:0; left:0; right:0; background:var(--bg-elevated); padding:16px; align-items:center; justify-content:space-between; border-top:1px solid var(--border); border-bottom-left-radius:8px; border-bottom-right-radius:8px; z-index:100; box-shadow:0 -4px 12px rgba(0,0,0,0.3)">
            <span id="lyrics-share-count" style="font-size:14px; color:var(--tp); font-weight:500;">0/2 Seçildi</span>
            <div style="display:flex;gap:8px">
              <button class="btn-cancel" id="btn-share-cancel" style="padding:6px 14px;font-size:13px">İptal</button>
              <button class="btn-primary-small" id="btn-share-continue" style="padding:6px 14px;font-size:13px" disabled>Oluştur</button>
            </div>
          </div>'''
    if 'id="lyrics-share-action-bar"' not in content:
        content = insert_before(content, '<div class="np-lyrics-not-found" id="np-lyrics-not-found"', action_bar)

    # Modals injection
    modal_html = '''
    <!-- Share Lyrics Modal -->
    <div class="modal modal-hidden" id="modal-share-lyrics">
      <div class="modal-content" style="max-width:400px; padding:24px;">
        <div class="modal-header" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
          <h2 style="font-size:20px; font-weight:700">Sözleri Paylaş</h2>
          <button class="modal-close" id="btn-close-share-lyrics" style="background:none; border:none; color:var(--ts); cursor:pointer;">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; align-items:center; gap:24px">
          <div id="share-lyrics-preview-container" style="width:100%; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.5); display:flex; justify-content:center; background:#000;">
          </div>
          <button class="btn-primary" id="btn-download-lyric-card" style="width:100%; padding:14px; font-size:16px;">
            <span>Kartı İndir</span>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Hidden Lyric Card Render Template -->
    <div style="position:absolute; left:-9999px; top:-9999px">
      <div id="lyric-card-template" style="width: 1080px; height: 1920px; background: linear-gradient(135deg, #1DB954, #450af5); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 120px; box-sizing: border-box; font-family: 'Inter', sans-serif;">
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; width:100%">
          <div id="card-lyrics-text" style="font-size:75px; font-weight:800; color:#fff; line-height:1.4; text-align:left; text-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            "Şarkı sözü buraya gelecek"
          </div>
        </div>
        
        <div style="display:flex; align-items:center; width:100%; margin-top:80px; gap:40px">
          <img id="card-cover-img" src="" style="width:220px; height:220px; border-radius:24px; box-shadow:0 10px 40px rgba(0,0,0,0.4); object-fit:cover">
          <div style="display:flex; flex-direction:column; gap:16px">
            <span id="card-song-title" style="font-size:65px; font-weight:800; color:#fff; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">Şarkı Adı</span>
            <span id="card-song-artist" style="font-size:45px; font-weight:500; color:rgba(255,255,255,0.8);">Sanatçı Adı</span>
          </div>
          <div style="margin-left:auto; display:flex; align-items:center; gap:20px; opacity:0.8">
             <svg viewBox="0 0 48 48" fill="none" width="80" height="80">
              <circle cx="24" cy="24" r="22" fill="#1DB954"/>
              <path d="M16 14C16 14 32 18 32 24C32 30 16 34 16 34" stroke="white" stroke-width="3" stroke-linecap="round" fill="none"/>
              <path d="M16 20C16 20 28 22 28 24C28 26 16 28 16 28" stroke="white" stroke-width="3" stroke-linecap="round" fill="none"/>
            </svg>
            <span style="font-size:48px; font-weight:800; color:#fff; letter-spacing:-1px">Bekofy</span>
          </div>
        </div>
      </div>
    </div>
'''
    if 'id="modal-share-lyrics"' not in content:
        content = insert_before(content, '<script src="../js/supabase.js"></script>', modal_html) # app.html
        if 'id="modal-share-lyrics"' not in content:
            content = insert_before(content, '<script src="js/supabase.js"></script>', modal_html) # player.html

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    patch_html(r'c:\Users\dedyu\Desktop\bekir\src\pages\app.html')
    patch_html(r'c:\Users\dedyu\Desktop\bekir\website\player.html')
