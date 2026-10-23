import { afterSignIn, logAccess } from '@bekofy/core';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/safe-next';
import { createClient } from '@/lib/supabase/server';

/**
 * Google girişi ve e-posta bağlantılarının (PKCE) dönüş adresi: gelen kod oturuma çevrilir.
 * Supabase panelinde Redirect URLs listesinde olmalı: <site>/auth/callback
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL(`/login?error=${url.searchParams.get('error') ? 'oauth' : 'link'}`, url));

  const sb = await createClient();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.session) return NextResponse.redirect(new URL('/login?error=link', url));
  try {
    await afterSignIn(sb, data.session);
  } catch {
    return NextResponse.redirect(new URL('/login?error=banned', url));
  }
  await logAccess(sb, data.session.user.id, { platform: 'web', userAgent: request.headers.get('user-agent') ?? undefined }).catch(() => undefined);
  return NextResponse.redirect(new URL(next, url));
}
