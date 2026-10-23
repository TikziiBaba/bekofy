import { Button, buttonVariants, Notice } from '@bekofy/ui';
import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead, Panel } from '@/components/panel';
import { PREMIUM_PERIOD, PREMIUM_PRICE } from '@/lib/site';
import { requireViewer } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Premium’a geç', robots: { index: false } };

/**
 * Ödeme sayfası iskeleti. Kart bilgisi burada alınmaz: PayTR bağlandığında bu sayfa PayTR'nin güvenli
 * ödeme ekranını (iFrame) açacak ve sonuç PayTR bildirim adresinden sunucuya gelecek.
 */
export default async function CheckoutPage() {
  const viewer = await requireViewer('/checkout');
  return (
    <div className="mx-auto flex w-full max-w-[calc(var(--size-layout-panel)*2.2)] flex-col gap-8 px-4 py-12 sm:px-8">
      <PageHead title="Premium’a geç" description="Ödeme sistemi hazırlanıyor. Açıldığında bu sayfadan güvenle ödeyebileceksin." />
      {viewer.isPremium ? (
        <Notice
          tone="success"
          title="Zaten Premium üyesin"
          actions={
            <Link href="/account" className="type-label-md underline">
              Hesabıma dön
            </Link>
          }
        >
          Premium özellikler hesabında açık.
        </Notice>
      ) : (
        <>
          <Panel id="summary" title="Sipariş özeti">
            <dl className="flex flex-col gap-3">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Plan</dt>
                <dd>Bekofy Premium</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Hesap</dt>
                <dd className="min-w-0 truncate">{viewer.profile?.username ? `@${viewer.profile.username}` : viewer.user.email}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-3 type-title-sm">
                <dt>Aylık tutar</dt>
                <dd>
                  {PREMIUM_PRICE} / {PREMIUM_PERIOD}
                </dd>
              </div>
            </dl>
          </Panel>
          <Notice tone="info" title="Ödeme yakında açılıyor">
            Ödemeleri PayTR alacak. Kart bilgilerin Bekofy’ye değil, PayTR’nin güvenli ödeme sayfasına girilecek.
          </Notice>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" aria-disabled="true" aria-describedby="pay-note">
              <ShieldCheck aria-hidden="true" />
              Ödemeye geç
            </Button>
            <span id="pay-note" className="type-body-sm text-fg-muted">
              Ödeme sistemi açılınca etkinleşecek.
            </span>
          </div>
          <Link href="/premium" className={buttonVariants({ variant: 'ghost', className: 'self-start' })}>
            Planlara dön
          </Link>
        </>
      )}
    </div>
  );
}
