import { setRequestLocale } from 'next-intl/server';
import { PendingStationsList } from '@/components/admin/PendingStationsList';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminStationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PendingStationsList />;
}
