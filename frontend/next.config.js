/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default;
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['nextstepjs'],
  
  // Skip type checking in production build (temporary workaround)
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },
  
  // Disable font optimization (Google Fonts blocked on server)
  optimizeFonts: false,
};

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  // Register SW manually after auth (inside portal layout) so login/signup
  // pages do not trigger large Workbox precache bursts.
  register: false,
  // IMPORTANT: next-pwa extends Workbox defaults unless we disable it.
  // Defaults include aggressive page/navigation caching which can cause repeated
  // /login navigations to be fetched "from Workbox" during logout/redirect flows.
  extendDefaultRuntimeCaching: false,
  // Critical: avoid serving stale app shell after deployments/auth redirects.
  // Without this, users can get stuck on an old build that boots with mismatched env/session until refresh.
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  // Keep runtime caching disabled (don't intercept app navigations like /login).
  // Note: @ducanh2912/next-pwa reads runtimeCaching from workboxOptions.
  workboxOptions: {
    runtimeCaching: [],
  },
});

module.exports = withNextIntl(pwaConfig(nextConfig));