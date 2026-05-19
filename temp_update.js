const fs = require('fs');
const path = 'c:/Users/dedyu/Desktop/bekir/src/js/app.js';
const content = fs.readFileSync(path, 'utf8');

const replacement = `  const h1 = document.querySelector('#home-greeting');
  const sub = document.querySelector('#greeting-subtitle');
  if (h1) h1.textContent = greeting;
  if (sub) sub.textContent = 'Müziğin ritmini hisset';
}

async function renderHeroBanner() {
  const heroSection = document.getElementById('hero-banner-section');
  const heroTitle = document.getElementById('hero-banner-title');
  const heroArtist = document.getElementById('hero-banner-artist');
  const heroBg = document.getElementById('hero-banner-bg');
  const playBtn = document.getElementById('hero-banner-play');

  if (!heroSection || !allSongs.length) return;

  const heroSong = allSongs[Math.floor(Math.random() * allSongs.length)];
  
  heroTitle.textContent = heroSong.title;
  heroArtist.textContent = heroSong.artist;
  if (heroSong.cover_url) {
    heroBg.style.backgroundImage = \`url('\${heroSong.cover_url}')\`;
  }
  
  playBtn.onclick = () => {
    player.playSong(heroSong, allSongs);
  };
  
  heroSection.style.display = 'block';
}

async function renderDailyMixes() {
  const section = document.getElementById('daily-mix-section');
  const grid = document.getElementById('daily-mix-grid');
  if (!section || !grid || !allSongs.length) return;

  let mixes = JSON.parse(localStorage.getItem('bekofy_daily_mixes') || 'null');
  const today = new Date().toDateString();

  if (!mixes || mixes.date !== today) {
    mixes = { date: today, data: [] };
    const artists = [...new Set(allSongs.map(s => s.artist))].sort(() => 0.5 - Math.random());
    for(let i=0; i<4 && i<artists.length; i++) {
      const artistSongs = allSongs.filter(s => s.artist === artists[i]);
      if(artistSongs.length > 0) {
        mixes.data.push({
          title: \`\${artists[i]} Mix\`,
          desc: \`\${artists[i]} ve benzerleri\`,
          songs: artistSongs,
          cover: artistSongs[0].cover_url
        });
      }
    }
    localStorage.setItem('bekofy_daily_mixes', JSON.stringify(mixes));
  }

  if (mixes.data.length > 0) {
    grid.innerHTML = mixes.data.map((mix, idx) => \`
      <div class="daily-mix-card" onclick="playDailyMix(\${idx})">
        <img src="\${mix.cover || ''}" class="daily-mix-cover">
        <div class="daily-mix-info">
          <h4>\${mix.title}</h4>
          <p>\${mix.desc}</p>
        </div>
        <button class="daily-mix-play">
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
    \`).join('');
    section.style.display = 'block';

    window.playDailyMix = (idx) => {
      const mix = mixes.data[idx];
      if (mix && mix.songs.length) {
        player.playSong(mix.songs[0], mix.songs);
      }
    };
  }
}

// ===== Load User Info & Ensure Profile =====`;

const regex = /const h1 = document\.querySelector\('#page-home \.page-header h1'\);\s*if \(h1\) h1\.textContent = greeting;\s*}\s*\/\/\s*=====\s*Load User Info & Ensure Profile\s*=====/;
if (regex.test(content)) {
  const newContent = content.replace(regex, replacement);
  fs.writeFileSync(path, newContent, 'utf8');
  console.log('Successfully updated rendering logic');
} else {
  console.log('Failed to match regex');
}
