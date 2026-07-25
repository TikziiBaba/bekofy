# Changelog

All notable changes to Bekofy will be documented in this file.

## [1.4.0] - 2025

### Added

- **Music Player** — Full-featured player with play, pause, skip, seek, shuffle, and repeat (one/all)
- **Queue Management** — View, reorder, and clear the playback queue
- **Playlist Management** — Create, edit, delete, and curate personal playlists
- **Synced Lyrics** — Real-time synchronized lyrics overlay during playback
- **Jam Sessions** — Listen together with friends in real time with synced playback
- **Discord Rich Presence** — Display current song, artist, and album on your Discord profile
- **Mini Player** — Compact always-on-top window with playback controls and progress
- **Admin Panel** — Dashboard for managing songs, users, reports, and platform settings
- **Artist Upload System** — Dedicated upload flow for artists to publish music (download, convert, upload to R2)
- **Friend System & Activity** — Add friends, see their listening activity in real time
- **Premium Page** — Subscription management and premium feature gating
- **Offline Downloads** — Download songs for offline playback with metadata caching
- **Wrapped** — Year-end listening summary with stats and highlights
- **Profile Customization** — Upload avatar, banner, and select profile frames
- **Multi-Account Support** — Switch between multiple user accounts seamlessly
- **Search with History** — Full-text search across songs, artists, and albums with persistent search history
- **Daily Mix & Recommendations** — Personalized playlists based on listening habits
- **Auto Updates** — Seamless in-app updates via GitHub Releases (electron-updater)
- **Splash Screen** — Animated loading screen on application startup
- **Custom Titlebar** — Frameless window with custom minimize, maximize, and close controls
- **Context Menus** — Right-click actions on songs, playlists, and artists
- **Navigation** — SPA-style in-app navigation with browser back-button handling
- **Supabase Auth** — Email/password and OAuth authentication
- **Cloudflare R2 Storage** — Fast, scalable file storage for music and assets

### Infrastructure

- Electron 41 runtime
- Supabase for backend and database
- Cloudflare R2 for music file storage
- FFmpeg for audio format conversion
- YouTube-DL integration for source audio fetching
- NGROK for local development tunneling
- electron-builder for Windows NSIS installer packaging
- Stylelint for CSS linting with configurable rules

---

*For older versions or detailed commit history, see the [GitHub repository](https://github.com/TikziiBaba/bekofy).*
