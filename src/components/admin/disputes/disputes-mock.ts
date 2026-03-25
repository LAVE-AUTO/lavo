// MOCK DATA — replace with API call before shipping (GET /admin/disputes)

export type DisputeStatus = 'open' | 'refunded_full' | 'refunded_partial' | 'closed';
export type TimelineActor = 'client' | 'station' | 'admin';

export interface TimelineEvent {
  id: string;
  date: string;
  label: string;
  by: TimelineActor;
}

export interface DisputeRow {
  id: string;
  client:  { name: string; email: string };
  station: { name: string; city: string };
  reservation: {
    id: string;
    date: string;
    amount_paid: number;
    vehicle_format: string;
    status: string;
  };
  reason: string;
  status: DisputeStatus;
  created_at: string;
  events: TimelineEvent[];
}

export const MOCK_DISPUTES: DisputeRow[] = process.env.NODE_ENV === 'development' ? [
  {
    id: 'd1',
    client:  { name: 'Sophie Martin',   email: 'sophie.martin@gmail.com'   },
    station: { name: 'Wash Express MTL', city: 'Montréal' },
    reservation: { id: 'r1', date: '2026-03-10T14:00:00Z', amount_paid: 29.99, vehicle_format: 'Berline', status: 'cancelled' },
    reason: 'Service non rendu — station fermée à l\'arrivée malgré la réservation confirmée.',
    status: 'open',
    created_at: '2026-03-11T09:12:00Z',
    events: [
      { id: 'e1', date: '2026-03-10T14:05:00Z', label: 'Réservation marquée comme annulée par la station.',  by: 'station' },
      { id: 'e2', date: '2026-03-11T09:12:00Z', label: 'Litige ouvert par le client.',                       by: 'client'  },
      { id: 'e3', date: '2026-03-11T10:30:00Z', label: 'Dossier pris en charge par l\'administration.',      by: 'admin'   },
    ],
  },
  {
    id: 'd2',
    client:  { name: 'Jean Tremblay',   email: 'jean.tremblay@outlook.com' },
    station: { name: 'AutoBrille Laval', city: 'Laval' },
    reservation: { id: 'r2', date: '2026-02-28T10:00:00Z', amount_paid: 44.50, vehicle_format: 'VUS', status: 'completed' },
    reason: 'Lavage incomplet — intérieur non nettoyé contrairement au forfait choisi.',
    status: 'refunded_partial',
    created_at: '2026-03-01T11:00:00Z',
    events: [
      { id: 'e4', date: '2026-02-28T12:00:00Z', label: 'Service marqué comme complété par la station.',      by: 'station' },
      { id: 'e5', date: '2026-03-01T11:00:00Z', label: 'Litige ouvert par le client.',                       by: 'client'  },
      { id: 'e6', date: '2026-03-02T14:00:00Z', label: 'Remboursement partiel de 20,00 $ effectué.',         by: 'admin'   },
    ],
  },
  {
    id: 'd3',
    client:  { name: 'Marie Côté',      email: 'marie.cote@gmail.com'      },
    station: { name: 'CleanCar Brossard', city: 'Brossard' },
    reservation: { id: 'r3', date: '2026-03-15T09:00:00Z', amount_paid: 19.99, vehicle_format: 'Compacte', status: 'cancelled' },
    reason: 'Annulation de dernière minute par la station sans préavis.',
    status: 'refunded_full',
    created_at: '2026-03-15T10:45:00Z',
    events: [
      { id: 'e7', date: '2026-03-15T08:55:00Z', label: 'Réservation annulée par la station.',                by: 'station' },
      { id: 'e8', date: '2026-03-15T10:45:00Z', label: 'Litige ouvert par le client.',                       by: 'client'  },
      { id: 'e9', date: '2026-03-16T09:00:00Z', label: 'Remboursement total de 19,99 $ effectué.',           by: 'admin'   },
    ],
  },
  {
    id: 'd4',
    client:  { name: 'Luc Gagnon',      email: 'luc.gagnon@hotmail.com'    },
    station: { name: 'Wash Express MTL', city: 'Montréal' },
    reservation: { id: 'r4', date: '2026-03-18T15:00:00Z', amount_paid: 34.99, vehicle_format: 'Berline', status: 'completed' },
    reason: 'Rayure constatée sur la carrosserie après le lavage.',
    status: 'closed',
    created_at: '2026-03-19T08:30:00Z',
    events: [
      { id: 'e10', date: '2026-03-18T15:45:00Z', label: 'Service complété.',                                 by: 'station' },
      { id: 'e11', date: '2026-03-19T08:30:00Z', label: 'Litige ouvert par le client.',                      by: 'client'  },
      { id: 'e12', date: '2026-03-21T11:00:00Z', label: 'Litige clôturé : rayure antérieure au lavage (photos).',by: 'admin' },
    ],
  },
  {
    id: 'd5',
    client:  { name: 'Isabelle Roy',    email: 'i.roy@email.ca'            },
    station: { name: 'AutoBrille Laval', city: 'Laval' },
    reservation: { id: 'r5', date: '2026-03-20T11:00:00Z', amount_paid: 54.99, vehicle_format: 'Camionnette', status: 'cancelled' },
    reason: 'Paiement débité mais aucune confirmation reçue et station introuvable.',
    status: 'open',
    created_at: '2026-03-20T13:15:00Z',
    events: [
      { id: 'e13', date: '2026-03-20T11:05:00Z', label: 'Paiement capturé par Stripe.',                      by: 'admin'   },
      { id: 'e14', date: '2026-03-20T13:15:00Z', label: 'Litige ouvert par le client.',                      by: 'client'  },
    ],
  },
] : [];
