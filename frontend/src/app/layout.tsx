import { Providers } from './providers';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { Rajdhani, Saira, JetBrains_Mono } from 'next/font/google';

// Primary font: Saira with weights 400, 500, 600, 700
const primaryFont = Saira({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-primary',
  display: 'swap',
});

// Heading font: Rajdhani
const headingFont = Rajdhani({
  subsets: ['latin'],
  weight: '700',
  variable: '--font-heading',
  display: 'swap',
});

// Monospace font: JetBrains Mono with weights 400, 500, 600, 700
const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'School Management System',
  description: 'Multi-tenant school management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${primaryFont.variable} ${headingFont.variable} ${monoFont.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

