import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { safeNext } from '@/lib/safe-next';
import { getViewer } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Giriş yap', alternates: { canonical: '/login' } };

const ERRORS: Record<string, string> = {
  link: 'Bağlantı geçersiz ya da süresi dolmuş. Tekrar giriş yap ya da yeni bağlantı iste.',
  oauth: 'Google girişi tamamlanamadı. Tekrar dene.',
  banned: 'Hesabın askıya alındı. Destek için bizimle iletişime geç.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getViewer()) redirect(next);
  return (
    <AuthShell
      title="Tekrar hoş geldin"
      description="Hesabına giriş yap; Premium, sanatçı paneli ve hesap ayarların burada."
      footer={
        <>
          Hesabın yok mu?{' '}
          <Link href={`/register${params.next ? `?next=${encodeURIComponent(next)}` : ''}`} className="type-label-md text-accent-fg hover:underline">
            Kayıt ol
          </Link>
        </>
      }
    >
      <LoginForm next={next} initialError={params.error ? (ERRORS[params.error] ?? null) : null} />
    </AuthShell>
  );
}
