# Bekofy Yeniden Tasarım Planı

Tarih: 2026-10-25 · Durum: Faz 0-3 tamamlandı; Faz 4 (site) yayında, Faz 6 (mobil) APK'si yayında; Faz 5 (masaüstü) sürümü Supabase ayarını bekliyor (dal: `redesign`); sırada Faz 7/8

## Kararlar

| Konu | Karar |
|------|-------|
| Mobil | React Native + Expo, Android + iOS, sıfırdan |
| Masaüstü | Electron kalır; arayüz React + Vite + TypeScript'e taşınır |
| Site | Next.js; tanıtım + indirme, hesap, premium, admin paneli |
| YouTube | Senin bilgisayarında çalışan yerel sunucu; sitedeki admin panelinden link girilir, bilgiler düzenlenip eklenir |
| Görsel yön | Buzlu cam, siyah zemin, nane yeşili vurgu; çalan şarkının kapağı yalnızca arka plandaki ortam ışığını renklendirir |
| Tema | Varsayılan siyah; açık tema ve sisteme uyma ayarlardan seçilir |
| Marka | İsim Bekofy; Bemol logosu (küçük b = bemol işareti), nane yeşili `#2BD98A`, Bricolage Grotesque (başlık) + Geist (arayüz) |
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
│   ├── brand/       Logo ve platform ikonları (web, Windows, Android, iOS)
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

Sonuç (tamamlandı):

- `packages/brand`: Bemol logosu; siyah karo üstünde nane logo; favicon, PWA, Windows `.ico`, iOS 1024, Android adaptive ve monochrome.
- `packages/tokens`: 320 CSS değişkeni; `deriveAmbient()` kapaktan ortam ışığı türetir, vurgu rengi sabit kalır. `npm test -w @bekofy/tokens`: iki temada tüm kontrast çiftleri, cam bandın altı saf siyah ya da saf beyazken bile AA, 2.592 kapak rengiyle ortam taraması.
- `docs/prototype`: 14 ekran, tıklanabilir. Açmak için `docs/prototype/index.html` dosyasını tarayıcıda aç (ya da `npx serve .` ile `/docs/prototype/`). Veri değişince `node docs/prototype/build.mjs`.
- Denetim: `node docs/prototype/check.mjs`, 27 ekran durumunu iki temada ve iki genişlikte (108 durum) axe, gerçek metin kontrastı ve 280/320/414 piksel taşma için tarar.
- Kitte düzeltilen ölçüm hatası: `scripts/verify_states.mjs` yarı saydam zeminleri opak sayıyordu, `measure_render.mjs` ve `verify_states.mjs` `color(srgb …)` değerlerini yanlış okuyordu.
- Bilinçli bırakılan: `taste_audit` "Senin için" rafındaki 7 eşit kartı orta seviye uyarı olarak işaretliyor; yatay albüm rafı müzik uygulamalarının bilinen kalıbı.

### Faz 2: Ortak çekirdek (`packages/core`)

1. Supabase istemci fabrikası; oturum depolama platforma göre (tarayıcı, Electron, mobilde SecureStore).
2. `supabase gen types` ile tablo tipleri; mevcut 27 tablonun sorguları tek yerde (songs, playlists, profiles, friendships, jam_sessions ...).
3. Oynatıcı mantığı saf TypeScript: kuyruk, karıştırma, tekrar, sonraki/önceki; platformdan bağımsız ve testli.
4. Türkçe güvenli `slugify` (ç ğ ı İ ö ş ü → dosya adı); bugünkü bozuk regex'in yerine geçer.

Doğrulama: birim testleri geçiyor, tip kontrolü hatasız.

Durum (2026-10-23):

- Yapıldı: `packages/core` (TypeScript 6.0.3, Vitest 5.0.3, supabase-js 2.117.2). Tipler canlı şemadan üretilir: `npm run db:types -w @bekofy/core` (kökteki `.env` içinde `SUPABASE_SERVICE_ROLE_KEY` gerekir). Sorgu modülleri: auth, profiles, songs, library, playlists, social, activity, jam, lyrics, badges, media, admin. 75 birim testi; `BEKOFY_LIVE=1` ile 6 canlı salt okuma testi.
- Canlı şemada 19 tablo var. Eski kodun sorguladığı `user_access_logs`, `listening_history`, `listening_sessions`, `premium_requests`, `upload_requests`, `artist_requests`, `playlist_follows`, `albums`, `user_likes` tabloları yok; `playlists.song_ids` sütunu yok. Bu özellikler eski uygulamada sessizce hata veriyordu.
- Veri modeli kararları: tek yönlü takip (`follows`; `friendships`'teki kayıtlar taşınır, eski uygulama kalkana kadar tablo silinmez), şarkılar sanatçılara `song_artists` bağ tablosuyla bağlanır (bir şarkının birden çok sanatçısı olabilir), sanatçı takibi `artist_follows`, yeni tablolar `listening_history`, `artist_requests` (onay `review_artist_request` fonksiyonuyla tek işlemde), `user_access_logs` (bilinçli olarak IP ve konum yok). Premium talebi tablosu eklenmedi; premium Faz 7'de PayTR ile gelir.
- Premium iki yerde tutuluyor (`profiles.role = 'premium'` ve `profiles.is_premium`); şimdilik `isPremium()` ikisine de bakar, Faz 7'de tek alana indirilir.
- Migration uygulandı ve doğrulandı: `friendships`'teki 5 kaydın 4'ü `follows`'a taşındı (atlanan kayıt bir kullanıcının kendini takibiydi, bilinçli dışarıda), `song_artists` 13 bağ (12 şarkının hepsi bağlı), yeni tablolar için sorgu modülleri eklendi (artists, history, artist-requests, access-logs). Canlı testler oturumsuz istemcinin yeni tablolara yazamadığını ve onay fonksiyonunu çağıramadığını doğruluyor. Birim testleri 85, canlı testler 14.
- RLS denetimi yapıldı (2026-10-23). Kritik bulgular: kullanıcı kendi rolünü `admin` yapabiliyordu; Jam tablolarında RLS kapalıydı (canlı testle doğrulandı). Yüksek: `playlist_songs` politikasındaki koşul hatası herhangi bir düzenleyiciye tüm listeleri açıyordu; `avatars` alanında başkasının dosyasının üstüne yazılabiliyordu. Ayrıca gizli listeler herkese açıktı, sanatçı yüklemeleri onaysız yayına giriyordu, `update_user_badge_progress` anon'a açıktı (gövdesi de var olmayan `play_count` sütununu okuduğu için hiç çalışmıyor), `media` depolama alanı hiç yok (eski kodun bu alana yaptığı yüklemeler çalışmıyor).
- Güvenlik migration'ı (`20261023010000_security_hardening.sql`) uygulandı ve doğrulandı: anon canlı testleri 17/17; oturumlu güvenlik testi `npm run test:rls -w @bekofy/core` 27/27 (iki geçici `@bekofy.test` hesabıyla: kendini admin/premium yapamama, askısını kaldıramama, başkasının listesine/avatarına yazamama, sanatçı yüklemesinin `pending` girmesi, Jam ve takip kuralları; test hesapları ve verileri sonunda silinir, bağımsız kontrolle doğrulandı). Her yeni migration'dan sonra bu iki test tekrar çalıştırılır.
- Not: Auth'ta 15 hesap, `profiles`'ta 6 satır var; profili olmayan 9 hesap ilk girişte `ensureProfile` ile tamamlanır.
- Not: R2 anahtarları kökteki `.env`'ye eklendi (2026-10-23); Faz 3'teki yerel içe aktarma sunucusu bunları okur.

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

Durum (2026-10-23):

- Yapıldı: `apps/yt-server` (Node + tsx, framework yok). Kullanım ve API: `apps/yt-server/README.md`. Kurulum `npm run yt-server:setup`: yt-dlp ve ffmpeg/ffprobe yt-dlp ekibinin resmi sürümlerinden indirilir, SHA-256 doğrulanır. YouTube'un JavaScript doğrulamaları için yt-dlp'ye sunucunun kendi Node'u (22+) verilir; Deno gerekmez.
- Sunucuda service role anahtarı yok: şarkı kaydı adminin oturumuyla, RLS altında yapılır. `.env` yalnızca R2 içerir.
- Güvenlik: yalnızca `127.0.0.1`, Host denetimi (DNS rebinding), CORS izin listesi, her istekte Supabase'e sorulan admin doğrulaması, gövde sınırı, tek seferde bir içe aktarma; hata olursa R2 dosyaları ve kayıt geri alınır.
- Bulgu: kökteki `ffmpeg-static` ikili dosyası 831 KB'ta yarım kalmıştı (Windows çalıştırmıyor); eski masaüstündeki YouTube yüklemesi bu yüzden de çalışamıyordu.
- Testler: 35 birim/HTTP/akış testi. Gerçek boru hattı ("Me at the zoo" ile) bilgi, ilerlemeli indirme, MP3 ve kare kapak üretiyor; gerçek sunucuda 403/421/401 davranışları doğrulandı.
- Uçtan uca test `npm run test:e2e -w @bekofy/yt-server` 13/13 (2026-10-23): gerçek sunucu, geçici `@bekofy.test` admin hesabı, gerçek R2 ve veritabanı. "Me at the zoo" 17 sn'de eklendi; Türkçe karakterli ad doğru dosya yoluna dönüştü, kayıt onaylı ve sanatçısına bağlı, ses ve kapak R2'de doğru türle, genel adres `audio/mpeg` ile 200 veriyor, aynı video ikinci kez 409 alıyor. Şarkı, sanatçı, R2 dosyaları ve hesap sonunda silinir; ayrı sorguyla doğrulandı. Şarkının uygulamada çalınması Faz 4/5'teki oynatıcıyla denenecek.

### Faz 4: Site (`apps/web`, Next.js)

- Tanıtım + indirme: Windows kurulum dosyası GitHub Releases'tan, Android uygulaması, iOS daha sonra.
- Hesap: giriş, kayıt, şifre sıfırlama, profil.
- Premium: plan sayfası; ödeme sayfası PayTR'ye hazır iskelet olarak (kart formu yok).
- Admin paneli: şarkılar (ekle / düzenle / sil, YouTube içe aktarma), kullanıcılar, sanatçı başvuruları, giriş kayıtları, istatistikler.
- SEO: meta etiketleri, Open Graph, sitemap.

Doğrulama: accuracy_report, axe, responsive, koyu + açık; Lighthouse; Vercel önizleme dağıtımı.
Senden gereken: Vercel projesini bu repoya, kök klasörü `apps/web` olacak şekilde bağlamak (alan adı aynı kalır).

Kararlar (2026-10-23): tek Premium plan (₺29,99/ay; öğrenci ve aile planı PayTR ile sonra); sanatçı paneli sitede;
sanatçı dosyaları doğrudan R2'ye gider, ret olursa silinir (bu yüzden site sunucusu da R2 anahtarlarını Vercel'de tutar);
e-posta doğrulaması açılacak ve SMTP bağlanacak. "Premium talepleri" tablosu yok: ödeme açılana kadar Premium admin
panelinden elle verilir.

Durum (2026-10-24):

- Yapıldı: `apps/web` (Next.js 16 App Router, Tailwind v4, `@supabase/ssr`). Sayfalar: tanıtım ve indirme (GitHub son
  sürümü saatte bir), giriş/kayıt (e-posta ve Google), şifre sıfırlama, hesap, Premium, ödeme iskeleti, sanatçı paneli,
  admin (genel bakış, şarkılar, düzenleme, YouTube'dan ekleme, kullanıcılar, sanatçı başvuruları, giriş kayıtları),
  sitemap, robots, 404. Eski adresler (`/dashboard`, `*.html`) yeni sayfalara yönlenir.
- `packages/ui`: web ve masaüstünün ortak bileşenleri; Tailwind teması token'lardan gelir, hazır renk paleti kapalı.
- Migration `20261024000000_artist_uploads.sql` uygulandı: `songs.uploaded_by`, dosya yolu tekilliği, şarkıyı doğrudan
  yalnızca admin ekler, sanatçı `submit_artist_song` ile ekler (hep onay bekler), `artist_song_stats`.
- Bulunan ve düzeltilen hatalar: kullanıcı adı aramasında `_` ve `.` boşluğa dönüşüyordu (alt çizgili adlar
  bulunamıyordu); sunucu bileşenindeki düğmeler sayfayı hataya düşürüyordu; dar ekranda üst bant ve kartlar taşıyordu.
- Doğrulama:
  - Uçtan uca `node apps/web/scripts/e2e.mjs`: geçici hesaplarla kayıt, profil, sanatçı başvurusu, admin onayı,
    tarayıcıdan R2'ye yükleme (imzası bozulan yükleme reddedilir), ret (R2 dosyaları silinir), onay, düzenleme, silme,
    Premium verme, yetkisiz erişim, arayüzden YouTube içe aktarma. Sonunda her şey silinir ve ayrıca doğrulanır.
  - Erişilebilirlik `node apps/web/scripts/check-auth.mjs`: 24 sayfa durumu x koyu/açık x masaüstü/mobil = 96 kontrol;
    axe 0 ihlal, metin ve üzerine gelme/odak durumlarında kontrast, odak halkası, 280/320/414 piksel taşma, JS hatası.
  - `npm test -w @bekofy/web`, `npm test -w @bekofy/core`, `tsc`, `next build`, emoji ve sabit değer denetimleri.
- Yayın (2026-10-25): `https://bekofy.bekirr.dev` yeni sitede. Vercel projesi `bekofy`: repo `TikziiBaba/bekofy`,
  kök `apps/web`, framework Next.js, ortam değişkenleri production + preview. Production dalı Vercel'de `main`;
  site şimdilik `redesign` dalında olduğu için canlı dağıtım `redesign` commit'inden elle başlatıldı. `redesign`'a
  gönderilenler önizleme olur; `main`'e birleşince canlı dağıtım kendiliğinden olur.
  - Yayından önce bulunan hata: Faz 6'daki görsel yükleme değişikliği site derlemesini kırıyordu ve web ile
    masaüstünde dosya yerine `Blob.bytes` metodunu yüklemeye çalışıyordu (düzeltildi, testi var).
  - R2 CORS ayarı yapılmış (siteden PUT, `content-type` ve `cache-control` başlıkları izinli; denendi).
  - Canlı doğrulama: `check.mjs` 40/40 oturumsuz, `check-auth.mjs` 96/96 oturumlu (geçici admin hesabı, sonra
    silindi); eski adresler yönleniyor; indirme bağlantıları doğru. Canlıda `networkidle` beklemesi bitmez (korumalı
    sayfaların önceden yüklemesi girişe yönlenir, Next yanıtı sonuna kadar okumaz); denetim `load` + 2,5 sn ile koşuldu.
- Bekleyen (senden):
  1. Supabase > Authentication > URL Configuration: Site URL şu an `http://localhost:3000`. Olması gereken:
     Site URL `https://bekofy.bekirr.dev`; Redirect URLs `https://bekofy.bekirr.dev/auth/callback`,
     `http://localhost:3000/auth/callback`, `bekofy://auth/callback`. Bu yapılana kadar sitede, masaüstünde ve
     mobilde Google ile giriş ve şifre sıfırlama bağlantıları localhost'a gider (e-posta + şifre ile giriş çalışır).
  2. Supabase > Authentication: "Confirm email" şu an kapalı. Açılacaksa önce SMTP (ör. Resend) bağlanmalı. E-posta
     şablonlarında bağlantı başka cihazda da çalışsın diye: kayıt
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, şifre sıfırlama
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
- Not: tanıtım sayfası yeni tasarımı anlatıyor; indirilen 1.4.1 hâlâ eski tasarım. Masaüstü 2.0.0 sürümü Supabase
  ayarı (madde 1) yapıldıktan sonra yayınlanmalı, yoksa güncellenen kullanıcılar Google ile giremez.

### Faz 5: Masaüstü (`apps/desktop`)

- electron-vite + React + TS; electron-builder ve GitHub üzerinden otomatik güncelleme korunur.
- `main.js` modüllere bölünür: pencereler, IPC, çevrimdışı indirme, Discord, güncelleyici, mini oynatıcı. Preload tipli ve dar bir API sunar.
- Tüm özellikler yeni tasarımla: özel başlık çubuğu, mini oynatıcı, Discord durumu, çoklu hesap. (Admin terminali kaldırıldı, bkz. kararlar.)
- Uygulama kimliği uyumsuzluğu giderilir.

Doğrulama: her ekran için durum + kontrast kontrolleri; elle kontrol listesi (çal, ara, liste oluştur, indir, çevrimdışı çal, mini oynatıcı, güncelleme); Windows kurulum dosyası üretiliyor.

Kararlar (2026-10-23): Discord'da "Bekofy dinliyor" olarak görünür (eski "Spotify" taklidi kaldırıldı; Discord kurallarına
aykırıydı). Admin terminali kaldırıldı; admin işleri sitedeki panelde, uygulamada siteye bağlantı var.

Durum (2026-10-23):

- Yapıldı: `apps/desktop` (Electron 44, electron-vite 6, React 19, Tailwind v4, `@bekofy/ui`). Ana süreç modülleri:
  pencereler, güvenlik (gezinme ve yeni pencere engeli, izinler kapalı, dış bağlantılar izinli https adresleriyle),
  çevrimdışı indirme (`bekofy-media://` şeması, yalnızca uuid), Discord, güncelleyici, kapak rengi, mini oynatıcı.
  Preload sandbox'lı ve tipli dar bir API açar; IPC yalnızca kendi pencerelerinden gelen istekleri kabul eder.
- Arayüz: giriş/kayıt (e-posta ve Google; Google dönüşü `bekofy://auth/callback`), ana sayfa, arama (şarkı, sanatçı,
  liste, kişi), kitaplık (listeler, sanatçılar, indirilenler), beğenilenler, çalma listesi (oluştur, ad değiştir, gizli/açık,
  sil, şarkı ekle/çıkar, tümünü indir), albüm, sanatçı (takip), profil (takip, rozetler, en çok dinlenenler), ayarlar
  (tema, kapak rengi, Discord, hesaplar), Jam (başlat/katıl, canlı eşitleme), şimdi çalıyor (senkron sözler, satıra
  tıklayınca gider), yılın özeti, sağ panel (sıradakiler, arkadaş etkinliği canlı), mini oynatıcı, güncelleme bandı.
  Oynatıcı: kuyruk çekirdekte; dinleme geçmişi, "şimdi ne dinliyor", Windows medya tuşları, kısayollar.
- Çoklu hesap gerçekten çalışıyor: her hesabın oturumu ayrı anahtarda; geçişte yeniden giriş gerekmez.
- Güvenlik farkı: eski uygulama R2 anahtarlarını `.env` ile pakete koyuyordu ve arayüzden R2'ye yükleme açıktı; yeni pakette
  anahtar yok (asar içeriği denetlendi), içerik güvenlik politikası dış betikleri engelliyor.
- Uyumluluk: appId `com.bekofy.app` ve ad "Bekofy" eski kurulumla aynı; 1.x kullanıcıları yerinde güncellenir, indirilen
  şarkılar (`offline-songs`) aynı klasörden çalar. Oturumlar yeni anahtarlarda olduğu için ilk açılışta bir kez giriş yapılır.
- Doğrulama:
  - Uçtan uca `node apps/desktop/scripts/e2e.mjs`: 44/44. Derlenmiş uygulama gerçek Electron'da, ayrı veri klasörüyle,
    iki geçici hesapla: giriş (giriş kaydı "desktop"), arama, çalma, ses düzeyi, beğenme, liste oluştur/ekle/çıkar,
    indirip diskten çalma (başka yol okunamıyor), mini oynatıcı, şimdi çalıyor, yılın özeti, Jam başlat/bitir, tema,
    en dar pencerede taşma, hesap ekleme ve geçiş, takip; 13 ekran koyu ve açık temada axe, kontrast, klavye odağı.
    Hesaplar ve oluşturdukları her şey sonunda silinir.
  - `npm run dist -w @bekofy/desktop`: `Bekofy.Setup.2.0.0.exe` (122 MB) üretildi; paketlenmiş uygulama ayrı profille açıldı.
  - Tip denetimi, birim testleri, emoji ve sabit değer denetimleri.
- Bekleyen (senden):
  1. Discord Developer Portal'da "Bekofy" adlı uygulama aç; Application ID'yi ver (`src/main/config.ts`). Rich Presence >
     Art Assets'e `bekofy` adlı logo yükle. Verilene kadar Discord durumu kapalı.
  2. Supabase > Authentication > URL Configuration > Redirect URLs: `bekofy://auth/callback` (masaüstünde Google girişi).
  3. Sürüm yayınlamak için yeni bir GitHub token'ı (eskisi açığa çıktı) ve `npm run release -w @bekofy/desktop`.
  Kurulum dosyası imzasız; Windows SmartScreen uyarısı eskisi gibi görünür.

### Faz 6: Mobil (`apps/mobile`, Expo)

- Expo Router; sekmeler: Ana sayfa, Ara, Kitaplık; aşağıdan açılan Şimdi çalıyor ekranı.
- Arka planda çalma + kilit ekranı ve bildirim kontrolleri. Kütüphane (expo-audio ya da react-native-track-player) fazın başında küçük bir prototiple seçilir.
- Çevrimdışı indirme, sosyal, Jam (Supabase Realtime), şarkı sözü, Wrapped, profil, sanatçı sayfası.
- EAS ile Android derlemesi. iOS kodu hazır olur; App Store için Apple Developer hesabı (yıllık 99$) gerekir.
- Eski `android/` WebView projesi, yeni uygulama çalıştıktan sonra silinir.

Doğrulama: Android emülatörü ve gerçek cihazda elle test listesi; TalkBack etiketleri; koyu + açık.

Kararlar (2026-10-23):
- Paket adı `com.bekofy.app`; şimdilik yerel APK, EAS ve Play Store sonra.
- Oynatıcı: expo-audio `AudioPlaylist` (prototiple seçildi): arka planda çalma, bildirim ve kilit ekranı denetimleri
  (önceki/sonraki dahil) yerel listede; uygulama `trackChanged` olayıyla eşitlenir.
- APK, GitHub'daki son sürüme (şimdilik v1.4.1, etiket `ota`) ek dosya olarak yüklenir; site Android düğmesini oradan
  bağlar. Yeni "son sürüm" açılmaz, yoksa eski masaüstü uygulamalarının güncelleme denetimi ve Windows düğmesi bozulur.
- Yayın anahtarı kalıcı: `%USERPROFILE%\.bekofy\bekofy-release.jks`, parolası kökteki `.env`'de
  (`BEKOFY_ANDROID_*`). Anahtar kaybolursa kurulu uygulamalar güncellenemez; dosya ve parola yedeklenmeli.

Durum: yapıldı.
- Ekranlar:
  - Giriş ve kayıt (e-posta, Google; Google dönüşü `bekofy://auth/callback`).
  - Ana sayfa: devam et, hızlı erişim, arkadaşların ne dinliyor (canlı), son dinlenenler, yeni eklenenler, Jam ve yılın özeti.
  - Arama, kitaplık (listeler, sanatçılar, indirilenler), beğenilenler, çalma listesi, albüm, sanatçı (takip),
    profil (takip, rozetler), ayarlar (tema, kapak rengi, Premium ve hesap için site bağlantıları).
  - Jam (başlat, koda katıl, canlı eşitleme), yılın özeti.
- Şimdi çalıyor: alttan kayar, aşağı sürükleyince kapanır; kapakta yana kaydırma şarkı değiştirir; sözler ve sıra alt sayfada.
- Hareket: süre ve eğriler token'lardan; arka plan ışığı kapaktan (masaüstüyle aynı `seedFromPixels` yolu, kapak
  thumbhash'inden); mini oynatıcıda kaydırma; kaydırınca küçülen koleksiyon başlığı; beğenide kalp sıçraması; titreşim.
  Sistemde "animasyonları kaldır" açıksa giriş animasyonları bağlanmaz, sürekli göstergeler durur.
- Şarkı satırı: sağa çek sıradaki çal, sola çek listeye ekle (TalkBack'te özel eylem). Sıra ekranında sağa çek: hemen sıradaki.
- Alt çubukta "Oluştur": çalma listesi, ortak liste, Jam, sırayı listeye kaydet.
- Liste düzenleme: kapak fotoğrafı (galeriden, kare kırpma), ad, açıklama, gizlilik, birlikte düzenleyenler, sürükleyerek
  sıralama, çıkarma, silme; kaydetmeden çıkarken uyarır.
- İnternetsiz dinleme Premium'a özel (`Paths.document/offline-songs`).
- Windows'ta yerel derleme 260 karakterlik yol sınırına takılıyordu: config plugin ile `CMAKE_OBJECT_PATH_MAX`.
- Core: React Native'de oturum anahtarının ezilmesi düzeltildi; görsel yükleme ham bayt da kabul ediyor.
- Doğrulama:
  - Emülatörde elle (ekran görüntüsü ve dokunma): giriş, çalma, arka planda çalma, bildirimden sonraki/duraklat,
    şimdi çalıyor açılış ve sürükleyerek kapanış, kapak rengi, alt sayfalar, koyu ve açık tema.
  - Ortak düzenleyici ve kapak yükleme izinleri iki geçici hesapla veritabanında denendi.
  - `node apps/mobile/scripts/e2e.mjs` yazıldı (geçici iki hesap, sonunda silinir) ama tam geçmedi: uiautomator, çalma
    sırasında ekranı okuyamıyor. Bu yüzden yeni eklenen kaydırma, Oluştur ve düzenleme akışlarının testi koşulmadı.
  - Tip denetimi temiz; renk eşleşmelerinin kontrastı iki temada ölçüldü.
- Yayın (2026-10-25): `Bekofy-2.0.0.apk` (arm64 + arm32, 58 MB, kalıcı anahtarla imzalı) `ota` sürümüne yüklendi;
  sitedeki Android düğmesi onu bağlıyor. Yayın derlemesi önce Windows yol sınırına takılmıştı; config plugin artık
  sınırı yerel kodlu tüm kütüphanelere uyguluyor. Aynı yayın ayarlarıyla x86_64 derlemesi emülatörde açıldı; arm APK
  emülatörün ARM çevirisinde açılmıyor (`libreactnative.so`), gerçek telefonda denenmedi.
- Bekleyen (senden):
  1. Telefonda eski Bekofy (WebView) uygulaması varsa önce kaldırılmalı: imza farklı, üzerine kurulmaz.
  2. Supabase Redirect URLs'e `bekofy://auth/callback` (mobilde Google girişi için de gerekli; Faz 4 madde 1).
  3. Yayın anahtarını (`.bekofy` klasörü ve `.env`'deki parola) güvenli bir yere yedekle.
- Sonra: eski `android/` WebView projesinin silinmesi Faz 8'e kaldı.

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
