'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Container, Title, Text, Loader, Stack, Button } from '@mantine/core';
import { PasswordGate } from '@/components/features/public/PasswordGate';
import { StudentCountTable } from '@/components/features/public/StudentCountTable';
import { StatisticsSummary } from '@/components/features/public/StatisticsSummary';
import { getEffectiveApiBaseURL } from '@/lib/api-client';
import type { ClassStudentCount } from '@/hooks/useReports';

const STORAGE_KEY_PREFIX = 'public-stats-token-';

function getStoredToken(branchCode: string): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${branchCode}`);
}

function setStoredToken(branchCode: string, token: string): void {
  sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${branchCode}`, token);
}

export interface PublicStatisticsData {
  studentCountByClass: ClassStudentCount[];
  totals: { total: number; male: number; female: number };
}

export default function PublicStatisticsPage() {
  const params = useParams();
  const branchCode =
    params && typeof (params as Record<string, unknown>).branchCode === 'string'
      ? ((params as Record<string, unknown>).branchCode as string)
      : '';
  const [token, setToken] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [statsData, setStatsData] = useState<PublicStatisticsData | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    setToken(getStoredToken(branchCode));
  }, [branchCode]);

  const fetchStats = useCallback(
    async (authToken: string) => {
      const baseUrl = getEffectiveApiBaseURL();
      const url = `${baseUrl}/api/v1/public/statistics/${encodeURIComponent(branchCode)}`;
      setStatsLoading(true);
      setStatsError(null);
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { message?: string }).message || res.statusText);
        }
        const json = await res.json();
        const data = (json as { data: PublicStatisticsData }).data;
        setStatsData(data);
      } catch (e) {
        setStatsError(e instanceof Error ? e.message : 'Failed to load statistics');
        setStatsData(null);
      } finally {
        setStatsLoading(false);
      }
    },
    [branchCode],
  );

  useEffect(() => {
    if (!token || !branchCode) return;
    fetchStats(token);
  }, [token, branchCode, fetchStats]);

  const handleVerify = useCallback(
    async (password: string) => {
      const baseUrl = getEffectiveApiBaseURL();
      const url = `${baseUrl}/api/v1/public/statistics/${encodeURIComponent(branchCode)}/verify`;
      setVerifyError(null);
      setVerifyLoading(true);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = (json as { message?: string }).message || res.statusText;
          setVerifyError(Array.isArray(msg) ? msg.join(', ') : msg);
          return;
        }
        const newToken = (json as { data?: { token?: string } }).data?.token;
        if (newToken) {
          setStoredToken(branchCode, newToken);
          setToken(newToken);
        } else {
          setVerifyError('Invalid response from server');
        }
      } catch (e) {
        setVerifyError(e instanceof Error ? e.message : 'Verification failed');
      } finally {
        setVerifyLoading(false);
      }
    },
    [branchCode],
  );

  const handleSignOut = useCallback(() => {
    if (typeof window !== 'undefined') sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${branchCode}`);
    setToken(null);
    setStatsData(null);
    setStatsError(null);
  }, [branchCode]);

  if (!branchCode) {
    return (
      <Container size="sm" py="xl">
        <Text c="dimmed">Missing branch code.</Text>
      </Container>
    );
  }

  if (!token) {
    return (
      <Container size="sm" py="xl">
        <Title order={3} mb="md" ta="center">
          Public statistics
        </Title>
        <PasswordGate onSubmit={handleVerify} error={verifyError} loading={verifyLoading} />
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Title order={3}>Public statistics</Title>
          <Button variant="subtle" size="xs" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        {statsLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Loader size="sm" />
          </div>
        )}

        {statsError && (
          <Text c="red" size="sm">
            {statsError}
          </Text>
        )}

        {!statsLoading && statsData && (
          <>
            <StatisticsSummary
              total={statsData.totals.total}
              male={statsData.totals.male}
              female={statsData.totals.female}
            />
            <StudentCountTable data={statsData.studentCountByClass} />
          </>
        )}
      </Stack>
    </Container>
  );
}
