import { afterSignIn } from '@bekofy/core';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/safe-next';
import { createClient } from '@/lib/supabase/server';

const TYPES: EmailOtpType[] = ['signup', 'email', 'recovery', 'invite', 'magiclink', 'email_change'];

/**
 * E-posta şablonlarındaki token_hash bağlantıları (başka cihazda açılsa da çalışır).
 * Şablon örneği: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const fallback = type === 'recovery' ? '/reset-password' : '/account';
  const next = safeNext(url.searchParams.get('next'), fallback);
  if (!tokenHash || !type || !TYPES.includes(type)) return NextResponse.redirect(new URL('/login?error=link', url));

  const sb = await createClient();
  const { data, error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.session) return NextResponse.redirect(new URL('/login?error=link', url));
  try {
    await afterSignIn(sb, data.session);
  } catch {
    return NextResponse.redirect(new URL('/login?error=banned', url));
  }
  return NextResponse.redirect(new URL(next, url));
}
