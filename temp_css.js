const fs = require('fs');
const path = 'c:/Users/dedyu/Desktop/bekir/src/css/app.css';
let content = fs.readFileSync(path, 'utf8');

const cssLogic = `
/* ===== Dynamic Home & Hero Banner ===== */
.hero-banner-section {
  margin-bottom: 30px;
}
.hero-banner {
  position: relative;
  height: 300px;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 30px;
  cursor: pointer;
  transition: transform 0.3s ease;
}
.hero-banner:hover {
  transform: scale(1.02);
}
.hero-banner-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-size: cover;
  background-position: center;
  z-index: 1;
}
.hero-banner-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 100%);
  z-index: 2;
}
.hero-banner-content {
  position: relative;
  z-index: 3;
}
.hero-banner-label {
  background: var(--primary-color);
  color: black;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  display: inline-block;
  margin-bottom: 10px;
}
.hero-banner-title {
  font-size: 48px;
  font-weight: 800;
  margin: 0 0 5px 0;
  color: white;
}
.hero-banner-artist {
  font-size: 18px;
  color: #ccc;
  margin: 0 0 20px 0;
}
.hero-banner-play {
  background: var(--primary-color);
  color: black;
  border: none;
  border-radius: 30px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}
.hero-banner-play:hover {
  transform: scale(1.05);
  background: #1ed760;
}

/* ===== Daily Mix ===== */
.daily-mix-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}
.daily-mix-card {
  background: var(--card-bg);
  padding: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s ease;
  position: relative;
}
.daily-mix-card:hover {
  background: var(--card-hover);
}
.daily-mix-card:hover .daily-mix-play {
  opacity: 1;
  transform: translateY(0);
}
.daily-mix-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 4px;
  object-fit: cover;
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.daily-mix-info h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.daily-mix-info p {
  margin: 0;
  font-size: 14px;
  color: var(--tm);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.daily-mix-play {
  position: absolute;
  bottom: 80px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--primary-color);
  color: black;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateY(8px);
  transition: all 0.3s ease;
  box-shadow: 0 8px 8px rgba(0,0,0,0.3);
  cursor: pointer;
}
.daily-mix-play:hover {
  transform: scale(1.05) !important;
  background: #1ed760;
}

/* ===== Profile Enhanced ===== */
.profile-badges-section {
  margin-top: 30px;
}
.profile-badges-title {
  font-size: 18px;
  margin-bottom: 15px;
  color: white;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding-bottom: 10px;
}
.profile-badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}
.profile-badge {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: transform 0.2s, background 0.2s;
}
.profile-badge:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,0.1);
}
.badge-icon {
  font-size: 24px;
}
.badge-info {
  display: flex;
  flex-direction: column;
}
.badge-name {
  color: white;
  font-weight: bold;
  font-size: 14px;
}
.badge-desc {
  color: var(--tm);
  font-size: 12px;
}

/* ===== Jam (Birlikte Dinleme) ===== */
.btn-jam {
  transition: all 0.3s ease;
}
.btn-jam:hover {
  color: var(--primary-color) !important;
}
.btn-jam.active {
  color: var(--primary-color);
  animation: pulse-jam 2s infinite;
}
@keyframes pulse-jam {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.jam-active-banner {
  background: linear-gradient(90deg, #1db954 0%, #1ed760 100%);
  border-radius: 8px;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
}
.jam-banner-pulse {
  position: absolute;
  top: 0; left: 0; bottom: 0; right: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: banner-sweep 3s infinite;
}
@keyframes banner-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.jam-banner-text {
  color: black;
  font-weight: bold;
  font-size: 16px;
}
.jam-banner-count {
  background: rgba(0,0,0,0.2);
  color: black;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
}
.jam-banner-code {
  color: black;
  font-family: monospace;
  font-weight: bold;
  font-size: 18px;
  letter-spacing: 2px;
  margin-left: auto;
}
.jam-banner-leave {
  background: black;
  color: white;
  border: none;
  border-radius: 20px;
  padding: 6px 15px;
  font-weight: bold;
  font-size: 12px;
  cursor: pointer;
  z-index: 2;
  transition: transform 0.2s;
}
.jam-banner-leave:hover {
  transform: scale(1.05);
}
`;

if (!content.includes('.hero-banner-section')) {
  fs.writeFileSync(path, content + cssLogic, 'utf8');
  console.log('CSS appended');
} else {
  console.log('CSS already present');
}
