import { Providers } from './providers';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

