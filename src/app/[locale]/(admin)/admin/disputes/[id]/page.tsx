import { AdminDisputeDetail } from '@/components/admin/disputes/AdminDisputeDetail';

interface Props { params: { id: string } }

export default function AdminDisputeDetailPage({ params }: Props) {
  return <AdminDisputeDetail id={params.id} />;
}
