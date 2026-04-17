'use client';

import { useTranslations } from 'next-intl';

interface ClientReservationConfirmPageProps {
  params: {
    id: string;
  };
}

export default function ClientReservationConfirmPage({
  params,
}: ClientReservationConfirmPageProps) {
  const t = useTranslations('coupons');

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">{t('confirm_title')}</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {t('confirm_id_label')}: {params.id}
      </p>
    </main>
  );
}

