import { Providers } from './providers';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { Rajdhani, Saira, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { DirectionProvider } from '@mantine/core';
import { cookies } from 'next/headers';

const primaryFont = Saira({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-primary',
  display: 'swap',
});

const headingFont = Rajdhani({
  subsets: ['latin'],
  weight: '700',
  variable: '--font-heading',
  display: 'swap',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'School Management System',
  description: 'Multi-tenant school management system',
  manifest: '/manifest.json',
  other: {
    google: 'notranslate',
  },
};

export const viewport = {
  themeColor: '#4caf50',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'en';
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const messages = await getMessages();

  return (
    <html lang={locale} dir={dir} translate="no">
      <body className={`${primaryFont.variable} ${headingFont.variable} ${monoFont.variable}`}>
        <NextIntlClientProvider messages={messages}>
          <DirectionProvider initialDirection={dir} detectDirection={true}>
            <Providers>{children}</Providers>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
