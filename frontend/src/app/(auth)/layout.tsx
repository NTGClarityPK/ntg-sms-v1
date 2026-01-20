import { Container } from '@mantine/core';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Container size="xs" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </Container>
  );
}

