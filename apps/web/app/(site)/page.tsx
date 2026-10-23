import { buttonVariants, cn } from '@bekofy/ui';
import { Check, Download, Image as ImageIcon, MicVocal, Monitor, MonitorSmartphone, Pause, Smartphone, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { latestDownloads } from '@/lib/releases';
import { PREMIUM_PERIOD, PREMIUM_PRICE } from '@/lib/site';

const FEATURES = [
  { Icon: Users, title: 'Jam', text: 'Kodu paylaş, arkadaşlarınla aynı şarkıyı aynı anda dinleyin.' },
  { Icon: MicVocal, title: 'Şarkı sözleri', text: 'Sözler çalan satırla birlikte akar; satıra dokun, şarkı oraya gitsin.' },
  { Icon: Download, title: 'İnternetsiz dinle', text: 'Premium ile şarkıları indir, bağlantı yokken de çalsın.' },
  { Icon: MonitorSmartphone, title: 'Discord ve mini oynatıcı', text: 'Masaüstünde ne dinlediğini göster, küçük pencereden kontrol et.' },
];

export default async function HomePage() {
  const dl = await latestDownloads();
  const versionNote = [dl.version ? `Sürüm ${dl.version}` : null, 'Windows 10 ve üstü', dl.sizeMb ? `${dl.sizeMb} MB` : null].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto flex w-full max-w-(--size-layout-content) flex-col gap-24 px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
      {/* Giriş */}
      <section aria-labelledby="hero-title" className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <h1 id="hero-title" className="type-hero max-w-[12ch]">
            Karanlıkta parlayan müzik.
          </h1>
          <p className="max-w-(--size-layout-measure) type-body-lg text-fg-muted">
            Bekofy'de arayüz geri çekilir, müzik öne çıkar. Arka plan çalan şarkının kapağından ışık alır; Jam ile arkadaşlarınla aynı anda dinlersin.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={dl.windowsUrl} className={buttonVariants({ size: 'lg' })}>
              <Download aria-hidden="true" />
              Windows için indir
            </a>
            <Link href="/register" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
              Ücretsiz hesap aç
            </Link>
          </div>
          <p className="type-body-sm text-fg-muted">{versionNote}</p>
        </div>
        <HeroVisual />
      </section>

      {/* Özellikler */}
      <section id="features" aria-labelledby="features-title" className="flex scroll-mt-24 flex-col gap-6">
        <h2 id="features-title" className="type-headline">
          Arayüz değil, müzik.
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <article className="glass-panel flex flex-col justify-end gap-3 rounded-ui-xl p-6 md:col-span-4 md:row-span-2">
            <div aria-hidden="true" className="flex flex-1 items-center justify-center gap-6 py-8 sm:gap-8">
              <div className="art art-1 w-[28%] max-w-(--size-artwork-lg) rounded-art-lg shadow-ui-lg" />
              <div className="art art-2 art-alt w-[28%] max-w-(--size-artwork-lg) -translate-y-6 rounded-art-lg shadow-ui-lg" />
              <div className="art art-3 w-[28%] max-w-(--size-artwork-lg) rounded-art-lg shadow-ui-lg" />
            </div>
            <ImageIcon aria-hidden="true" className="size-(--size-icon-md) text-accent-fg" />
            <h3 className="type-title-xl">Her şarkıda yeni bir ışık</h3>
            <p className="text-fg-muted">Arka plandaki ışık kapaktan gelir. Yazılar her renkte okunur, yeşil vurgu hep yerinde kalır.</p>
          </article>
          {FEATURES.map(({ Icon, title, text }, i) => (
            <article key={title} className={cn('glass-panel flex flex-col gap-3 rounded-ui-xl p-6', i < 2 ? 'md:col-span-2' : 'md:col-span-3')}>
              <Icon aria-hidden="true" className="size-(--size-icon-md) text-accent-fg" />
              <h3 className="type-title-md">{title}</h3>
              <p className="text-fg-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Planlar */}
      <section aria-labelledby="plans-title" className="flex flex-col gap-6">
        <h2 id="plans-title" className="type-headline">
          Ücretsiz başla, istersen Premium'a geç.
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <article className="glass-panel flex flex-col gap-4 rounded-ui-xl p-6 sm:p-8">
            <h3 className="type-title-lg">Ücretsiz</h3>
            <p className="font-display text-(length:--font-size-5xl) leading-none font-bold">₺0</p>
            <PlanList items={['Tüm kütüphane, reklam yok', 'Çalma listeleri ve beğeniler', 'Jam, şarkı sözleri, arkadaş etkinliği']} />
            <Link href="/register" className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'mt-auto self-start whitespace-normal text-center' })}>
              Ücretsiz başla
            </Link>
          </article>
          <article className="flex flex-col gap-4 rounded-ui-xl bg-inverse p-6 text-fg-inverse sm:p-8">
            <h3 className="type-title-lg">Premium</h3>
            <p className="font-display text-(length:--font-size-5xl) leading-none font-bold">
              {PREMIUM_PRICE} <small className="type-body-md">/ {PREMIUM_PERIOD}</small>
            </p>
            <PlanList items={['Ücretsiz plandaki her şey', 'İnternetsiz dinleme için indirme', 'Avatar çerçeveleri ve Premium rozeti']} />
            <Link href="/premium" className={buttonVariants({ size: 'lg', className: 'mt-auto self-start whitespace-normal text-center' })}>
              Premium'u incele
            </Link>
          </article>
        </div>
      </section>

      {/* İndir */}
      <section id="download" aria-labelledby="download-title" className="flex scroll-mt-24 flex-col gap-6">
        <h2 id="download-title" className="type-headline">
          Bekofy'yi indir
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PlatformCard Icon={Monitor} name="Windows" note={versionNote} href={dl.windowsUrl} action="İndir" />
          <PlatformCard Icon={Smartphone} name="Android" note={dl.androidUrl ? 'APK dosyası' : 'Yakında'} href={dl.androidUrl} action="İndir" />
          <PlatformCard Icon={Smartphone} name="iOS" note="Yakında" href={null} action="İndir" />
        </ul>
      </section>

      {/* Sanatçılar */}
      <section aria-labelledby="artists-title" className="flex flex-col items-start justify-between gap-6 rounded-ui-xl bg-inverse p-6 text-fg-inverse sm:flex-row sm:items-center sm:p-8">
        <div className="flex flex-col gap-2">
          <h2 id="artists-title" className="type-title-xl">
            Sanatçı mısın?
          </h2>
          <p className="max-w-(--size-layout-measure)">Başvur, onaylandıktan sonra şarkılarını yükle ve kaç kişinin dinlediğini gör.</p>
        </div>
        <Link href="/artist" className={buttonVariants({ size: 'lg' })}>
          Sanatçı paneline git
        </Link>
      </section>
    </div>
  );
}

function PlanList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2">
          <Check aria-hidden="true" className="size-(--size-icon-sm) shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function PlatformCard({ Icon, name, note, href, action }: { Icon: LucideIcon; name: string; note: string; href: string | null; action: string }) {
  return (
    <li className="glass-panel flex items-center justify-between gap-4 rounded-ui-xl p-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="flex items-center gap-2 type-title-sm">
          <Icon aria-hidden="true" className="size-(--size-icon-sm) text-fg-muted" />
          {name}
        </h3>
        <p className="type-body-sm text-fg-muted">{note}</p>
      </div>
      {href ? (
        <a href={href} className={buttonVariants({ variant: 'secondary', size: 'sm' })} aria-label={`${name} için ${action.toLocaleLowerCase('tr-TR')}`}>
          {action}
        </a>
      ) : (
        <span className="type-label-sm text-fg-muted">Hazırlanıyor</span>
      )}
    </li>
  );
}

/** Tanıtım görseli: çalan şarkı kartı. Süs; ekran okuyucudan gizli. */
function HeroVisual() {
  return (
    <div aria-hidden="true" className="relative mx-auto grid w-full max-w-(--size-artwork-2xl) place-items-center p-4 sm:p-8">
      <div className="art art-1 rounded-art-lg shadow-ui-lg" />
      <div className="glass-chrome absolute inset-x-4 bottom-2 flex items-center gap-3 rounded-ui-xl p-3">
        <div className="art art-1 w-(--size-artwork-sm) shrink-0 rounded-art-sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate type-label-md">Yaz Sonu</span>
          <span className="truncate type-body-sm text-fg-muted">Örnek sanatçı</span>
        </div>
        <span className="grid size-(--size-control-md) shrink-0 place-items-center rounded-pill bg-accent text-on-accent">
          <Pause className="size-(--size-icon-sm) fill-current" />
        </span>
      </div>
    </div>
  );
}
