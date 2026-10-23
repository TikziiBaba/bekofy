import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Ortak paketler TypeScript kaynağı olarak gelir; Next derler.
  transpilePackages: ['@bekofy/core', '@bekofy/ui', '@bekofy/tokens'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Eski sitenin adresleri (masaüstü uygulaması ve paylaşılmış bağlantılar bunları açıyor olabilir).
  async redirects() {
    return [
      { source: '/dashboard', destination: '/account', permanent: true },
      { source: '/dashboard.html', destination: '/account', permanent: true },
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/:page(login|register|premium|checkout|admin|artist).html', destination: '/:page', permanent: true },
    ];
  },
};

export default nextConfig;
