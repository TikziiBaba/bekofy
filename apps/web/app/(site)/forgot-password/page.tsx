import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotForm } from '@/components/auth/forgot-form';

export const metadata: Metadata = { title: 'Şifremi unuttum', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Şifreni sıfırla"
      description="Hesabının e-posta adresini yaz; şifreni yenilemen için bir bağlantı gönderelim."
      footer={
        <Link href="/login" className="type-label-md text-accent-fg hover:underline">
          Girişe dön
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
