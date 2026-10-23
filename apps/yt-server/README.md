# Bekofy YouTube içe aktarma sunucusu

Senin bilgisayarında çalışan küçük bir sunucu. Sitedeki admin panelinden bir YouTube bağlantısı gönderilir;
sunucu videonun bilgilerini getirir, panelde düzenlenen bilgilerle sesi MP3 olarak indirir, kapağı kare yapar,
ikisini R2'ye yükler ve şarkıyı kütüphaneye ekler. İlerleme panelde canlı görünür.

Supabase anahtarı gerekmez: şarkı kaydı, panelde giriş yapmış adminin oturumuyla yapılır (yetkiyi veritabanı denetler).

## Kurulum (bir kez)

Kök dizinde:

```bash
npm install
```

```bash
npm run yt-server:setup
```

`setup`, yt-dlp ile ffmpeg/ffprobe'u yt-dlp ekibinin resmi GitHub sürümlerinden indirir ve SHA-256 özetlerini doğrular
(yaklaşık 100 MB). Dosyalar `apps/yt-server/bin/` altına kurulur ve git'e girmez.

Sonra R2 bilgilerini **kökteki `.env`** dosyasına (ya da `apps/yt-server/.env` dosyasına) yaz.
`.env.example` dosyaları yalnızca örnektir ve git'e girer; gerçek değerleri asla oraya yazma.

1. Cloudflare paneli > R2 > **Manage R2 API Tokens** > **Create API Token**.
2. İzin: **Object Read & Write**, yalnızca `bekofy-music` bucket'ı.
3. Çıkan **Access Key ID** ve **Secret Access Key** değerlerini, panelin sağ üstündeki **Account ID** ile birlikte `.env`'ye yaz.

`.env` git'e girmez. Anahtarı kimseyle paylaşma.

## Çalıştırma

```bash
npm run yt-server
```

Açılışta yt-dlp, ffmpeg ve R2 durumu yazılır. Sunucu yalnızca `http://127.0.0.1:4317` adresinde dinler; ağdaki başka
bilgisayarlar erişemez. Kapatmak için Ctrl+C.

Chrome, siteden bu sunucuya ilk bağlanışta **yerel ağ erişimi** izni sorar; bir kez izin vermen yeterli.

## Güncelleme

YouTube değiştikçe yt-dlp de sık güncellenir. "robot sandı" ya da "alınamadı" hataları artarsa:

```bash
npm run yt-server:update
```

## Sorun giderme

| Mesaj | Ne yapmalı |
|-------|-----------|
| `R2 ayarları eksik` | `apps/yt-server/.env` dosyasını doldur, sunucuyu yeniden başlat. |
| `R2 yüklemeyi reddetti` | API token izni "Object Read & Write" ve doğru bucket mı, kontrol et. |
| `YouTube bu bilgisayardan gelen isteği robot sandı` | Biraz bekle, `npm run yt-server:update` çalıştır. |
| `4317 portu kullanımda` | Sunucu zaten açık olabilir; diğer pencereyi kapat ya da `.env`'de `PORT` değiştir. |
| `Bu adresten gelen isteklere izin verilmiyor` | Panelin adresini `.env`'deki `ALLOWED_ORIGINS` listesine ekle. |

## API (admin paneli için)

Tüm istekler `Authorization: Bearer <Supabase oturum anahtarı>` ister (hesap admin olmalı) ve
`Content-Type: application/json` gönderir. Hata yanıtları: `{ "error": { "message": "<Türkçe açıklama>" } }`.

### `GET /health`

Kimlik gerekmez. `{ ok, version, ytDlp, ffmpeg, r2: { configured, missing } }`. Panel, sunucunun açık olup
olmadığını buradan anlar.

### `POST /preview`

Gövde: `{ "url": "https://youtu.be/..." }`. Yanıt:

```json
{
  "videoId": "...", "url": "https://www.youtube.com/watch?v=...", "rawTitle": "...", "channel": "...",
  "duration": 219, "thumbnail": "https://...",
  "suggestion": { "title": "Yaz Sonu", "artists": ["Ayaz Kaya"], "album": null },
  "existing": null,
  "problem": null
}
```

`existing` doluysa video daha önce eklenmiştir; `problem` doluysa (canlı yayın, 20 dakikadan uzun) eklenemez.

### `POST /import`

Gövde:

```json
{
  "url": "https://youtu.be/...",
  "title": "Yaz Sonu",
  "artists": ["Ayaz Kaya", "Selin Aras"],
  "album": null,
  "cover": { "kind": "youtube" }
}
```

Kendi kapağın için `"cover": { "kind": "upload", "dataUrl": "data:image/jpeg;base64,..." }` (JPG, PNG ya da WebP, en fazla 5 MB).

Yanıt satır satır JSON akışıdır (`application/x-ndjson`); panel `fetch` ile okur:

```text
{"type":"progress","stage":"download","percent":12}
{"type":"progress","stage":"convert","percent":60}
{"type":"progress","stage":"upload","percent":80}
{"type":"progress","stage":"save","percent":100}
{"type":"done","song":{"id":"...","title":"Yaz Sonu","artist":"Ayaz Kaya, Selin Aras", ...}}
```

Akış ortasında hata olursa son satır `{"type":"error","message":"..."}` olur ve o ana kadar R2'ye yüklenenler ile
eklenen kayıt geri alınır. Aynı anda tek içe aktarma yapılır; ikincisi 409 alır.

Aşamalar ve yüzde aralıkları: indirme 0-60, dönüştürme 60-70, kapak 70-75, yükleme 75-95, kayıt 95-100.

## Testler

```bash
npm test -w @bekofy/yt-server
```

Gerçek R2 ve veritabanıyla uçtan uca test (kökteki `.env`'de `SUPABASE_SERVICE_ROLE_KEY` ve `R2_*` gerekir). Geçici bir admin
hesabı açar, kısa bir videoyu (19 sn) içe aktarır, sonucu veritabanında, R2'de ve genel adreste denetler; sonunda şarkıyı,
sanatçıyı, R2 dosyalarını ve hesabı siler:

```bash
npm run test:e2e -w @bekofy/yt-server
```
