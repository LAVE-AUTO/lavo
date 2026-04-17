import { setRequestLocale } from 'next-intl/server';
import { AdminSupportDetail } from '@/components/admin/support/AdminSupportDetail';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminSupportTicketDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <AdminSupportDetail id={id} />;
}
