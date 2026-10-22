// Bekofy prototip etkileşimleri. Veri: data.js (window.BEKOFY_DATA), ikonlar: icons.js (window.BEKOFY_ICONS).
(function () {
  'use strict';

  const D = window.BEKOFY_DATA;
  document.body.insertAdjacentHTML('afterbegin', window.BEKOFY_ICONS);

  const root = document.documentElement;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const find = (list, id) => list.find((x) => x.id === id);
  const song = (id) => find(D.songs, id);
  const album = (id) => find(D.albums, id);
  const artist = (id) => find(D.artists, id);
  const playlist = (id) => find(D.playlists, id);
  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const minutes = (ids) => `${Math.round(ids.reduce((sum, id) => sum + song(id).duration, 0) / 60)} dk`;
  const art = (item, cls = '') => `<div class="cover p${item.pattern} ${cls}" style="--c1:${item.seed};--c2:${item.seed2}" aria-hidden="true"></div>`;
  const songArt = (s, cls) => art(album(s.albumId), cls);
  const artistArt = (a) => art(D.albums.find((al) => al.artistId === a.id), 'round');
  const artistLink = (s) => `<a href="#artist/${s.artistId}">${esc(artist(s.artistId).name)}</a>`;
  const motionOk = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let storedTheme = 'dark';
  try { storedTheme = localStorage.getItem('bekofy-proto-theme') || 'dark'; } catch (e) { /* depolama kapalı olabilir */ }

  const state = {
    songId: 's1', t: 42, playing: false, volume: 80, muted: false, shuffle: false, repeat: 0,
    context: 'pl1', queue: ['s5', 's13', 's2', 's6', 's14', 's10'], history: [],
    liked: new Set(D.playlists[0].songIds), following: new Set(['ar1']), saved: new Set(['pl1']),
    theme: storedTheme, coverColor: true, panelTab: 'queue',
    npOpen: false, npTab: 'lyrics', searchQuery: '', libraryFilter: 'all',
    imp: { phase: 'idle', online: true, url: '', error: '', progress: 0, step: 0 },
    wrappedIndex: 0, lastFocus: null, firstRender: true,
  };

  /* ---------- Tema ve kapaktan ortam ışığı (vurgu her zaman marka yeşili) ---------- */
  const lightQuery = window.matchMedia('(prefers-color-scheme: light)');
  const mode = () => {
    const t = root.getAttribute('data-theme');
    if (t === 'system') return lightQuery.matches ? 'light' : 'dark';
    return t === 'light' ? 'light' : 'dark';
  };
  const AMBIENT_VARS = Object.keys(Object.values(D.themes)[0].dark);

  function applyAmbient() {
    const vars = state.coverColor ? D.themes[album(song(state.songId).albumId).seed][mode()] : null;
    AMBIENT_VARS.forEach((k) => (vars ? root.style.setProperty(k, vars[k]) : root.style.removeProperty(k)));
  }

  const THEME_META = { dark: ['moon', 'Koyu'], light: ['sun', 'Açık'], system: ['monitor', 'Sistem'] };
  function setTheme(theme) {
    state.theme = theme;
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('bekofy-proto-theme', theme); } catch (e) { /* depolama kapalı olabilir */ }
    applyAmbient();
    const [ic, label] = THEME_META[theme];
    const btn = $('#theme-toggle');
    btn.innerHTML = icon(ic);
    btn.setAttribute('aria-label', `Tema: ${label}. Değiştir`);
  }
  lightQuery.addEventListener('change', applyAmbient);

  /* ---------- Duyurular ---------- */
  function toast(msg) {
    const region = $('#toast-region');
    region.innerHTML = `<div class="toast">${esc(msg)}</div>`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (region.innerHTML = ''), 2600);
  }
  const announce = (msg) => ($('#announcer').textContent = msg);

  /* ---------- Ortak parçalar ---------- */
  const likeBtn = (id, sm = true) =>
    `<button class="icon-btn like ${sm ? 'sm' : ''}" type="button" data-like="${id}" aria-pressed="${state.liked.has(id)}" aria-label="Beğen: ${esc(song(id).title)}">${icon('heart')}</button>`;
  const playIcon = (on) => icon(on ? 'pause' : 'play', 'icon-fill');
  const isCurrentContext = (ctx) => state.context === ctx && state.playing;

  function card({ href, item, title, sub, ctx }) {
    return `<div class="card">
      <div class="card-art" style="position:relative">${art(item)}
        <button class="play-btn sm card-play" type="button" data-play-ctx="${ctx}" aria-label="Çal: ${esc(title)}">${playIcon(isCurrentContext(ctx))}</button>
      </div>
      <a class="card-link text-stack" href="${href}"><span class="title-line">${esc(title)}</span><span class="meta-line">${esc(sub)}</span></a>
    </div>`;
  }

  function trackList(ids, ctx, label) {
    return `<div class="track-list"><div class="tracks-head" aria-hidden="true"><span>#</span><span>Başlık</span><span>Albüm</span><span></span><span class="end">${icon('clock-3')}</span><span></span></div>
    <ol class="tracks" aria-label="${esc(label)}">${ids.map((id, i) => {
      const s = song(id);
      const cur = id === state.songId;
      return `<li class="track" data-id="${id}" data-ctx="${ctx}" ${cur ? 'aria-current="true"' : ''}>
        <span class="track-index"><span class="num">${cur && state.playing ? icon('audio-lines') : i + 1}</span>
          <button class="icon-btn sm play-mini" type="button" data-play-song="${id}" data-ctx="${ctx}" aria-label="${cur && state.playing ? 'Duraklat' : 'Çal'}: ${esc(s.title)}">${playIcon(cur && state.playing)}</button></span>
        <span class="track-main">${songArt(s)}<span class="text-stack"><span class="title-line">${esc(s.title)}</span><span class="meta-line">${artistLink(s)}</span></span></span>
        <span class="track-album"><a href="#album/${s.albumId}">${esc(album(s.albumId).title)}</a></span>
        ${likeBtn(id)}
        <span class="track-time">${clock(s.duration)}</span>
        <button class="icon-btn sm" type="button" data-action="toast" data-msg="Seçenekler menüsü: sıraya ekle, çalma listesine ekle, paylaş" aria-label="Diğer seçenekler: ${esc(s.title)}">${icon('ellipsis')}</button>
      </li>`;
    }).join('')}</ol></div>`;
  }

  /** Bir bağlamın (çalma listesi, albüm, sanatçı) şarkı listesi. */
  function contextSongs(ctx) {
    if (playlist(ctx)) return playlist(ctx).songIds;
    if (album(ctx)) return D.songs.filter((s) => s.albumId === ctx).map((s) => s.id);
    if (artist(ctx)) return D.songs.filter((s) => s.artistId === ctx).map((s) => s.id);
    return D.songs.map((s) => s.id);
  }
  const contextName = (ctx) => (playlist(ctx) || album(ctx) || {}).title || (artist(ctx) || {}).name || 'Kitaplığın';

  /* ---------- Ekranlar ---------- */
  const views = {};

  views.home = () => {
    const s = song(state.songId);
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
    const quick = [...D.playlists.slice(0, 4).map((p) => ({ href: `#playlist/${p.id}`, item: p, title: p.title })),
      ...D.albums.slice(1, 3).map((a) => ({ href: `#album/${a.id}`, item: a, title: a.title }))];
    const fresh = album('al3');
    return {
      title: 'Ana sayfa',
      html: `<h1 class="display">${greet}, ${esc(D.user.name)}</h1>
      <div class="hero">
        <section class="hero-card glass-panel" aria-labelledby="continue-title">
          ${songArt(s)}
          <div class="text-stack">
            <span class="eyebrow">Kaldığın yerden devam et</span>
            <h2 id="continue-title">${esc(s.title)}</h2>
            <span class="meta-line">${artistLink(s)} · ${esc(contextName(state.context))}</span>
            <div class="hero-actions">
              <button class="play-btn xl" type="button" data-action="toggle-play" aria-label="${state.playing ? 'Duraklat' : 'Çal'}">${playIcon(state.playing)}</button>
              ${likeBtn(s.id, false)}
              <button class="icon-btn" type="button" data-action="open-np" aria-label="Şimdi çalıyor ekranını aç">${icon('maximize-2')}</button>
            </div>
          </div>
        </section>
        <nav class="quick-grid" aria-label="Hızlı erişim">
          ${quick.map((q) => `<a class="quick glass-panel" href="${q.href}">${art(q.item)}<span>${esc(q.title)}</span></a>`).join('')}
        </nav>
      </div>
      <section class="section" aria-labelledby="for-you">
        <div class="section-head"><h2 class="section-title" id="for-you">Senin için</h2><a class="link" href="#library">Tümünü gör</a></div>
        <div class="shelf">${D.playlists.slice(1).map((p) => card({ href: `#playlist/${p.id}`, item: p, title: p.title, sub: p.desc, ctx: p.id })).join('')}
          ${D.albums.slice(3, 6).map((a) => card({ href: `#album/${a.id}`, item: a, title: a.title, sub: artist(a.artistId).name, ctx: a.id })).join('')}</div>
      </section>
      <section class="section" aria-labelledby="friends-title">
        <div class="section-head"><h2 class="section-title" id="friends-title">Arkadaşların ne dinliyor</h2></div>
        <ul class="friends-strip">${D.friends.map((f) => {
          const fs = song(f.songId);
          return `<li class="friend glass-panel"><span class="avatar" aria-hidden="true">${f.initials}</span>
            <span class="text-stack"><span class="title-line">${esc(f.name)}</span><span class="meta-line">${esc(fs.title)} · ${esc(artist(fs.artistId).name)}</span></span>
            <span class="when">${esc(f.ago)}</span></li>`;
        }).join('')}</ul>
      </section>
      <section class="section feature" aria-labelledby="fresh-title">
        ${art(fresh)}
        <div>
          <div class="feature-head"><span class="meta-line">Yeni albüm · ${fresh.year}</span><h2 class="page-title" id="fresh-title">${esc(fresh.title)}</h2><span class="meta-line">${esc(artist(fresh.artistId).name)}</span></div>
          ${trackList(contextSongs(fresh.id), fresh.id, `${fresh.title} şarkıları`)}
        </div>
      </section>
      <section class="band" aria-labelledby="jam-promo">
        <div class="text-stack" style="gap:var(--space-2)"><h2 id="jam-promo">Arkadaşlarınla aynı anda dinle</h2><p>Jam başlat, kodu paylaş; herkes sıraya şarkı ekleyebilir.</p></div>
        <div class="row"><span class="avatars" aria-hidden="true">${D.jam.participants.map((p) => `<span class="avatar">${p.initials}</span>`).join('')}</span><a class="btn btn-primary" href="#jam">Jam başlat</a></div>
      </section>`,
    };
  };

  function collectionView(ctx, kind) {
    const item = playlist(ctx) || album(ctx);
    const ids = contextSongs(ctx);
    const owner = kind === 'Albüm' ? `<strong>${esc(artist(item.artistId).name)}</strong> · ${item.year}` : `<strong>${esc(D.user.name)}</strong>`;
    return {
      title: item.title,
      html: `<header class="collection-head">${art(item)}
        <div class="text-stack"><span class="kind">${kind}</span><h1 class="display">${esc(item.title)}</h1>
          ${item.desc ? `<p class="lede">${esc(item.desc)}</p>` : ''}
          <p class="collection-meta">${owner} · ${ids.length} şarkı, ${minutes(ids)}</p></div></header>
      <div class="actions">
        <button class="play-btn xl" type="button" data-play-ctx="${ctx}" aria-label="${isCurrentContext(ctx) ? 'Duraklat' : 'Çal'}: ${esc(item.title)}">${playIcon(isCurrentContext(ctx))}</button>
        <button class="icon-btn" type="button" data-action="shuffle" aria-pressed="${state.shuffle}" aria-label="Karışık çal">${icon('shuffle')}</button>
        <button class="icon-btn" type="button" data-save="${ctx}" aria-pressed="${state.saved.has(ctx)}" aria-label="Kitaplığa kaydet">${icon(state.saved.has(ctx) ? 'circle-check' : 'plus')}</button>
        <button class="icon-btn" type="button" data-action="toast" data-msg="${esc(item.title)} indiriliyor. İnternetsiz dinleyebileceksin." aria-label="İndir">${icon('download')}</button>
        <button class="icon-btn" type="button" data-action="toast" data-msg="Bağlantı kopyalandı" aria-label="Paylaş">${icon('share-2')}</button>
      </div>
      <section aria-label="Şarkılar">${trackList(ids, ctx, `${item.title} şarkıları`)}</section>`,
    };
  }
  views.playlist = (id) => collectionView(playlist(id) ? id : 'pl1', 'Çalma listesi');
  views.album = (id) => collectionView(album(id) ? id : 'al1', 'Albüm');

  views.artist = (id) => {
    const a = artist(id) || D.artists[0];
    const following = state.following.has(a.id);
    const albums = D.albums.filter((al) => al.artistId === a.id);
    return {
      title: a.name,
      html: `<header class="collection-head">${artistArt(a)}
        <div class="text-stack"><span class="kind">Sanatçı</span><h1 class="display">${esc(a.name)}</h1>
        <p class="collection-meta"><strong>${a.listeners}</strong> aylık dinleyici</p></div></header>
      <div class="actions">
        <button class="play-btn xl" type="button" data-play-ctx="${a.id}" aria-label="Çal: ${esc(a.name)}">${playIcon(isCurrentContext(a.id))}</button>
        <button class="btn btn-secondary" type="button" data-follow="${a.id}" aria-pressed="${following}">${following ? 'Takip ediliyor' : 'Takip et'}</button>
        <button class="icon-btn" type="button" data-action="toast" data-msg="Bağlantı kopyalandı" aria-label="Paylaş">${icon('share-2')}</button>
      </div>
      <section class="section" aria-labelledby="popular"><h2 class="section-title" id="popular">Popüler</h2>${trackList(contextSongs(a.id), a.id, `${a.name} popüler şarkılar`)}</section>
      <section class="section" aria-labelledby="disco"><h2 class="section-title" id="disco">Albümler</h2>
        <div class="shelf">${albums.map((al) => card({ href: `#album/${al.id}`, item: al, title: al.title, sub: `${al.year} · Albüm`, ctx: al.id })).join('')}</div></section>
      <section class="section" aria-labelledby="about"><h2 class="section-title" id="about">Hakkında</h2>
        <p class="lede glass-panel" style="padding:var(--space-6);border-radius:var(--radius-xl)">${esc(a.name)}, gündelik hayatın küçük anlarını sıcak synth'ler ve akılda kalan nakaratlarla anlatan bir proje. İlk albümü ev stüdyosunda, üç yaz boyunca kaydedildi.</p></section>`,
    };
  };

  const MOODS = [['Odak', 'al6'], ['Yol', 'al7'], ['Gece', 'al8'], ['Pop', 'al3'], ['Akustik', 'al4'], ['Enerji', 'al1'], ['Hüzün', 'al2'], ['Türkçe rock', 'al5']];
  function searchResults() {
    const q = state.searchQuery.trim().toLocaleLowerCase('tr');
    if (!q) {
      return `<section class="section" aria-labelledby="browse"><h2 class="section-title" id="browse">Göz at</h2>
        <div class="tiles">${MOODS.map(([name, al]) => `<a class="tile" href="#album/${al}">${art(album(al))}<span class="tile-label glass-chrome">${name}</span></a>`).join('')}</div></section>`;
    }
    const songs = D.songs.filter((s) => `${s.title} ${artist(s.artistId).name}`.toLocaleLowerCase('tr').includes(q));
    const artists = D.artists.filter((a) => a.name.toLocaleLowerCase('tr').includes(q));
    if (!songs.length && !artists.length) {
      return `<div class="empty glass-panel"><h2>“${esc(state.searchQuery)}” için sonuç yok</h2><p>Yazımı kontrol et ya da bir sanatçı adıyla dene.</p></div>`;
    }
    const top = artists[0] ? { kind: 'Sanatçı', title: artists[0].name, href: `#artist/${artists[0].id}`, artHtml: artistArt(artists[0]) }
      : { kind: 'Şarkı', title: songs[0].title, href: `#album/${songs[0].albumId}`, artHtml: songArt(songs[0]) };
    return `<div class="result-grid">
      <section aria-labelledby="top-r"><h2 class="section-title" id="top-r" style="margin-bottom:var(--space-4)">En iyi sonuç</h2>
        <a class="top-result glass-panel" href="${top.href}">${top.artHtml}<h3>${esc(top.title)}</h3><span class="meta-line">${top.kind}</span></a></section>
      <section aria-labelledby="songs-r"><h2 class="section-title" id="songs-r" style="margin-bottom:var(--space-4)">Şarkılar</h2>
        ${songs.length ? trackList(songs.slice(0, 5).map((s) => s.id), 'search', 'Arama sonucu şarkılar') : '<p class="meta-line">Şarkı bulunamadı.</p>'}</section>
    </div>`;
  }
  views.search = () => ({
    title: 'Ara',
    html: `<h1 class="page-title">Ara</h1>
      <form class="search lg mobile-only" role="search" data-action="search-submit">
        ${icon('search')}<label class="sr-only" for="page-search">Şarkı, sanatçı veya çalma listesi ara</label>
        <input id="page-search" type="search" placeholder="Ne dinlemek istersin?" value="${esc(state.searchQuery)}" autocomplete="off"></form>
      <div id="search-results">${searchResults()}</div>`,
  });

  views.library = () => {
    const filters = [['all', 'Tümü'], ['playlists', 'Çalma listeleri'], ['albums', 'Albümler'], ['artists', 'Sanatçılar'], ['downloads', 'İndirilenler']];
    const f = state.libraryFilter;
    const rows = [
      ...(f === 'all' || f === 'playlists' ? D.playlists.map((p) => ({ href: `#playlist/${p.id}`, art: art(p), title: p.title, meta: `Çalma listesi · ${p.songIds.length} şarkı` })) : []),
      ...(f === 'all' || f === 'albums' ? D.albums.slice(0, 4).map((a) => ({ href: `#album/${a.id}`, art: art(a), title: a.title, meta: `Albüm · ${artist(a.artistId).name}` })) : []),
      ...(f === 'all' || f === 'artists' ? D.artists.slice(0, 4).map((a) => ({ href: `#artist/${a.id}`, art: artistArt(a), title: a.name, meta: 'Sanatçı' })) : []),
    ];
    return {
      title: 'Kitaplığın',
      html: `<h1 class="page-title">Kitaplığın</h1>
      <div class="row" role="group" aria-label="Kitaplığı filtrele">${filters.map(([k, label]) => `<button class="chip" type="button" data-filter="${k}" aria-pressed="${f === k}">${label}</button>`).join('')}</div>
      ${rows.length ? `<ul class="mini-list">${rows.map((r) => `<li><a class="mini-row" href="${r.href}">${r.art}<span class="text-stack"><span class="title-line">${esc(r.title)}</span><span class="meta-line">${esc(r.meta)}</span></span></a></li>`).join('')}</ul>`
        : `<div class="empty glass-panel"><h2>Henüz indirdiğin şarkı yok</h2><p>İnternetsiz dinlemek için bir çalma listesinde indir düğmesine bas.</p><a class="btn btn-secondary" href="#playlist/pl1">Günlük Karışım 1'i aç</a></div>`}`,
    };
  };

  views.profile = () => ({
    title: 'Profil',
    html: `<header class="collection-head"><span class="avatar lg" aria-hidden="true">${D.user.initials}</span>
      <div class="text-stack"><span class="kind">Profil</span><h1 class="display">${esc(D.user.name)}</h1>
      <div class="stats"><div><strong>${D.user.followers}</strong><span>takipçi</span></div><div><strong>${D.user.following}</strong><span>takip</span></div><div><strong>${D.playlists.length}</strong><span>çalma listesi</span></div></div></div></header>
    <div class="actions"><button class="btn btn-secondary" type="button" data-action="toast" data-msg="Profil düzenleyici açıldı">${icon('pencil')}Profili düzenle</button><a class="btn btn-ghost" href="#settings">${icon('settings')}Ayarlar</a></div>
    <section class="section" aria-labelledby="top-artists"><h2 class="section-title" id="top-artists">Bu ay en çok dinlediklerin</h2>
      <div class="circles">${D.artists.slice(0, 4).map((a) => `<a class="circle-card" href="#artist/${a.id}">${artistArt(a)}<span class="title-line">${esc(a.name)}</span><span class="meta-line">Sanatçı</span></a>`).join('')}</div></section>
    <section class="section" aria-labelledby="badges"><h2 class="section-title" id="badges">Rozetler</h2>
      <ul class="badges"><li class="badge">${icon('radio')}Erken dinleyici</li><li class="badge">${icon('users')}Jam ustası</li><li class="badge">${icon('moon')}Gece kuşu</li><li class="badge">${icon('chart-column')}100 saat</li></ul></section>
    <section class="section" aria-labelledby="pub"><h2 class="section-title" id="pub">Herkese açık çalma listeleri</h2>
      <div class="shelf">${D.playlists.slice(1).map((p) => card({ href: `#playlist/${p.id}`, item: p, title: p.title, sub: `${p.songIds.length} şarkı`, ctx: p.id })).join('')}</div></section>
    <section class="section" aria-labelledby="proto"><h2 class="section-title" id="proto">Prototip ekranları</h2>
      <div class="row"><a class="btn btn-secondary" href="#landing">Site</a><a class="btn btn-secondary" href="#admin">Admin: YouTube</a><a class="btn btn-secondary" href="#wrapped">Wrapped</a><a class="btn btn-secondary" href="#jam">Jam</a></div></section>`,
  });

  const sw = (key, label, desc, on) => `<div class="setting"><span class="text-stack"><span id="lbl-${key}" class="label">${label}</span><span id="desc-${key}">${desc}</span></span>
    <button class="switch" type="button" role="switch" data-switch="${key}" aria-checked="${on}" aria-labelledby="lbl-${key}" aria-describedby="desc-${key}"></button></div>`;
  state.switches = { normalize: true, discord: true, autostart: false };
  views.settings = () => ({
    title: 'Ayarlar',
    html: `<h1 class="page-title">Ayarlar</h1>
    <form class="form" data-action="noop">
      <fieldset class="fieldset"><legend>Görünüm</legend>
        <div class="choice-grid">${Object.entries(THEME_META).map(([k, [ic, label]]) => `<label class="choice">${icon(ic, 'icon-md')}<input type="radio" name="theme" value="${k}" ${state.theme === k ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div>
        <div class="group glass-panel">${sw('coverColor', 'Kapak rengini arka planda kullan', 'Arka plandaki ışık çalan şarkının kapağından gelir. Vurgu rengi her zaman yeşil kalır.', state.coverColor)}</div>
      </fieldset>
      <fieldset class="fieldset"><legend>Oynatma</legend>
        <div class="field"><label for="quality">Ses kalitesi</label><select class="input" id="quality"><option>Otomatik</option><option>Normal (128 kbps)</option><option selected>Yüksek (256 kbps)</option><option>Çok yüksek (320 kbps, Premium)</option></select></div>
        <div class="field"><label for="crossfade">Şarkılar arası geçiş</label><div class="row"><input class="slider grow" id="crossfade" type="range" min="0" max="12" step="1" value="4" style="--val:33%" aria-describedby="crossfade-out"><output id="crossfade-out" for="crossfade">4 sn</output></div></div>
        <div class="group glass-panel">${sw('normalize', 'Ses düzeyini dengele', 'Tüm şarkılar yaklaşık aynı yükseklikte çalar.', state.switches.normalize)}</div>
      </fieldset>
      <fieldset class="fieldset"><legend>Masaüstü</legend>
        <div class="group glass-panel">${sw('discord', 'Discord\'da ne dinlediğini göster', 'Arkadaşların Discord profilinde çalan şarkını görür.', state.switches.discord)}
        ${sw('autostart', 'Bilgisayar açılınca başlat', 'Bekofy oturum açılınca arka planda açılır.', state.switches.autostart)}</div>
      </fieldset>
      <fieldset class="fieldset"><legend>Hesap</legend>
        <div class="group glass-panel"><div class="setting"><span class="row"><span class="avatar md" aria-hidden="true">B</span><span class="text-stack"><span class="label">Bekir</span><span>bekir@ornek.com · Ücretsiz plan</span></span></span><span class="status ok"><span class="dot"></span>Etkin</span></div></div>
        <div class="row"><button class="btn btn-secondary" type="button" data-action="toast" data-msg="Hesap ekleme ekranı açıldı">${icon('user-plus')}Hesap ekle</button><button class="btn btn-ghost" type="button" data-action="toast" data-msg="Çıkış yapıldı">${icon('log-out')}Çıkış yap</button></div>
        <div class="notice danger">${icon('triangle-alert')}<div><strong>Hesabı sil</strong>Çalma listelerin, beğenilerin ve dinleme geçmişin kalıcı olarak silinir.<div style="margin-top:var(--space-3)"><button class="btn btn-destructive btn-sm" type="button" data-action="confirm-delete">Hesabı sil</button></div></div></div>
      </fieldset>
    </form>`,
  });

  views.jam = () => ({
    title: 'Jam',
    html: `<h1 class="page-title">Jam</h1>
    <section class="jam-hero glass-panel" aria-labelledby="jam-title">
      <div class="text-stack" style="gap:var(--space-4)"><h2 class="page-title" id="jam-title">${esc(D.user.name)}'in Jam'i</h2>
        <p class="lede">Arkadaşların bu kodla katılır. Herkes sıraya şarkı ekleyebilir, çalan şarkı herkeste aynı anda ilerler.</p>
        <div class="row"><span class="code" aria-label="Katılım kodu ${D.jam.code.split('').join(' ')}">${D.jam.code}<button class="icon-btn sm" type="button" data-action="toast" data-msg="Kod kopyalandı" aria-label="Kodu kopyala">${icon('copy')}</button></span>
        <button class="btn btn-secondary" type="button" data-action="toast" data-msg="Paylaşım bağlantısı kopyalandı">${icon('link')}Bağlantı paylaş</button></div>
        <ul class="people" aria-label="Katılımcılar">${D.jam.participants.map((p) => `<li class="person"><span class="avatar" aria-hidden="true">${p.initials}</span><span class="text-stack"><span>${esc(p.name)}</span>${p.host ? '<small>Oturum sahibi</small>' : ''}</span></li>`).join('')}</ul>
      </div>
      ${icon('qr-code', 'icon-md')}
    </section>
    <section class="section" aria-labelledby="jam-queue"><div class="section-head"><h2 class="section-title" id="jam-queue">Ortak sıra</h2><button class="btn btn-secondary btn-sm" type="button" data-action="go-search">${icon('list-plus')}Şarkı ekle</button></div>
      <ul class="mini-list">${D.jam.queue.map((q) => { const s = song(q.songId); return `<li class="mini-row">${songArt(s)}<span class="text-stack"><span class="title-line">${esc(s.title)}</span><span class="meta-line">${esc(artist(s.artistId).name)}</span></span><span class="by">Ekleyen: ${esc(q.by)}</span></li>`; }).join('')}</ul></section>
    <div><button class="btn btn-destructive" type="button" data-action="confirm-jam">Jam'i bitir</button></div>`,
  });

  /* ---------- Site: tanıtım ---------- */
  views.landing = () => {
    const al = album('al7');
    return {
      title: 'Müzik öne çıksın',
      html: `<div class="site"><header class="site-header glass-chrome">
        <a class="brand" href="#landing" aria-label="Bekofy"><svg class="brand-mark" viewBox="0 0 100 100" aria-hidden="true"><use href="#bk-mark"/></svg><span class="brand-word">bekofy</span></a>
        <nav aria-label="Site"><a class="btn btn-ghost btn-sm" href="#landing/features">Özellikler</a><a class="btn btn-ghost btn-sm" href="#landing/plans">Premium</a><a class="btn btn-ghost btn-sm" href="#landing/download">İndir</a></nav>
        <div class="end"><a class="btn btn-ghost btn-sm" href="#home">Giriş yap</a><a class="btn btn-primary btn-sm" href="#home">Uygulamayı aç</a></div></header>
      <main class="site-main" id="site-main" tabindex="-1">
        <section class="site-hero" aria-labelledby="hero-title" id="download">
          <div class="copy"><h1 class="display" id="hero-title">Karanlıkta parlayan müzik.</h1>
            <p class="lede">Bekofy'nin arka planı çalan şarkının kapağından ışık alır; arayüz geri çekilir, müzik öne çıkar. Jam ile arkadaşlarınla aynı anda dinle.</p>
            <div class="downloads"><a class="btn btn-primary btn-lg" href="#home">${icon('download')}Windows için indir</a><a class="btn btn-secondary btn-lg" href="#home">${icon('smartphone')}Android</a>
            <button class="btn btn-secondary btn-lg" type="button" aria-disabled="true" aria-describedby="ios-note">${icon('smartphone')}iOS</button></div>
            <p class="meta-line" id="ios-note">iOS sürümü yakında. Sürüm 2.0 · Windows 10 ve üstü.</p></div>
          <div class="hero-visual" aria-hidden="true">${art(al)}<div class="float glass-chrome">${art(al)}<span class="text-stack"><span class="title-line">Yaz Sonu</span><span class="meta-line">Ayaz Kaya</span></span><span class="play-btn sm" style="margin-inline-start:auto">${icon('pause', 'icon-fill')}</span></div></div>
        </section>
        <section aria-labelledby="features-title" id="features" class="section"><h2 class="page-title" id="features-title">Arayüz değil, müzik.</h2>
          <div class="bento">
            <article class="glass-panel"><div class="glow-row" aria-hidden="true">${['al1', 'al2', 'al3'].map((id) => art(album(id), 'glow')).join('')}</div>${icon('image', 'icon-md')}<h3>Her şarkıda yeni bir ışık</h3><p>Arka plandaki ışık kapaktan gelir; yazılar her renkte okunur, yeşil vurgu hep yerinde kalır.</p></article>
            <article class="glass-panel">${icon('users', 'icon-md')}<h3>Jam</h3><p>Kodu paylaş, birlikte dinleyin.</p></article>
            <article class="glass-panel">${icon('mic-vocal', 'icon-md')}<h3>Senkron şarkı sözleri</h3><p>Satıra dokun, şarkı oraya gitsin.</p></article>
            <article class="glass-panel">${icon('download', 'icon-md')}<h3>İnternetsiz dinle</h3><p>Çalma listelerini indir, yolda da çalsın.</p></article>
            <article class="glass-panel">${icon('monitor', 'icon-md')}<h3>Discord ve mini oynatıcı</h3><p>Masaüstünde ne dinlediğini göster, küçük pencerede kontrol et.</p></article>
          </div></section>
        <section aria-labelledby="plans-title" id="plans" class="section"><h2 class="page-title" id="plans-title">Planlar</h2>
          <div class="plans">
            <article class="plan featured"><h3>Premium</h3><p class="price">₺39,99 <small>/ ay</small></p>
              <ul><li>${icon('check')}Reklamsız dinleme</li><li>${icon('check')}320 kbps ses</li><li>${icon('check')}Sınırsız indirme</li><li>${icon('check')}Premium temalar</li></ul>
              <p class="note">Öğrenci planı ₺19,99. Ödemeler yakında PayTR ile.</p><a class="btn btn-primary btn-lg" href="#home">Premium'a geç</a></article>
            <article class="plan glass-panel"><h3>Ücretsiz</h3><p class="price">₺0</p>
              <ul><li>${icon('check')}Tüm kütüphane</li><li>${icon('check')}Jam ve şarkı sözleri</li><li>${icon('check')}128 kbps ses</li></ul>
              <p class="note">Kart gerekmez.</p><a class="btn btn-secondary btn-lg" href="#home">Ücretsiz başla</a></article>
          </div></section>
      </main>
      <footer class="site-footer"><span>© 2026 Bekofy</span><span class="row"><a href="#landing">Gizlilik</a><a href="#landing">Koşullar</a><a href="#admin">Admin</a></span></footer></div>`,
    };
  };

  /* ---------- Site: admin, YouTube içe aktarma ---------- */
  const YT_RE = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)[\w-]{6,}/;
  const STEPS = ['YouTube\'dan indiriliyor', 'MP3\'e dönüştürülüyor', 'Ses ve kapak yükleniyor', 'Kütüphaneye kaydediliyor'];
  function importBody() {
    const imp = state.imp;
    const yt = D.youtubePreview;
    if (!imp.online) {
      return `<div class="notice danger" role="alert">${icon('server-off')}<div><strong>Yerel sunucuya bağlanılamadı</strong>Bilgisayarında <code>npm run yt-server</code> komutunu çalıştır, sonra tekrar dene.
        <div style="margin-top:var(--space-3)"><button class="btn btn-secondary btn-sm" type="button" data-action="imp-retry">Tekrar dene</button></div></div></div>`;
    }
    if (imp.phase === 'idle' || imp.phase === 'fetching') {
      const busy = imp.phase === 'fetching';
      return `<form class="form" data-action="imp-fetch" novalidate>
        <div class="field"><label for="yt-url">YouTube bağlantısı</label>
          <div class="row"><input class="input grow" id="yt-url" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" value="${esc(imp.url)}" aria-describedby="yt-hint${imp.error ? ' yt-err' : ''}" ${imp.error ? 'aria-invalid="true"' : ''}>
          <button class="btn btn-primary" type="submit" ${busy ? 'aria-busy="true" aria-disabled="true"' : ''}>${icon(busy ? 'loader-circle' : 'search')}${busy ? 'Bilgiler getiriliyor…' : 'Bilgileri getir'}</button></div>
          <span class="hint" id="yt-hint">youtube.com, youtu.be, Shorts ve YouTube Music bağlantıları desteklenir.</span>
          ${imp.error ? `<span class="error" id="yt-err">${icon('triangle-alert')}${esc(imp.error)}</span>` : ''}</div>
        <p class="field-note">Örnek bağlantı: <button class="link" type="button" data-action="imp-example">${esc(yt.url)}</button></p></form>`;
    }
    if (imp.phase === 'preview') {
      return `<form class="preview glass-panel" data-action="imp-start" aria-labelledby="pv-title" novalidate>
        <div class="preview-art">${art(yt)}<button class="btn btn-secondary btn-sm" type="button" data-action="toast" data-msg="Kapak seçme penceresi açıldı">${icon('image')}Kapağı değiştir</button><span class="meta-line">YouTube kapağı kullanılıyor</span></div>
        <div class="form" style="gap:var(--space-4)"><h2 class="section-title" id="pv-title">Bilgileri kontrol et</h2>
          <div class="field"><label for="f-title">Şarkı adı</label><input class="input" id="f-title" value="Yaz Sonu" required></div>
          <div class="field"><label for="f-artist">Sanatçı</label><input class="input" id="f-artist" value="${esc(yt.channel)}" required></div>
          <div class="field"><label for="f-album">Albüm <span class="meta-line">(isteğe bağlı)</span></label><input class="input" id="f-album" value="Ağustos"></div>
          <p class="meta-line">Süre ${clock(yt.duration)} · Kaynak: “${esc(yt.rawTitle)}”</p>
          <div class="row"><button class="btn btn-primary" type="submit">${icon('plus')}Kütüphaneye ekle</button><button class="btn btn-ghost" type="button" data-action="imp-reset">Vazgeç</button></div></div></form>`;
    }
    if (imp.phase === 'importing') {
      return `<section class="glass-panel" style="padding:var(--space-6);border-radius:var(--radius-xl);display:flex;flex-direction:column;gap:var(--space-5)" aria-labelledby="imp-title">
        <h2 class="section-title" id="imp-title">Yaz Sonu ekleniyor</h2>
        <ol class="steps">${STEPS.map((s, i) => `<li class="step" data-state="${i < imp.step ? 'done' : i === imp.step ? 'active' : 'todo'}">${icon(i < imp.step ? 'circle-check' : i === imp.step ? 'loader-circle' : 'clock-3')}${s}</li>`).join('')}</ol>
        <div class="progress" role="progressbar" aria-label="İçe aktarma" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${imp.progress}"><div style="--val:${imp.progress}%"></div></div>
        <div class="progress-row"><span>${STEPS[imp.step]}</span><span>%${imp.progress}</span></div></section>`;
    }
    return `<div class="notice success" role="status">${icon('circle-check')}<div><strong>Yaz Sonu eklendi</strong>Şarkı kütüphanede; uygulamada aramada görünüyor.
      <div class="row" style="margin-top:var(--space-3)"><button class="btn btn-secondary btn-sm" type="button" data-action="imp-reset">Başka şarkı ekle</button><a class="btn btn-ghost btn-sm" href="#search">Uygulamada aç</a></div></div></div>`;
  }
  views.admin = () => ({
    title: 'YouTube\'dan şarkı ekle',
    html: `<div class="admin"><nav class="sidebar glass-panel" aria-label="Admin menüsü">
        <a class="brand" href="#landing" aria-label="Bekofy site"><svg class="brand-mark" viewBox="0 0 100 100" aria-hidden="true"><use href="#bk-mark"/></svg><span class="brand-word">bekofy</span></a>
        <div class="nav">${[['chart-column', 'Genel bakış'], ['music', 'Şarkılar'], ['youtube', 'YouTube\'dan ekle', true], ['users', 'Kullanıcılar'], ['shield', 'Premium talepleri'], ['user-plus', 'Sanatçı başvuruları']]
          .map(([ic, label, cur]) => `<a class="nav-item" href="#admin" ${cur ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('')}</div>
        <div class="side-foot"><a class="link" href="#home">Uygulamaya dön</a></div></nav>
      <main class="admin-main glass-panel" id="site-main" tabindex="-1">
        <div class="admin-head"><h1 class="page-title">YouTube'dan şarkı ekle</h1>
          <div class="row"><span class="status ${state.imp.online ? 'ok' : 'off'}"><span class="dot" aria-hidden="true"></span>Yerel sunucu: ${state.imp.online ? 'bağlı' : 'bağlı değil'}</span>
          <button class="btn btn-ghost btn-sm" type="button" data-action="imp-toggle-online">${state.imp.online ? 'Kopuk durumu göster' : 'Bağlı durumu göster'}</button></div></div>
        <div id="imp-body">${importBody()}</div>
        <section class="section" aria-labelledby="recent"><h2 class="section-title" id="recent">Son eklenenler</h2>
          <ul class="mini-list">${['s13', 's10', 's5'].map((id) => { const s = song(id); return `<li class="mini-row">${songArt(s)}<span class="text-stack"><span class="title-line">${esc(s.title)}</span><span class="meta-line">${esc(artist(s.artistId).name)}</span></span><span class="by">YouTube</span></li>`; }).join('')}</ul></section>
      </main></div>`,
  });

  function renderImport() {
    $('#imp-body').innerHTML = importBody();
    $('.admin-head .status').outerHTML = `<span class="status ${state.imp.online ? 'ok' : 'off'}"><span class="dot" aria-hidden="true"></span>Yerel sunucu: ${state.imp.online ? 'bağlı' : 'bağlı değil'}</span>`;
  }
  function runImport() {
    const imp = state.imp;
    imp.phase = 'importing'; imp.step = 0; imp.progress = 0;
    renderImport();
    const timer = setInterval(() => {
      imp.progress = Math.min(100, imp.progress + 4);
      imp.step = Math.min(3, Math.floor(imp.progress / 25));
      if (imp.progress >= 100) {
        clearInterval(timer);
        imp.phase = 'done';
        renderImport();
        announce('Yaz Sonu kütüphaneye eklendi');
        return;
      }
      const bar = $('.progress');
      if (!bar) return clearInterval(timer);
      bar.setAttribute('aria-valuenow', imp.progress);
      bar.firstElementChild.style.setProperty('--val', `${imp.progress}%`);
      $('.progress-row').innerHTML = `<span>${STEPS[imp.step]}</span><span>%${imp.progress}</span>`;
      $$('.step').forEach((el, i) => {
        const st = i < imp.step ? 'done' : i === imp.step ? 'active' : 'todo';
        if (el.dataset.state !== st) { el.dataset.state = st; el.innerHTML = `${icon(st === 'done' ? 'circle-check' : st === 'active' ? 'loader-circle' : 'clock-3')}${STEPS[i]}`; }
      });
    }, 160);
  }

  /* ---------- Yan menü, sekmeler, panel, oynatıcı ---------- */
  const NAV = [['home', 'house', 'Ana sayfa'], ['search', 'search', 'Ara'], ['library', 'library', 'Kitaplığın'], ['jam', 'users', 'Jam']];
  function renderChrome() {
    const r = state.route.name;
    $('#side-nav').innerHTML = NAV.map(([k, ic, label]) => `<a class="nav-item" href="#${k}" ${r === k ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('');
    $('#side-playlists').innerHTML = D.playlists.map((p) => `<li><a class="side-item" href="#playlist/${p.id}" ${r === 'playlist' && state.route.id === p.id ? 'aria-current="page"' : ''}>${art(p)}<span class="text-stack"><span class="title-line">${esc(p.title)}</span><span class="meta-line">Çalma listesi · ${p.songIds.length} şarkı</span></span></a></li>`).join('');
    $('#tabbar').innerHTML = [['home', 'house', 'Ana sayfa'], ['search', 'search', 'Ara'], ['library', 'library', 'Kitaplık'], ['profile', 'user', 'Profil']]
      .map(([k, ic, label]) => `<a href="#${k}" ${r === k ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('');
  }

  function renderPanel() {
    const s = song(state.songId);
    const tab = state.panelTab;
    $('#panel').innerHTML = `<div class="panel-tabs tabs" role="tablist" aria-label="Panel">
        <button class="tab" role="tab" type="button" id="ptab-queue" aria-controls="ppanel" aria-selected="${tab === 'queue'}" data-panel-tab="queue">Sıradaki</button>
        <button class="tab" role="tab" type="button" id="ptab-friends" aria-controls="ppanel" aria-selected="${tab === 'friends'}" data-panel-tab="friends">Arkadaşlar</button></div>
      <div id="ppanel" role="tabpanel" aria-labelledby="ptab-${tab}" style="display:flex;flex-direction:column;gap:var(--space-5)">${tab === 'queue'
        ? `<div class="now-card">${songArt(s)}<div class="np-meta"><span class="text-stack"><span class="title-line">${esc(s.title)}</span><span class="meta-line">${artistLink(s)}</span></span>${likeBtn(s.id)}</div></div>
          <h2>Sıradaki</h2><ul class="mini-list">${state.queue.map((id) => { const q = song(id); return `<li><button class="mini-row" type="button" style="width:100%;text-align:start" data-play-song="${id}" data-ctx="${state.context}">${songArt(q)}<span class="text-stack"><span class="title-line">${esc(q.title)}</span><span class="meta-line">${esc(artist(q.artistId).name)}</span></span></button></li>`; }).join('')}</ul>`
        : `<ul class="mini-list">${D.friends.map((f) => { const fs = song(f.songId); return `<li class="mini-row"><span class="avatar" aria-hidden="true">${f.initials}</span><span class="text-stack"><span class="title-line">${esc(f.name)}</span><span class="meta-line">${esc(fs.title)} · ${esc(artist(fs.artistId).name)}</span></span><span class="by">${esc(f.ago)}</span></li>`; }).join('')}</ul>`}</div>`;
  }

  function seekMarkup(id) {
    const s = song(state.songId);
    const pct = (state.t / s.duration) * 100;
    return `<div class="seek"><time data-now>${clock(state.t)}</time>
      <input class="slider" id="${id}" data-seekbar type="range" min="0" max="${s.duration}" step="1" value="${state.t}" style="--val:${pct}%" aria-label="Şarkıda konum" aria-valuetext="${clock(state.t)} / ${clock(s.duration)}">
      <time>${clock(s.duration)}</time></div>`;
  }
  const repeatIcon = () => (state.repeat === 2 ? 'repeat-1' : 'repeat');
  const repeatLabel = () => ['Tekrarlama kapalı', 'Listeyi tekrarla', 'Şarkıyı tekrarla'][state.repeat];

  function renderPlayer() {
    const s = song(state.songId);
    const volPct = state.muted ? 0 : state.volume;
    $('#player').innerHTML = `<div class="player-now">
        <button class="cover-btn" type="button" data-action="open-np" aria-label="Şimdi çalıyor ekranını aç: ${esc(s.title)}">${songArt(s)}</button>
        <span class="text-stack"><span class="title-line">${esc(s.title)}</span><span class="meta-line">${artistLink(s)}</span></span>${likeBtn(s.id)}</div>
      <div class="player-center"><div class="controls">
        <button class="icon-btn sm" type="button" data-action="shuffle" aria-pressed="${state.shuffle}" aria-label="Karışık çal">${icon('shuffle')}</button>
        <button class="icon-btn" type="button" data-action="prev" aria-label="Önceki şarkı">${icon('skip-back', 'icon-fill')}</button>
        <button class="play-btn sm" type="button" data-action="toggle-play" aria-label="${state.playing ? 'Duraklat' : 'Çal'}">${playIcon(state.playing)}</button>
        <button class="icon-btn" type="button" data-action="next" aria-label="Sonraki şarkı">${icon('skip-forward', 'icon-fill')}</button>
        <button class="icon-btn sm" type="button" data-action="repeat" aria-pressed="${state.repeat > 0}" aria-label="${repeatLabel()}">${icon(repeatIcon())}</button>
      </div>${seekMarkup('seek-bar')}</div>
      <div class="player-end">
        <button class="icon-btn sm" type="button" data-action="open-lyrics" aria-label="Şarkı sözleri">${icon('mic-vocal')}</button>
        <button class="icon-btn sm" type="button" data-action="open-queue" aria-label="Sıradaki şarkılar">${icon('list-music')}</button>
        <a class="icon-btn sm" href="#jam" aria-label="Jam">${icon('users')}</a>
        <button class="icon-btn sm" type="button" data-action="mute" aria-pressed="${state.muted}" aria-label="Sesi kapat">${icon(state.muted ? 'volume-x' : 'volume-2')}</button>
        <input class="slider volume" type="range" min="0" max="100" step="1" value="${volPct}" style="--val:${volPct}%" data-volume aria-label="Ses düzeyi" aria-valuetext="%${volPct}">
        <button class="icon-btn sm" type="button" data-action="toast" data-msg="Mini oynatıcı her zaman üstte duran küçük pencerede açılır" aria-label="Mini oynatıcı">${icon('picture-in-picture-2')}</button>
      </div>`;
    $('#mini').innerHTML = `<button class="mini-open" type="button" data-action="open-np" aria-label="Şimdi çalıyor ekranını aç: ${esc(s.title)}, ${esc(artist(s.artistId).name)}"></button>
      ${songArt(s)}<span class="text-stack"><span class="title-line">${esc(s.title)}</span><span class="meta-line">${esc(artist(s.artistId).name)}</span></span>
      ${likeBtn(s.id)}<button class="icon-btn" type="button" data-action="toggle-play" aria-label="${state.playing ? 'Duraklat' : 'Çal'}">${playIcon(state.playing)}</button>
      <div class="mini-progress" aria-hidden="true"><div style="--val:${(state.t / s.duration) * 100}%"></div></div>`;
  }

  /** Her saniye: yalnızca ilerleme, zaman ve aktif söz satırı güncellenir (odak korunur). */
  function updateProgress() {
    const s = song(state.songId);
    const pct = (state.t / s.duration) * 100;
    $$('[data-seekbar]').forEach((el) => {
      if (document.activeElement !== el) el.value = state.t;
      el.style.setProperty('--val', `${pct}%`);
      el.setAttribute('aria-valuetext', `${clock(state.t)} / ${clock(s.duration)}`);
    });
    $$('[data-now]').forEach((el) => (el.textContent = clock(state.t)));
    const mini = $('.mini-progress > div');
    if (mini) mini.style.setProperty('--val', `${pct}%`);
    const lines = D.lyrics[state.songId];
    if (lines && state.npOpen && state.npTab === 'lyrics') {
      let idx = 0;
      lines.forEach(([at], i) => { if (state.t >= at) idx = i; });
      $$('.lyric').forEach((el, i) => {
        const cur = i === idx;
        if ((el.getAttribute('aria-current') === 'true') !== cur) {
          if (cur) {
            el.setAttribute('aria-current', 'true');
            const box = el.parentElement;
            box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: motionOk() ? 'smooth' : 'auto' });
          }
          else el.removeAttribute('aria-current');
        }
      });
    }
  }

  function refreshTracks() {
    $$('.track').forEach((row) => {
      const cur = row.dataset.id === state.songId;
      if (cur) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
      const s = song(row.dataset.id);
      const num = $('.num', row);
      const idx = [...row.parentElement.children].indexOf(row) + 1;
      num.innerHTML = cur && state.playing ? icon('audio-lines') : String(idx);
      const btn = $('.play-mini', row);
      btn.innerHTML = playIcon(cur && state.playing);
      btn.setAttribute('aria-label', `${cur && state.playing ? 'Duraklat' : 'Çal'}: ${s.title}`);
    });
    $$('[data-play-ctx]').forEach((btn) => {
      const on = isCurrentContext(btn.dataset.playCtx);
      btn.innerHTML = playIcon(on);
    });
    $$('[data-action="toggle-play"]').forEach((btn) => {
      btn.innerHTML = playIcon(state.playing);
      btn.setAttribute('aria-label', state.playing ? 'Duraklat' : 'Çal');
    });
    const np = $('.np');
    if (np) np.dataset.playing = String(state.playing);
  }

  /* ---------- Oynatma ---------- */
  function play(id, ctx) {
    const changed = id !== state.songId;
    if (ctx && ctx !== state.context) {
      state.context = ctx;
      const ids = contextSongs(ctx);
      state.queue = ids.slice(ids.indexOf(id) + 1).concat(ids.slice(0, ids.indexOf(id)));
    }
    if (changed) {
      state.history.push(state.songId);
      state.queue = state.queue.filter((q) => q !== id);
      state.songId = id;
      state.t = 0;
    }
    state.playing = true;
    applyAmbient();
    renderPlayer();
    renderPanel();
    refreshTracks();
    if (state.npOpen) renderNp();
    if (changed) { const s = song(id); announce(`Çalınıyor: ${s.title}, ${artist(s.artistId).name}`); }
  }
  function togglePlay() {
    state.playing = !state.playing;
    refreshTracks();
    announce(state.playing ? 'Çalıyor' : 'Duraklatıldı');
  }
  function next() {
    if (state.repeat === 2) { state.t = 0; updateProgress(); return; }
    const pool = state.queue.length ? state.queue : contextSongs(state.context).filter((id) => id !== state.songId);
    const nextId = state.shuffle ? pool[Math.floor(Math.random() * pool.length)] : pool[0];
    state.queue = state.queue.filter((q) => q !== nextId);
    if (state.repeat === 1) state.queue.push(state.songId);
    play(nextId);
  }
  function prev() {
    if (state.t > 3 || !state.history.length) { state.t = 0; updateProgress(); return; }
    const id = state.history.pop();
    state.queue.unshift(state.songId);
    state.songId = id; state.t = 0;
    play(id);
    state.history.pop();
  }
  setInterval(() => {
    if (!state.playing) return;
    state.t += 1;
    if (state.t >= song(state.songId).duration) next();
    else updateProgress();
  }, 1000);

  /* ---------- Diyaloglar: odak tuzağı, Escape, odağın geri dönmesi ---------- */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  function openLayer(html, onClose) {
    state.lastFocus = document.activeElement;
    const layer = $('#overlay');
    layer.innerHTML = html;
    ['#app', '#mobile-dock', '#site'].forEach((sel) => $(sel).setAttribute('inert', ''));
    const dialog = layer.firstElementChild;
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = $$(FOCUSABLE, dialog).filter((el) => el.offsetParent !== null && !el.closest('[inert]'));
      if (!items.length) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    ($('[data-autofocus]', dialog) || $(FOCUSABLE, dialog)).focus();
  }
  function closeLayer() {
    $('#overlay').innerHTML = '';
    ['#app', '#mobile-dock', '#site'].forEach((sel) => $(sel).removeAttribute('inert'));
    if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
  }

  function npBody() {
    const lines = D.lyrics[state.songId];
    if (state.npTab === 'lyrics') {
      return lines
        ? `<div class="lyrics">${lines.map(([at, text]) => `<button class="lyric" type="button" data-seek="${at}">${esc(text)}</button>`).join('')}</div>`
        : `<div class="empty glass-panel"><h2>Bu şarkının sözleri henüz yok</h2><p>Sözler eklenince burada şarkıyla birlikte akar. Gündüz Düşleri'ni çalarak dene.</p><button class="btn btn-secondary" type="button" data-play-song="s1" data-ctx="al1">Gündüz Düşleri'ni çal</button></div>`;
    }
    return `<ul class="mini-list">${state.queue.map((id) => { const q = song(id); return `<li><button class="mini-row" type="button" style="width:100%;text-align:start" data-play-song="${id}">${songArt(q)}<span class="text-stack"><span class="title-line">${esc(q.title)}</span><span class="meta-line">${esc(artist(q.artistId).name)}</span></span></button></li>`; }).join('')}</ul>`;
  }
  function npMarkup() {
    const s = song(state.songId);
    return `<div class="np" role="dialog" aria-modal="true" aria-labelledby="np-title" data-playing="${state.playing}">
      <div class="ambient" aria-hidden="true"></div>
      <div class="np-top"><button class="icon-btn" type="button" data-action="close-np" aria-label="Şimdi çalıyor ekranını kapat" data-autofocus>${icon('chevron-down', 'icon-md')}</button>
        <p>${esc(contextName(state.context))}</p>
        <button class="icon-btn" type="button" data-action="toast" data-msg="Bağlantı kopyalandı" aria-label="Paylaş">${icon('share-2')}</button></div>
      <div class="np-inner">
        <div class="np-art">${songArt(s)}
          <div class="np-meta"><span class="text-stack"><h2 id="np-title">${esc(s.title)}</h2><p>${artistLink(s)}</p></span>${likeBtn(s.id, false)}</div>
          ${seekMarkup('np-seek')}
          <div class="np-controls">
            <button class="icon-btn" type="button" data-action="shuffle" aria-pressed="${state.shuffle}" aria-label="Karışık çal">${icon('shuffle')}</button>
            <button class="icon-btn" type="button" data-action="prev" aria-label="Önceki şarkı">${icon('skip-back', 'icon-md icon-fill')}</button>
            <button class="play-btn xl" type="button" data-action="toggle-play" aria-label="${state.playing ? 'Duraklat' : 'Çal'}">${playIcon(state.playing)}</button>
            <button class="icon-btn" type="button" data-action="next" aria-label="Sonraki şarkı">${icon('skip-forward', 'icon-md icon-fill')}</button>
            <button class="icon-btn" type="button" data-action="repeat" aria-pressed="${state.repeat > 0}" aria-label="${repeatLabel()}">${icon(repeatIcon())}</button></div></div>
        <div class="np-side"><div class="tabs" role="tablist" aria-label="Şimdi çalıyor">
          <button class="tab" role="tab" type="button" id="nptab-lyrics" aria-controls="np-panel" aria-selected="${state.npTab === 'lyrics'}" data-np-tab="lyrics">Şarkı sözü</button>
          <button class="tab" role="tab" type="button" id="nptab-queue" aria-controls="np-panel" aria-selected="${state.npTab === 'queue'}" data-np-tab="queue">Sıradaki</button></div>
          <div id="np-panel" role="tabpanel" aria-labelledby="nptab-${state.npTab}">${npBody()}</div></div>
      </div></div>`;
  }
  function renderNp() {
    const np = $('.np');
    if (!np) return;
    const focusedId = document.activeElement && document.activeElement.closest('.np') ? document.activeElement.dataset.action || document.activeElement.dataset.npTab : null;
    np.outerHTML = npMarkup();
    const fresh = $('.np');
    const again = focusedId && ($(`[data-action="${focusedId}"]`, fresh) || $(`[data-np-tab="${focusedId}"]`, fresh));
    (again || $('[data-autofocus]', fresh)).focus();
    updateProgress();
  }
  function openNp(tab) {
    if (tab) state.npTab = tab;
    state.npOpen = true;
    openLayer(npMarkup(), closeNp);
    updateProgress();
  }
  function closeNp() { state.npOpen = false; closeLayer(); }

  function confirmDialog({ title, body, action, onConfirm }) {
    openLayer(`<div class="wrapped" role="alertdialog" aria-modal="true" aria-labelledby="cf-title" aria-describedby="cf-body">
      <div class="glass-chrome" style="display:flex;flex-direction:column;gap:var(--space-4);padding:var(--space-6);border-radius:var(--radius-xl);max-width:calc(var(--size-layout-panel) * 1.4)">
        <h2 class="section-title" id="cf-title">${esc(title)}</h2><p id="cf-body" class="meta-line" style="white-space:normal">${esc(body)}</p>
        <div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" type="button" data-action="cf-cancel" data-autofocus>Vazgeç</button><button class="btn btn-destructive" type="button" data-action="cf-ok">${esc(action)}</button></div></div></div>`, closeLayer);
    confirmDialog.onConfirm = onConfirm;
  }

  /* ---------- Wrapped ---------- */
  function storyMarkup() {
    const W = D.wrapped;
    const top = song(W.topSongId);
    const ta = artist(W.topArtistId);
    const stories = [
      { cls: '', body: `<p>${W.year}</p><p class="story-big">Yılın seninle nasıl geçti?</p>` },
      { cls: 'inverse', body: `<p class="story-big">${W.minutes}</p><p>dakika müzik dinledin. Bu yaklaşık 33 gün eder.</p>` },
      { cls: '', body: `${songArt(top)}<h2>${esc(top.title)}</h2><p>Yılın şarkısı. Tam 312 kez çaldın.</p>` },
      { cls: 'inverse', body: `${artistArt(ta)}<h2>${esc(ta.name)}</h2><p>En çok dinlediğin sanatçı. Dinleyicilerinin ilk yüzde 2'sindesin.</p>` },
      { cls: '', body: `<p>Dinleme kişiliğin</p><p class="story-big">${esc(W.persona)}</p><p>${esc(W.personaNote)}</p>` },
    ];
    const i = state.wrappedIndex;
    const st = stories[i];
    return `<div class="wrapped" role="dialog" aria-modal="true" aria-label="Wrapped ${W.year}, ${i + 1}. hikâye / ${stories.length}">
      <article class="story ${st.cls}">
        <div class="story-bars" aria-hidden="true">${stories.map((_, k) => `<span data-done="${k <= i}"></span>`).join('')}</div>
        <div class="story-top"><span class="label">Wrapped ${W.year}</span><button class="icon-btn" type="button" data-action="close-wrapped" aria-label="Wrapped'i kapat">${icon('x')}</button></div>
        <div class="story-body" aria-live="polite">${st.body}</div>
        <div class="story-nav"><button class="btn btn-ghost" type="button" data-action="story-prev" ${i === 0 ? 'disabled' : ''}>${icon('arrow-left')}Önceki</button>
          ${i < stories.length - 1 ? `<button class="btn btn-ghost" type="button" data-action="story-next" data-autofocus>Sonraki${icon('chevron-right')}</button>`
            : `<button class="btn btn-ghost" type="button" data-action="toast" data-msg="Özet görseli kaydedildi" data-autofocus>${icon('share-2')}Paylaş</button>`}</div>
      </article></div>`;
  }
  function renderStory() {
    const layer = $('#overlay');
    const keep = document.activeElement && document.activeElement.dataset.action;
    layer.innerHTML = storyMarkup();
    const target = (keep && $(`[data-action="${keep}"]:not([disabled])`, layer)) || $('[data-autofocus]', layer);
    target.focus();
  }
  function openWrapped() {
    state.wrappedIndex = 0;
    openLayer(storyMarkup(), closeWrapped);
    $('#overlay').addEventListener('keydown', storyKeys);
  }
  function storyKeys(e) {
    if (e.key === 'ArrowRight' && state.wrappedIndex < 4) { state.wrappedIndex++; renderStory(); }
    if (e.key === 'ArrowLeft' && state.wrappedIndex > 0) { state.wrappedIndex--; renderStory(); }
  }
  function closeWrapped() {
    $('#overlay').removeEventListener('keydown', storyKeys);
    closeLayer();
    if (location.hash === '#wrapped') history.replaceState(null, '', '#home');
  }

  /* ---------- Yönlendirme ---------- */
  function parseRoute() {
    const [name, id] = location.hash.replace(/^#/, '').split('/');
    return { name: views[name] || name === 'wrapped' ? name : 'home', id };
  }
  function render() {
    const route = parseRoute();
    if (route.name === 'wrapped') {
      if (!state.route) { state.route = { name: 'home' }; renderView(); }
      openWrapped();
      return;
    }
    if ($('.wrapped, .np')) { state.npOpen = false; closeLayer(); }
    state.route = route;
    renderView();
  }
  function renderView() {
    const route = state.route;
    const site = route.name === 'landing' || route.name === 'admin';
    $('#app').hidden = site;
    $('#mobile-dock').hidden = site;
    $('#site').hidden = !site;
    const { title, html } = views[route.name](route.id);
    document.title = `${title} · Bekofy prototip`;
    if (site) {
      $('#site').innerHTML = html;
    } else {
      $('#view').innerHTML = html;
      $('#mobile-title').textContent = title;
      renderChrome();
      $('#main').scrollTop = 0;
    }
    const anchor = site && route.id && document.getElementById(route.id);
    if (anchor) {
      anchor.setAttribute('tabindex', '-1');
      anchor.focus({ preventScroll: true });
      anchor.scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto' });
    } else if (!state.firstRender) {
      (site ? $('#site-main') : $('#view')).focus({ preventScroll: true });
      if (site) window.scrollTo(0, 0);
    }
    state.firstRender = false;
  }

  /* ---------- Olaylar ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, a');
    if (!el) return;
    const d = el.dataset;
    if (d.playSong) { e.preventDefault(); if (d.playSong === state.songId) togglePlay(); else play(d.playSong, d.ctx || state.context); return; }
    if (d.playCtx) {
      if (state.context === d.playCtx) togglePlay();
      else { const ids = contextSongs(d.playCtx); play(state.shuffle ? ids[Math.floor(Math.random() * ids.length)] : ids[0], d.playCtx); }
      return;
    }
    if (d.like) {
      const on = !state.liked.has(d.like);
      if (on) state.liked.add(d.like); else state.liked.delete(d.like);
      $$(`[data-like="${d.like}"]`).forEach((b) => b.setAttribute('aria-pressed', on));
      toast(on ? 'Beğenilen şarkılara eklendi' : 'Beğenilen şarkılardan çıkarıldı');
      return;
    }
    if (d.save) {
      const on = !state.saved.has(d.save);
      if (on) state.saved.add(d.save); else state.saved.delete(d.save);
      el.setAttribute('aria-pressed', on);
      el.innerHTML = icon(on ? 'circle-check' : 'plus');
      toast(on ? 'Kitaplığına eklendi' : 'Kitaplığından çıkarıldı');
      return;
    }
    if (d.follow) {
      const on = !state.following.has(d.follow);
      if (on) state.following.add(d.follow); else state.following.delete(d.follow);
      el.setAttribute('aria-pressed', on);
      el.textContent = on ? 'Takip ediliyor' : 'Takip et';
      return;
    }
    if (d.filter) { state.libraryFilter = d.filter; renderView(); $(`[data-filter="${d.filter}"]`).focus(); return; }
    if (d.panelTab) { state.panelTab = d.panelTab; renderPanel(); $(`[data-panel-tab="${d.panelTab}"]`).focus(); return; }
    if (d.npTab) { state.npTab = d.npTab; renderNp(); return; }
    if (d.seek) { state.t = Number(d.seek); updateProgress(); return; }
    if (d.switch) {
      const on = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', on);
      if (d.switch === 'coverColor') { state.coverColor = on; applyAmbient(); }
      else state.switches[d.switch] = on;
      return;
    }
    switch (d.action) {
      case 'toggle-play': togglePlay(); break;
      case 'next': next(); break;
      case 'prev': prev(); break;
      case 'shuffle':
        state.shuffle = !state.shuffle;
        $$('[data-action="shuffle"]').forEach((b) => b.setAttribute('aria-pressed', state.shuffle));
        toast(state.shuffle ? 'Karışık çalma açık' : 'Karışık çalma kapalı');
        break;
      case 'repeat':
        state.repeat = (state.repeat + 1) % 3;
        $$('[data-action="repeat"]').forEach((b) => { b.setAttribute('aria-pressed', state.repeat > 0); b.setAttribute('aria-label', repeatLabel()); b.innerHTML = icon(repeatIcon()); });
        toast(repeatLabel());
        break;
      case 'mute': state.muted = !state.muted; renderPlayer(); $('[data-action="mute"]').focus(); break;
      case 'open-np': openNp(); break;
      case 'open-lyrics': openNp('lyrics'); break;
      case 'open-queue':
        if (window.matchMedia('(min-width: 1280px)').matches) { state.panelTab = 'queue'; renderPanel(); $('[data-panel-tab="queue"]').focus(); } // ds-allow-hardcode: kırılım noktası
        else openNp('queue');
        break;
      case 'close-np': closeNp(); break;
      case 'close-wrapped': closeWrapped(); break;
      case 'story-next': state.wrappedIndex++; renderStory(); break;
      case 'story-prev': state.wrappedIndex--; renderStory(); break;
      case 'toast': toast(d.msg); break;
      case 'back': history.back(); break;
      case 'forward': history.forward(); break;
      case 'go-search': location.hash = '#search'; break;
      case 'confirm-delete':
        confirmDialog({ title: 'Hesabın silinsin mi?', body: 'Çalma listelerin, beğenilerin ve dinleme geçmişin kalıcı olarak silinir. Bu işlem geri alınamaz.', action: 'Hesabı sil', onConfirm: () => toast('Prototipte hesap silinmez') });
        break;
      case 'confirm-jam':
        confirmDialog({ title: 'Jam bitirilsin mi?', body: 'Katılımcılar oturumdan çıkarılır, ortak sıra temizlenir.', action: "Jam'i bitir", onConfirm: () => toast('Jam bitirildi') });
        break;
      case 'cf-cancel': closeLayer(); break;
      case 'cf-ok': closeLayer(); confirmDialog.onConfirm(); break;
      case 'imp-example': state.imp.url = D.youtubePreview.url; state.imp.error = ''; renderImport(); $('#yt-url').focus(); break;
      case 'imp-reset': Object.assign(state.imp, { phase: 'idle', url: '', error: '' }); renderImport(); $('#yt-url').focus(); break;
      case 'imp-toggle-online': state.imp.online = !state.imp.online; renderImport(); break;
      case 'imp-retry': state.imp.online = true; renderImport(); toast('Yerel sunucuya bağlanıldı'); break;
      default: break;
    }
  });

  document.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.track');
    if (row && !e.target.closest('button, a')) play(row.dataset.id, row.dataset.ctx);
  });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    e.preventDefault();
    const action = form.dataset.action;
    if (action === 'search-submit') { if (location.hash !== '#search') location.hash = '#search'; return; }
    if (action === 'imp-fetch') {
      const url = $('#yt-url').value.trim();
      state.imp.url = url;
      if (!url) state.imp.error = 'Bir YouTube bağlantısı yapıştır.';
      else if (!YT_RE.test(url)) state.imp.error = 'Bu bir YouTube video bağlantısı değil. Bağlantı youtube.com/watch, youtu.be veya Shorts ile başlamalı.';
      else state.imp.error = '';
      if (state.imp.error) { renderImport(); $('#yt-url').focus(); return; }
      state.imp.phase = 'fetching';
      renderImport();
      setTimeout(() => { state.imp.phase = 'preview'; renderImport(); $('#f-title').focus(); announce('Bilgiler getirildi. Kontrol edip ekleyebilirsin.'); }, 900);
      return;
    }
    if (action === 'imp-start') {
      const labels = { 'f-title': 'Şarkı adı gerekli.', 'f-artist': 'Sanatçı adı gerekli.' };
      const missing = Object.keys(labels).filter((id) => !$(`#${id}`).value.trim());
      missing.forEach((id) => {
        const input = $(`#${id}`);
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', `err-${id}`);
        if (!$(`#err-${id}`)) input.insertAdjacentHTML('afterend', `<span class="error" id="err-${id}">${icon('triangle-alert')}${labels[id]}</span>`);
      });
      if (missing.length) { $(`#${missing[0]}`).focus(); return; }
      runImport();
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches('[data-seekbar]')) { state.t = Number(el.value); updateProgress(); }
    if (el.matches('[data-volume]')) { state.volume = Number(el.value); state.muted = false; el.style.setProperty('--val', `${el.value}%`); el.setAttribute('aria-valuetext', `%${el.value}`); }
    if (el.id === 'crossfade') { el.style.setProperty('--val', `${(el.value / 12) * 100}%`); $('#crossfade-out').textContent = `${el.value} sn`; }
    if (el.id === 'top-search' || el.id === 'page-search') {
      state.searchQuery = el.value;
      if (state.route.name !== 'search') location.hash = '#search';
      else $('#search-results').innerHTML = searchResults();
    }
    if (el.id === 'yt-url' && state.imp.error) { state.imp.error = ''; el.removeAttribute('aria-invalid'); const err = $('#yt-err'); if (err) err.remove(); }
    if (el.getAttribute('aria-invalid') === 'true' && el.value.trim()) {
      el.removeAttribute('aria-invalid');
      const err = $(`#err-${el.id}`);
      if (err) { err.remove(); el.removeAttribute('aria-describedby'); }
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.name === 'theme') setTheme(e.target.value);
  });

  $('#theme-toggle').addEventListener('click', () => {
    const order = ['dark', 'light', 'system'];
    setTheme(order[(order.indexOf(state.theme) + 1) % 3]);
    toast(`Tema: ${THEME_META[state.theme][1]}`);
  });

  /* ---------- Başlat ---------- */
  document.body.insertAdjacentHTML('afterbegin', `<svg aria-hidden="true" style="display:none"><symbol id="bk-mark" viewBox="0 0 100 100"><path d="M25 14.5A6.5 6.5 0 0 1 38 14.5V85.5A6.5 6.5 0 0 1 25 85.5ZM31 48C55 34 84 42 76 64C71 79 50 88 31 92ZM38 60L38 78C48 75 62 70 65 63C68 54 52 50 38 60Z"/></symbol></svg>`);
  setTheme(state.theme);
  renderPlayer();
  renderPanel();
  window.addEventListener('hashchange', render);
  render();
  updateProgress();
})();
