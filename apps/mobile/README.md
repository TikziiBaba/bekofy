# Bekofy mobil (Expo, Android + iOS)

Expo SDK 58, Expo Router, expo-audio. Ortak veri katmanı `@bekofy/core`, renk ve ölçüler `@bekofy/tokens`.

## Geliştirme

```bash
npm run prebuild -w @bekofy/mobile   # android/ klasörünü üretir (elle düzenlenmez)
npm run android -w @bekofy/mobile    # emülatöre geliştirme sürümü kurar
npx expo start                       # apps/mobile içinde: JS sunucusu
```

Yerel ayarlar `app.json` ve `plugins/` içindeki config plugin'lerle yapılır:

- `with-cmake-object-path-max`: Windows'taki 260 karakterlik yol sınırı için.
- `with-release-signing`: yayın APK'si kalıcı Bekofy anahtarıyla imzalanır.

## Yayın APK'si

İmza bilgisi kökteki `.env` dosyasındadır (`BEKOFY_ANDROID_KEYSTORE`, `BEKOFY_ANDROID_KEYSTORE_PASSWORD`,
`BEKOFY_ANDROID_KEY_ALIAS`); anahtar dosyası depoda değildir. Anahtar kaybolursa kurulu uygulamalar güncellenemez.

```bash
npm run prebuild -w @bekofy/mobile
npm run apk -w @bekofy/mobile        # apps/mobile/dist/Bekofy-<sürüm>.apk
```

APK, GitHub'daki son sürüme eklenir; site Android indirme düğmesini oradan bağlar:

```bash
gh release upload <son-sürüm-etiketi> apps/mobile/dist/Bekofy-<sürüm>.apk
```

## Uygulama içi güncelleme (EAS Update)

Yalnızca JS/TS kodu ve görseller değiştiyse yeni APK gerekmez. Uygulama açılışta güncellemeyi indirir,
bir sonraki açılışta uygular ve "Uygulama güncellendi" penceresinde yenilikleri bir kez gösterir.
EAS projesi `@tikzi/bekofy`; APK yine yerelde derlenir ve `app.json`'daki `updates.requestHeaders` ile
`production` kanalını dinler.

Önce `src/lib/changelog.json`'a bir önceki kaydın `id`'sinden büyük `id` ile yeni kayıt ekleyin
(`items`: kullanıcının okuyacağı maddeler). Güncelleme mesajı da bu kayıttan alınır:

```bash
npm run update -w @bekofy/mobile
```

Yeni APK'yı ilk kez açan kullanıcıya liste gösterilmez (yenilikler sürüm notunda); yalnızca uygulama içi
güncellemeden sonra çıkar.

Güncelleme yalnızca aynı `version`'a (`app.json`, `runtimeVersion: appVersion`) sahip derlemelere gider.
Yerel kod değiştiyse (yeni yerel paket, `app.json`'da izin/ikon/eklenti, SDK yükseltmesi) `version`'ı artırıp
yeni APK derleyin. Güncelleme alabilmek için expo-updates içeren bir APK gerekir; önceki APK'lar almaz.

## Uçtan uca test

`node apps/mobile/scripts/e2e.mjs`: emülatördeki uygulamayı geçici iki hesapla dener, sonunda hesapları siler.
Uygulama verisini sıfırlar (emülatördeki oturum kapanır).
