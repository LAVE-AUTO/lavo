'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services/axios-service';

interface HealthData {
  status: string;
  timestamp: string;
  version: string;
}

export default function WelcomePage() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFromApi<{ data?: HealthData }>('/health')
      .then(([ok, data]) => {
        const body = data as { data?: HealthData; message?: string };
        const payload = body?.data;
        if (ok && payload && typeof payload === 'object' && 'status' in payload) {
          setHealth(payload);
        } else {
          setError(body?.message ?? 'Service unavailable');
        }
      })
      .catch(() => setError('Service unavailable'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <main className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t('title')}
        </h1>
        <p className="mb-6 text-zinc-600 dark:text-zinc-400">
          {t('subtitle')}
        </p>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {t('apiStatus')}
          </h2>
          {loading && (
            <p className="text-zinc-600 dark:text-zinc-300">{tCommon('loading')}</p>
          )}
          {error && (
            <p className="text-red-600 dark:text-red-400">{error}</p>
          )}
          {health && !loading && (
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Status:</span>{' '}
                <span className="text-green-600 dark:text-green-400">
                  {health.status}
                </span>
              </p>
              <p>
                <span className="font-medium">Version:</span> {health.version}
              </p>
              <p>
                <span className="font-medium">Timestamp:</span>{' '}
                {new Date(health.timestamp).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t('ready')}
        </p>
      </main>
    </div>
  );
}

