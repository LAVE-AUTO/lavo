interface StationDetailPageProps {
  params: {
    id: string;
  };
}

export default function StationDetailPage({ params }: StationDetailPageProps) {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Station détail</h1>
      <p className="mt-2 text-sm text-zinc-600">ID: {params.id}</p>
    </main>
  );
}

