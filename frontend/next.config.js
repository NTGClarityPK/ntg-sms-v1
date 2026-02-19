/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default;

const nextConfig = {
  reactStrictMode: true,
};

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: false, // Avoid immediate reload when SW updates after going online; new SW applies on next visit
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/localhost:3001\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
        networkTimeoutSeconds: 15,
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
});

module.exports = pwaConfig(nextConfig);

