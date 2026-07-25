<div align="center">

<img src="build/icon.png" alt="Bekofy Logo" width="120" />

# Bekofy

**A feature-rich desktop music streaming application built with Electron**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-41-47848F.svg)](https://www.electronjs.org/)
[![Version](https://img.shields.io/badge/Version-1.4.0-blue.svg)](#)

</div>

---

Bekofy is a Spotify-inspired desktop music player built with Electron. It offers a modern UI with features like synced lyrics, jam sessions, Discord Rich Presence, offline downloads, and a full artist upload system — all backed by Supabase and Cloudflare R2.

## Features

- **Music Player** — Play, pause, skip, seek with full queue management, shuffle, and repeat modes
- **Synced Lyrics** — Real-time synchronized lyrics display
- **Jam Sessions** — Listen together with friends in real time
- **Discord Rich Presence** — Show what you're listening to on Discord
- **Mini Player** — Compact always-on-top player for quick controls
- **Playlist Management** — Create, edit, and curate playlists
- **Search with History** — Search songs, artists, and albums with search history
- **Daily Mix & Recommendations** — Personalized music discovery
- **Friend System & Activity** — See what friends are listening to
- **Profile Customization** — Avatar, banner, and profile frames
- **Multi-Account Support** — Switch between multiple accounts
- **Offline Downloads** — Download songs for offline listening
- **Artist Upload System** — Artists can upload and manage their music
- **Admin Panel** — Full admin dashboard for managing content and users
- **Premium Page** — Premium subscription management
- **Wrapped** — Year-end listening summary and stats
- **Auto Updates** — Seamless in-app updates via GitHub Releases

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Runtime | Electron 41 |
| Backend / Database | Supabase |
| File Storage | Cloudflare R2 |
| Rich Presence | Discord RPC |
| Audio Processing | FFmpeg |
| Auto Updates | electron-updater |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm or yarn
- A Supabase project
- A Cloudflare R2 bucket
- A Discord Application (for RPC)

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/TikziiBaba/bekofy.git
   cd bekofy
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy the example env file and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your keys:

   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   GH_TOKEN=your-github-token-here
   DISCORD_SPOTIFY_CLIENT_ID=your-discord-client-id
   R2_ACCOUNT_ID=your-r2-account-id
   R2_ACCESS_KEY_ID=your-r2-access-key
   R2_SECRET_ACCESS_KEY=your-r2-secret-key
   R2_BUCKET_NAME=bekofy-music
   R2_PUBLIC_DOMAIN=your-custom-domain.com
   ```

4. **Start the application**

   ```bash
   npm start
   ```

## Development

Run in development mode with hot-reload:

```bash
npm run dev
```

This starts Electron with the `--dev` flag. The website is served locally via `serve` on port 3333.

## Building

Build a Windows installer:

```bash
npm run build
```

Output will be in the `dist/` directory. The build uses `electron-builder` with NSIS installer targeting x64.

To configure auto-updates, set up a GitHub Release with the built files and a `latest.yml` manifest.

## Project Structure

```
bekofy/
├── build/                  # Build resources (icons)
│   ├── icon.ico
│   ├── icon.png
│   └── logo.svg
├── src/
│   ├── css/                # Application stylesheets
│   │   ├── app.css
│   │   ├── auth.css
│   │   ├── mini-player.css
│   │   └── splash.css
│   ├── js/                 # Application modules
│   │   ├── admin.js        # Admin panel logic
│   │   ├── app.js          # Main app initialization
│   │   ├── artist.js       # Artist upload system
│   │   ├── auth.js         # Authentication
│   │   ├── config.js       # Configuration
│   │   ├── context-menu.js # Right-click menus
│   │   ├── controls.js     # Playback controls
│   │   ├── discord-rpc.js  # Discord Rich Presence
│   │   ├── friend-activity.js # Friend system
│   │   ├── lyrics.js       # Synced lyrics
│   │   ├── multi-account.js # Multi-account support
│   │   ├── navigation.js   # SPA navigation
│   │   ├── player.js       # Core music player
│   │   ├── playlist.js     # Playlist management
│   │   ├── premium.js      # Premium features
│   │   ├── profile.js      # Profile customization
│   │   ├── queue.js        # Queue management
│   │   ├── search.js       # Search & history
│   │   ├── songs.js        # Song data handling
│   │   ├── supabase.js     # Supabase client
│   │   ├── user-info.js    # User info utilities
│   │   ├── utils.js        # Shared utilities
│   │   └── wrapped.js      # Year-end summary
│   └── pages/              # HTML pages
│       ├── app.html        # Main application
│       ├── auth.html       # Login / Register
│       ├── download.html   # Download manager
│       ├── mini-player.html # Mini player window
│       └── splash.html     # Splash screen
├── website/                # Landing page & web assets
├── dist/                   # Built installers
├── main.js                 # Electron main process
├── preload.js              # Preload script (IPC bridge)
├── downloader.js           # Audio download & conversion
├── r2-uploader.js          # Cloudflare R2 upload
├── electron-builder.yml    # Build configuration
├── package.json
└── .env                    # Environment variables (git-ignored)
```

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2025 Bekir
