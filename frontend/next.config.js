/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default;
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
};

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: false, // Avoid immediate reload when SW updates after going online; new SW applies on next visit
  // Do not cache API requests in the SW: when network fails, Workbox would throw "no-response"
  // and break the app. Let API calls go to the network only.
  runtimeCaching: [],
});

module.exports = withNextIntl(pwaConfig(nextConfig));

