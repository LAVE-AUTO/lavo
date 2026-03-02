interface ClientReservationConfirmPageProps {
  params: {
    id: string;
  };
}

export default function ClientReservationConfirmPage({
  params,
}: ClientReservationConfirmPageProps) {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Confirmation réservation</h1>
      <p className="mt-2 text-sm text-zinc-600">ID: {params.id}</p>
    </main>
  );
}

