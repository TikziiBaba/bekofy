import { Notice } from '@bekofy/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { ResetForm } from '@/components/auth/reset-form';
import { getViewer } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Yeni şifre', robots: { index: false } };

export default async function ResetPasswordPage() {
  const viewer = await getViewer();
  return (
    <AuthShell title="Yeni şifre belirle">
      {viewer ? (
        <ResetForm />
      ) : (
        <Notice
          tone="warning"
          title="Bağlantının süresi dolmuş"
          actions={
            <Link href="/forgot-password" className="type-label-md underline">
              Yeni bağlantı iste
            </Link>
          }
        >
          Şifre sıfırlama bağlantısı tek kullanımlıktır ve bir saat geçerlidir.
        </Notice>
      )}
    </AuthShell>
  );
}
