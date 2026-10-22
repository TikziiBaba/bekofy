# Bekofy Yeniden Tasarım Planı

Tarih: 2026-10-22 · Durum: Faz 0 tamamlandı (dal: `redesign`), sırada Faz 1

## Kararlar

| Konu | Karar |
|------|-------|
| Mobil | React Native + Expo, Android + iOS, sıfırdan |
| Masaüstü | Electron kalır; arayüz React + Vite + TypeScript'e taşınır |
| Site | Next.js; tanıtım + indirme, hesap, premium, admin paneli |
| YouTube | Senin bilgisayarında çalışan yerel sunucu; sitedeki admin panelinden link girilir, bilgiler düzenlenip eklenir |
| Görsel yön | Buzlu cam + kapak odaklı dinamik renk |
| Tema | Koyu + açık |
| Marka | İsim Bekofy kalır; yeni logo ve uygulama ikonu |
| Ödeme | PayTR, sonraki faz; o zamana kadar sahte kart formu kaldırılır |
| Özellikler | Hepsi taşınır: sosyal, arkadaş aktivitesi, Jam, şarkı sözü, Wrapped, sanatçı paneli, rozetler, mini oynatıcı, Discord, çoklu hesap, admin terminali |
| Repo | Tek repo (monorepo) |
| Mevcut iş | main'e commit edilir, `redesign` dalında devam edilir, çöp dosyalar silinir |

## Bugünkü durum (incelemede bulunanlar)

- `src/js/app.js` 6.972 satır, `src/pages/app.html` 2.323 satır, `src/css/app.css` 3.960 satır; tüm JS global `<script>` etiketleriyle yükleniyor.
- Aynı kod üç yerde kopya: `src/`, `android/app/src/main/assets/` (Gradle her derlemede kopyalıyor), `website/css` + `website/js`.
- Türkçe karakter bozulması: `app.js`'te 25, `app.html`'de 7, `app.css`'te 2 satır. YouTube yüklemedeki dosya adı regex'i bu yüzden bozuk.
- YouTube yükleme yalnızca masaüstü admin panelinde; ilerleme çubuğu sabit %30; başlık/süre/kapak YouTube'dan alınmıyor; yt-dlp kurulum paketine girmiyor.
- Ödeme sayfası sahte; kart numarasını kendi formunda alıyor.
- Uygulama kimliği uyumsuz: `main.js` → `com.bekir.bekofy`, `electron-builder.yml` → `com.bekofy.app`.

## Hedef yapı

```
bekofy/
├── apps/
│   ├── desktop/     Electron + React + Vite + TS (electron-vite, electron-builder)
│   ├── web/         Next.js (App Router) + Tailwind v4, Vercel
│   ├── mobile/      Expo (Expo Router), Android + iOS
│   └── yt-server/   Node, yerel çalışır: yt-dlp + ffmpeg → R2 → Supabase
├── packages/
│   ├── tokens/      Tasarım token'ları (DTCG JSON) → CSS değişkenleri + TS nesnesi
│   ├── core/        Supabase istemcisi, tipli sorgular, kuyruk mantığı, yardımcılar
│   └── ui/          Web ve masaüstünün ortak React bileşenleri
└── docs/
```

- npm workspaces kullanılır (proje zaten npm ile çalışıyor; ek araç eklenmez).
- Mobil `packages/ui`'yi kullanmaz (React Native DOM değil) ama `tokens` ve `core`'u kullanır.
- Kökteki tasarım sistemi kiti (`tokens/`, `components/`, `scripts/` ...) olduğu gibi kalır. Bekofy'nin kendi token'ları `packages/tokens`'ta bu kitin kurallarıyla üretilir ve aynı kontrollerden geçer.

## Fazlar

Her faz görülebilir ya da test edilebilir bir sonuçla biter. Bir sonraki faza senin onayınla geçilir.

### Faz 0: Hazırlık

1. Mevcut değişiklikler main'e "chore: yeniden tasarım öncesi durum" olarak commit edilir. `android/local.properties` commit'ten çıkarılır ve `.gitignore`'a eklenir (bilgisayarındaki SDK yolunu içeriyor).
2. `redesign` dalı açılır.
3. Silinir: `temp_*.html`, `diff_*.txt*`, `check_css.js`, `check_html.js`, `find_crashes.js`, `src/css/app_original.css`, `src/css/app_original_backup.css`.
4. Monorepo iskeleti: kök `package.json`'a workspaces, boş `apps/*` ve `packages/*`.
5. Eski uygulama (`src/`, `main.js`, `preload.js`, `android/`, `website/`) yeni sürümler hazır olana kadar yerinde kalır ve referans olarak kullanılır.

Doğrulama: kökte `npm install` hatasız; eski uygulama `npm run start:electron` ile hâlâ açılıyor.

### Faz 1: Marka ve tasarım sistemi

1. Yeni logo: SVG, 16px'te okunurluk, tek renk ve koyu/açık zemin testleri. Çıktılar: Windows `.ico`, Android adaptive icon, iOS ikonu, favicon.
2. Token'lar (`packages/tokens`): OKLCH renk primitive'leri, koyu + açık semantik katman, cam yüzeyleri (blur, saydamlık, kenar ışığı), tipografi, boşluk, köşe, gölge, hareket.
3. Dinamik renk kuralı: kapaktan baskın renk çıkarılır, OKLCH'de açıklığı sınırlanır; metin kontrastı iki temada da 4.5:1'in altına düşmez. Kapak yoksa marka rengi kullanılır.
4. Erişilebilirlik: `prefers-reduced-transparency` ve `prefers-reduced-motion` açıkken cam yerine düz yüzey ve sade geçiş. Cam üzerindeki metnin altında her zaman yeterli kontrast veren bir katman olur.
5. Etkileşimli HTML prototip: Ana sayfa, Arama, Kitaplık, Çalma listesi/Albüm, Sanatçı, Şimdi çalıyor, Şarkı sözü, Kuyruk, Profil, Ayarlar, Jam, Wrapped, Admin → YouTube içe aktarma ve tanıtım sayfası; masaüstü + mobil genişlikte, koyu + açık.

Doğrulama: `node scripts/accuracy_report.mjs` (token, kontrast, durumlar, emoji yok), `node scripts/verify_responsive.mjs` (280/320/414px). Ardından senin görsel onayın; kod bu prototipe göre yazılır.

### Faz 2: Ortak çekirdek (`packages/core`)

1. Supabase istemci fabrikası; oturum depolama platforma göre (tarayıcı, Electron, mobilde SecureStore).
2. `supabase gen types` ile tablo tipleri; mevcut 27 tablonun sorguları tek yerde (songs, playlists, profiles, friendships, jam_sessions ...).
3. Oynatıcı mantığı saf TypeScript: kuyruk, karıştırma, tekrar, sonraki/önceki; platformdan bağımsız ve testli.
4. Türkçe güvenli `slugify` (ç ğ ı İ ö ş ü → dosya adı); bugünkü bozuk regex'in yerine geçer.

Doğrulama: birim testleri geçiyor, tip kontrolü hatasız.

### Faz 3: YouTube içe aktarma (yerel sunucu)

```
Site admin paneli ──(Supabase oturumu)──> http://localhost:4317  (senin bilgisayarın)
  1. POST /preview {url}  → yt-dlp bilgileri: başlık, kanal, süre, kapak
  2. Panelde düzenleme: başlık, sanatçı, albüm, kapak (değiştir / kırp)
  3. POST /import         → indir → ffmpeg ile MP3 → R2'ye ses + kapak
                           → songs tablosuna kayıt; gerçek ilerleme yüzdesi canlı (SSE)
```

- Güvenlik: sunucu yalnızca `127.0.0.1`'i dinler; CORS yalnızca senin alan adın ve localhost; her istekte Supabase oturumu doğrulanır, rol `admin` değilse 403 döner.
- R2 ve Supabase anahtarları yalnızca senin bilgisayarındaki `apps/yt-server/.env` dosyasında durur.
- Başlatma: `npm run yt-server`. Sunucu kapalıysa panel bunu ve nasıl başlatılacağını gösterir.
- Chrome, siteden localhost'a ilk bağlantıda "yerel ağ erişimi" izni sorar; bir kez onay yeterli.
- yt-dlp sık güncellenir; `npm run yt-server:update` ile güncellenir. YouTube için yt-dlp'nin bir JavaScript çalışma zamanına (Deno) ihtiyacı olabilir; kurulumda kontrol edilir.
- Desteklenen linkler: `youtube.com/watch`, `youtu.be`, `shorts`, `music.youtube.com`. Çalma listesi linkleri ilk sürümde yok.

Doğrulama: gerçek bir linkle uçtan uca test (dosya R2'de, kayıt songs tablosunda, şarkı uygulamada çalıyor); admin olmayan oturum 403 alıyor; Türkçe karakterli başlık doğru dosya adına dönüşüyor.

### Faz 4: Site (`apps/web`, Next.js)

- Tanıtım + indirme: Windows kurulum dosyası GitHub Releases'tan, Android uygulaması, iOS daha sonra.
- Hesap: giriş, kayıt, şifre sıfırlama, profil.
- Premium: plan sayfası; ödeme sayfası PayTR'ye hazır iskelet olarak (kart formu yok).
- Admin paneli: şarkılar (ekle / düzenle / sil, YouTube içe aktarma), kullanıcılar, premium talepleri, sanatçı başvuruları, rozetler, istatistikler.
- SEO: meta etiketleri, Open Graph, sitemap.

Doğrulama: accuracy_report, axe, responsive, koyu + açık; Lighthouse; Vercel önizleme dağıtımı.
Senden gereken: Vercel projesini bu repoya, kök klasörü `apps/web` olacak şekilde bağlamak (alan adı aynı kalır).

### Faz 5: Masaüstü (`apps/desktop`)

- electron-vite + React + TS; electron-builder ve GitHub üzerinden otomatik güncelleme korunur.
- `main.js` modüllere bölünür: pencereler, IPC, çevrimdışı indirme, Discord, güncelleyici, mini oynatıcı. Preload tipli ve dar bir API sunar.
- Tüm özellikler yeni tasarımla: özel başlık çubuğu, mini oynatıcı, Discord durumu, çoklu hesap, admin terminali.
- Uygulama kimliği uyumsuzluğu giderilir.

Doğrulama: her ekran için durum + kontrast kontrolleri; elle kontrol listesi (çal, ara, liste oluştur, indir, çevrimdışı çal, mini oynatıcı, güncelleme); Windows kurulum dosyası üretiliyor.

### Faz 6: Mobil (`apps/mobile`, Expo)

- Expo Router; sekmeler: Ana sayfa, Ara, Kitaplık; aşağıdan açılan Şimdi çalıyor ekranı.
- Arka planda çalma + kilit ekranı ve bildirim kontrolleri. Kütüphane (expo-audio ya da react-native-track-player) fazın başında küçük bir prototiple seçilir.
- Çevrimdışı indirme, sosyal, Jam (Supabase Realtime), şarkı sözü, Wrapped, profil, sanatçı sayfası.
- EAS ile Android derlemesi. iOS kodu hazır olur; App Store için Apple Developer hesabı (yıllık 99$) gerekir.
- Eski `android/` WebView projesi, yeni uygulama çalıştıktan sonra silinir.

Doğrulama: Android emülatörü ve gerçek cihazda elle test listesi; TalkBack etiketleri; koyu + açık.

### Faz 7: PayTR (sonra)

Next.js sunucu tarafında PayTR iFrame token'ı ve ödeme bildirimi (callback) → profil rolü premium olur. Kart verisi hiçbir zaman bizim sunucumuzdan geçmez.
Senden gereken: PayTR mağaza hesabı (şirket / vergi kaydı).

### Faz 8: Temizlik ve yayın

Eski `src/`, `main.js`, `preload.js`, `downloader.js`, `r2-uploader.js`, `android/` ve `website` bağlantısı silinir; README güncellenir; CI (lint + tip + test + tasarım kontrolleri); sürüm 2.0.0.

## Varsayımlar (yanlışsa söyle)

1. Admin paneli yalnızca sitede olur; masaüstünde admin terminali ve "Admin panelini aç" bağlantısı kalır. Böylece aynı panel iki kez yazılmaz.
2. Supabase veritabanı aynı kalır; tablo yapısı yalnızca gerekirse migration ile değişir ve her migration'ın geri alma adımı yazılır.
3. Android paket adı `com.bekir.bekofy` korunur; eski uygulama aynı imza anahtarıyla imzalanmışsa yeni sürüm üzerine güncelleme olarak kurulur.
4. Ses formatı MP3 kalır (tüm platformlarda sorunsuz çalışır).
5. Uygulama dili Türkçe; çoklu dil ilk sürümde yok.

## Riskler

- YouTube'dan ses indirmek YouTube kullanım koşullarına aykırıdır ve telifli içerik riski taşır; sorumluluk platform sahibindedir.
- yt-dlp, YouTube değişikliklerinde bozulabilir; güncelleme komutu bu yüzden var.
- Proje büyük: üç uygulama ve bir sunucu. Fazlar sırayla, her biri ayrı onayla ilerler.
- Cam efektleri düşük donanımlı Android cihazlarda yavaşlayabilir; mobilde blur yerine yarı saydam düz yüzeye geçen bir yedek olur.

## Sıra ve paralellik

Faz 0 → 1 → 2 sırayla yapılır, çünkü her şey bunlara bağlı. Sonrasında Faz 3 (yt-server), 4 (site), 5 (masaüstü) ve 6 (mobil) ayrı oturumlarda paralel yürüyebilir; her biri kendi `apps/*` klasörüne dokunur.
