import { setRequestLocale } from 'next-intl/server';
import { AdminStationDetail } from '@/components/admin/AdminStationDetail';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminStationDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <AdminStationDetail id={id} />;
}
