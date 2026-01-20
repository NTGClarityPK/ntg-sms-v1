'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, zodResolver } from '@mantine/form';
import { z } from 'zod';
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Text,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { signIn } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    initialValues: {
      email: '',
      password: '',
    },
    validate: zodResolver(loginSchema),
  });

  const handleSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn(values.email, values.password);
      
      // Wait for session to be fully established in cookies
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Verify session was created
      if (!result.session) {
        throw new Error('Session not created');
      }
      
      notifications.show({
        title: 'Success',
        message: 'Logged in successfully',
        color: 'blue',
      });
      
      // Use window.location instead of router.push to ensure full page reload
      window.location.href = '/dashboard';
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to login';
      setError(errorMessage);
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper p="xl" radius="md" withBorder style={{ width: '100%' }}>
      <Title order={2} mb="md" ta="center">
        School Management System
      </Title>
      <Text c="dimmed" size="sm" ta="center" mb="xl">
        Sign in to your account
      </Text>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <TextInput
          label="Email"
          placeholder="your@email.com"
          required
          mb="md"
          {...form.getInputProps('email')}
        />

        <PasswordInput
          label="Password"
          placeholder="Your password"
          required
          mb="xl"
          {...form.getInputProps('password')}
        />

        <Button type="submit" fullWidth loading={isLoading}>
          Sign in
        </Button>
      </form>
    </Paper>
  );
}

