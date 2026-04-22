import os
import re

def patch_app_js(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Step 1: Add State Variables
    if 'let isLyricShareMode = false;' not in content:
        content = content.replace('let lyricsCollapsed = false;', 'let lyricsCollapsed = false;\nlet isLyricShareMode = false;\nlet selectedLyricIndexes = [];')

    # Step 2: Append Share Logic Source Code
    share_logic = '''
// ===== Lyric Sharing =====
function initLyricShare() {
  const btnShare = document.getElementById('btn-share-lyrics');
  const actionBar = document.getElementById('lyrics-share-action-bar');
  const btnCancel = document.getElementById('btn-share-cancel');
  const btnContinue = document.getElementById('btn-share-continue');
  const countSpan = document.getElementById('lyrics-share-count');
  
  if (!btnShare || !actionBar) return;

  function resetShareMode() {
    isLyricShareMode = false;
    selectedLyricIndexes = [];
    actionBar.style.display = 'none';
    document.querySelectorAll('.np-lyric-line.selected-for-share').forEach(el => el.classList.remove('selected-for-share'));
    btnContinue.disabled = true;
    countSpan.textContent = '0/2 Seçildi';
  }

  btnShare.addEventListener('click', () => {
    if(!parsedSyncedLyrics || parsedSyncedLyrics.length === 0) return;
    if(isLyricShareMode) resetShareMode();
    else {
      isLyricShareMode = true;
      selectedLyricIndexes = [];
      actionBar.style.display = 'flex';
      btnContinue.disabled = true;
      countSpan.textContent = '0/2 Seçildi';
    }
  });

  btnCancel.addEventListener('click', resetShareMode);

  // Line selection logic is handled in the lyrical click listener below.
  // Generate Card Button
  btnContinue.addEventListener('click', () => {
    if (selectedLyricIndexes.length === 0) return;
    const song = player.currentSong;
    if (!song) return;

    // Collect texts
    selectedLyricIndexes.sort((a,b) => a - b);
    const texts = selectedLyricIndexes.map(idx => parsedSyncedLyrics[idx].text);
    
    // Populate card
    document.getElementById('card-lyrics-text').innerHTML = '"' + texts.map(escapeHtml).join('<br>') + '"';
    document.getElementById('card-song-title').textContent = escapeHtml(song.title || 'Bilinmiyor');
    document.getElementById('card-song-artist').textContent = escapeHtml(song.artist || 'Sanatçı');
    
    const coverUrl = song.cover_url || '';
    document.getElementById('card-cover-img').src = coverUrl;

    const modal = document.getElementById('modal-share-lyrics');
    const preview = document.getElementById('share-lyrics-preview-container');
    const downloadBtn = document.getElementById('btn-download-lyric-card');
    
    preview.innerHTML = '<div class="spinner"></div>';
    modal.classList.remove('modal-hidden');

    setTimeout(() => {
      if(typeof html2canvas === 'undefined') {
        preview.innerHTML = '<p style="color:white;padding:20px">html2canvas yüklenemedi.</p>';
        return;
      }
      const template = document.getElementById('lyric-card-template');
      html2canvas(template, { scale: 1, useCORS: true, backgroundColor: null }).then(canvas => {
        const dataUrl = canvas.toDataURL('image/png');
        preview.innerHTML = `<img src="${dataUrl}" style="width:100%; height:auto; display:block">`;
        
        downloadBtn.onclick = () => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `bekofy-sozler-${song.title}.png`;
          a.click();
        };
      }).catch(err => {
        preview.innerHTML = '<p style="color:white;padding:20px">Resim oluşturulamadı.</p>';
      });
    }, 100);

    resetShareMode();
  });

  // Modal close
  document.getElementById('btn-close-share-lyrics')?.addEventListener('click', () => {
    document.getElementById('modal-share-lyrics').classList.add('modal-hidden');
  });
}
'''
    if 'function initLyricShare' not in content:
        content += '\n' + share_logic

    # Step 3: Modify line clicking behavior
    click_injection = '''
      // SHARE MODE LOGIC
      if (isLyricShareMode) {
        const idx = parseInt(el.dataset.lyricIndex);
        if (selectedLyricIndexes.includes(idx)) {
          selectedLyricIndexes = selectedLyricIndexes.filter(i => i !== idx);
          el.classList.remove('selected-for-share');
        } else {
          if (selectedLyricIndexes.length < 2) {
            selectedLyricIndexes.push(idx);
            el.classList.add('selected-for-share');
          }
        }
        document.getElementById('lyrics-share-count').textContent = `${selectedLyricIndexes.length}/2 Seçildi`;
        document.getElementById('btn-share-continue').disabled = selectedLyricIndexes.length === 0;
        return;
      }
'''
    
    old_click = 'el.addEventListener(\'click\', () => {\n      const time = parseFloat(el.dataset.lyricTime);'
    new_click = 'el.addEventListener(\'click\', () => {\n' + click_injection + '      const time = parseFloat(el.dataset.lyricTime);'
    
    if click_injection not in content:
        content = content.replace(old_click, new_click)

    # Add init calls
    if 'initLyricShare();' not in content:
        content = content.replace('initLyricsToggle();', 'initLyricsToggle();\n    initLyricShare();')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    patch_app_js(r'c:\Users\dedyu\Desktop\bekir\src\js\app.js')
    patch_app_js(r'c:\Users\dedyu\Desktop\bekir\website\js\app.js')
