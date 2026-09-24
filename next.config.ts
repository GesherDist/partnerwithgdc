import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* React Strict Mode */
  reactStrictMode: true,

  /* ESLint - Ignore during builds (run separately in CI) */
  eslint: {
    ignoreDuringBuilds: true,
  },

  /* Image Optimization */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  /* Typed Routes - Disabled until all routes are defined */
  // typedRoutes: true,

  /* Security Headers */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
