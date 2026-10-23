import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { RegisterForm } from '@/components/auth/register-form';
import { safeNext } from '@/lib/safe-next';
import { getViewer } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Kayıt ol', alternates: { canonical: '/register' } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getViewer()) redirect(next);
  return (
    <AuthShell
      title="Ücretsiz hesap aç"
      description="Tek hesapla masaüstünde, telefonda ve sitede giriş yaparsın."
      footer={
        <>
          Zaten hesabın var mı?{' '}
          <Link href={`/login${params.next ? `?next=${encodeURIComponent(next)}` : ''}`} className="type-label-md text-accent-fg hover:underline">
            Giriş yap
          </Link>
        </>
      }
    >
      <RegisterForm next={next} />
    </AuthShell>
  );
}
