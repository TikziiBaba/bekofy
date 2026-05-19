const fs = require('fs');
const path = 'c:/Users/dedyu/Desktop/bekir/src/js/app.js';
let content = fs.readFileSync(path, 'utf8');

const profileLogic = `

// ===== Enhanced Profile Stats & Badges =====
async function renderProfileEnhancedStats(userId) {
  if (!userId) return;
  const stats = await fetchUserStats(userId);
  const profile = await fetchProfile(userId);
  
  const elPlaylists = document.getElementById('profile-stat-playlists');
  const elLiked = document.getElementById('profile-stat-liked');
  const elFollowers = document.getElementById('profile-stat-followers');
  const elFollowing = document.getElementById('profile-stat-following');
  
  if (elPlaylists) elPlaylists.textContent = stats.playlists;
  if (elLiked) elLiked.textContent = stats.liked;
  if (elFollowers) elFollowers.textContent = stats.followers;
  if (elFollowing) elFollowing.textContent = stats.following;

  const badgesSection = document.getElementById('profile-badges-section');
  const badgesGrid = document.getElementById('profile-badges-grid');
  
  if (badgesSection && badgesGrid) {
    const badges = getUserBadges(stats, profile.data);
    if (badges.length > 0) {
      badgesGrid.innerHTML = badges.map(b => \`
        <div class="profile-badge">
          <span class="badge-icon">\${b.icon}</span>
          <div class="badge-info">
            <span class="badge-name">\${b.name}</span>
            <span class="badge-desc">\${b.desc}</span>
          </div>
        </div>
      \`).join('');
      badgesSection.style.display = 'block';
    } else {
      badgesGrid.innerHTML = '<p style="color:var(--tm);font-size:13px;padding:12px;">Henüz rozet yok.</p>';
    }
  }
}

// Hook into existing profile load
const originalLoadProfile = window.loadProfile;
window.loadProfile = async () => {
  if (typeof originalLoadProfile === 'function') await originalLoadProfile();
  if (currentUserId) {
    await renderProfileEnhancedStats(currentUserId);
  }
};
`;

if (!content.includes('renderProfileEnhancedStats')) {
  fs.writeFileSync(path, content + profileLogic, 'utf8');
  console.log('Profile logic appended');
} else {
  console.log('Profile logic already present');
}
