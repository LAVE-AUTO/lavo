interface AdminSupportTicketDetailPageProps {
  params: {
    id: string;
  };
}

export default function AdminSupportTicketDetailPage({
  params,
}: AdminSupportTicketDetailPageProps) {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Détail ticket support</h1>
      <p className="mt-2 text-sm text-zinc-600">ID: {params.id}</p>
    </main>
  );
}

