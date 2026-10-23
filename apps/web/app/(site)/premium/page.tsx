import { buttonVariants, Notice } from '@bekofy/ui';
import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PREMIUM_PERIOD, PREMIUM_PRICE } from '@/lib/site';
import { getViewer } from '@/lib/viewer';

export const metadata: Metadata = {
  title: 'Premium',
  description: `Bekofy Premium ${PREMIUM_PRICE}/${PREMIUM_PERIOD}: şarkıları indirip internetsiz dinle, avatar çerçeveleri ve Premium rozeti.`,
  alternates: { canonical: '/premium' },
};

const FREE = ['Tüm kütüphane, reklam yok', 'Çalma listeleri ve beğeniler', 'Jam ile birlikte dinleme', 'Şarkı sözleri ve arkadaş etkinliği'];
const PREMIUM = ['Ücretsiz plandaki her şey', 'Şarkıları indir, internetsiz dinle', 'Avatar çerçeveleri', 'Profilinde Premium rozeti', "Bekofy'nin gelişimine destek"];

const FAQ = [
  { q: 'Ödemeyi nasıl yapacağım?', a: 'Ödemeler PayTR ile alınacak. Kart bilgilerin Bekofy’ye değil, PayTR’nin güvenli ödeme sayfasına girilir. Ödeme sistemi hazırlanıyor; açıldığında bu sayfadan Premium’a geçebileceksin.' },
  { q: 'Premium hangi uygulamalarda geçerli?', a: 'Tek hesap her yerde geçerli: masaüstü, telefon ve site. Premium’a geçtiğinde tüm cihazlarında açılır.' },
  { q: 'Ücretsiz planda reklam var mı?', a: 'Hayır. Bekofy’de reklam yok; Premium ek özellikler içindir.' },
];

export default async function PremiumPage() {
  const viewer = await getViewer();
  const cta = !viewer
    ? { href: '/register?next=%2Fcheckout', label: 'Hesap aç ve Premium’a geç' }
    : viewer.isPremium
      ? null
      : { href: '/checkout', label: 'Premium’a geç' };

  return (
    <div className="mx-auto flex w-full max-w-(--size-layout-content) flex-col gap-16 px-4 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-col gap-4">
        <h1 className="type-hero max-w-[16ch]">Müziğin seninle gelsin.</h1>
        <p className="max-w-(--size-layout-measure) type-body-lg text-fg-muted">
          Premium ile şarkıları indir, internet yokken de dinle. Ücretsiz plan da tam kütüphaneyle gelir.
        </p>
      </div>

      {viewer?.isPremium ? (
        <Notice tone="success" title="Premium üyesin">
          İndirme, avatar çerçeveleri ve Premium rozeti hesabında açık.
        </Notice>
      ) : null}

      <section aria-labelledby="plans-title" className="flex flex-col gap-6">
        <h2 id="plans-title" className="sr-only">
          Planlar
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <article className="glass-panel flex flex-col gap-5 rounded-ui-xl p-6 sm:p-8">
            <h3 className="type-title-lg">Ücretsiz</h3>
            <p className="font-display text-(length:--font-size-5xl) leading-none font-bold">₺0</p>
            <PlanList items={FREE} />
            {viewer ? (
              <p className="mt-auto type-body-sm text-fg-muted">{viewer.isPremium ? 'Premium bunun hepsini içerir.' : 'Şu anki planın.'}</p>
            ) : (
              <Link href="/register" className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'mt-auto self-start whitespace-normal text-center' })}>
                Ücretsiz başla
              </Link>
            )}
          </article>
          <article className="flex flex-col gap-5 rounded-ui-xl bg-inverse p-6 text-fg-inverse sm:p-8">
            <h3 className="type-title-lg">Premium</h3>
            <p className="font-display text-(length:--font-size-5xl) leading-none font-bold">
              {PREMIUM_PRICE} <small className="type-body-md">/ {PREMIUM_PERIOD}</small>
            </p>
            <PlanList items={PREMIUM} />
            {cta ? (
              <Link href={cta.href} className={buttonVariants({ size: 'lg', className: 'mt-auto self-start whitespace-normal text-center' })}>
                {cta.label}
              </Link>
            ) : (
              <p className="mt-auto type-label-md">Şu anki planın.</p>
            )}
          </article>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="flex max-w-(--size-layout-measure) flex-col gap-4">
        <h2 id="faq-title" className="type-title-xl">
          Sık sorulanlar
        </h2>
        <div className="flex flex-col gap-2">
          {FAQ.map((item) => (
            <details key={item.q} className="glass-panel group rounded-ui-lg">
              <summary className="flex min-h-(--size-touch) cursor-pointer list-none items-center justify-between gap-4 rounded-ui-lg px-5 py-3 type-label-md [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="text-fg-muted transition-transform duration-(--duration-base) ease-standard group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-fg-muted">{item.a}</p>
            </details>
          ))}
        </div>
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
