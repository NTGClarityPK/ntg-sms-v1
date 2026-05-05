import type { Viewport } from 'next';
import type { CSSProperties } from 'react';
import { Providers } from './providers';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@/styles/tailwind.css';
import { Audiowide, Saira, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { DirectionProvider } from '@mantine/core';

const saira = Saira({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-saira',
  display: 'swap',
});

const audiowideFont = Audiowide({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-audiowide',
  display: 'swap',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'NTG Alma',
  description: 'Multi-tenant school management system',
  manifest: '/manifest.json',
  icons: {
    icon: '/alma_logo-dark.svg',
    shortcut: '/alma_logo-dark.svg',
    apple: '/alma_logo-dark.svg',
  },
  other: {
    google: 'notranslate',
  },
};

export const viewport: Viewport = {
  themeColor: '#4A7C59',
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const messages = await getMessages();

  return (
    <html lang={locale} dir={dir} translate="no">
      <body
        className={`${saira.variable} ${monoFont.variable} ${audiowideFont.variable} font-sans antialiased`}
        style={
          {
            ['--font-primary' as string]: 'var(--font-saira)',
            ['--font-heading' as string]: 'var(--font-audiowide)',
          } as CSSProperties
        }
      >
        <NextIntlClientProvider messages={messages}>
          <DirectionProvider initialDirection={dir} detectDirection={true}>
            <Providers>{children}</Providers>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
