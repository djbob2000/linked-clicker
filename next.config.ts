import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    browserDebugInfoInTerminal: true,
  },

  // Production optimizations
  compress: true,
  poweredByHeader: false,

  // Disable ESLint during build for now
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Environment variables that should be available on the client side
  // NODE_ENV is automatically handled by Next.js

  // Webpack configuration for production builds
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        sideEffects: false,
      };
    }

    // Server-side specific configurations
    if (isServer) {
      // Exclude Playwright from client bundle
      config.externals = config.externals || [];
      config.externals.push('playwright');
    }

    return config;
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
