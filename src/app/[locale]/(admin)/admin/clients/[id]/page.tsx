import { setRequestLocale } from 'next-intl/server';
import { AdminClientDetail } from '@/components/admin/users/AdminClientDetail';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminClientDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <AdminClientDetail id={id} />;
}
