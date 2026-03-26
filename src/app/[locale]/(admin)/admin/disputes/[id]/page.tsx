import { setRequestLocale } from 'next-intl/server';
import { AdminDisputeDetail } from '@/components/admin/disputes/AdminDisputeDetail';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminDisputeDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <AdminDisputeDetail id={id} />;
}
