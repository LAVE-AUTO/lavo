// MOCK DATA — replace with API calls before shipping
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketRole   = 'client' | 'station';

export interface SupportMessage {
  id:         string;
  author:     string;
  role:       'user' | 'admin';
  body:       string;
  created_at: string;
}

export interface SupportTicket {
  id:          string;
  subject:     string;
  status:      TicketStatus;
  role:        TicketRole;
  created_by:  string;
  assigned_to: string | null;
  messages:    SupportMessage[];
  created_at:  string;
  updated_at:  string;
}

export const MOCK_TICKETS: SupportTicket[] = process.env.NODE_ENV === 'development'
  ? [
      {
        id:          'tkt-001',
        subject:     'Impossible de finaliser ma réservation',
        status:      'open',
        role:        'client',
        created_by:  'Client A',
        assigned_to: null,
        messages: [
          { id: 'm1', author: 'Client A', role: 'user',  body: "Bonjour, lorsque j'essaie de confirmer ma réservation, j'obtiens une erreur 500. Cela se produit depuis hier matin.", created_at: '2026-03-20T09:15:00Z' },
        ],
        created_at: '2026-03-20T09:15:00Z',
        updated_at: '2026-03-20T09:15:00Z',
      },
      {
        id:          'tkt-002',
        subject:     'Remboursement non reçu',
        status:      'in_progress',
        role:        'client',
        created_by:  'Client B',
        assigned_to: 'Admin Support',
        messages: [
          { id: 'm2', author: 'Client B',      role: 'user',  body: "J'ai annulé ma réservation il y a 5 jours et je n'ai toujours pas reçu mon remboursement.", created_at: '2026-03-18T14:00:00Z' },
          { id: 'm3', author: 'Admin Support', role: 'admin', body: "Bonjour, nous avons bien reçu votre demande. Nous vérifions le statut du virement avec Stripe. Merci de votre patience.", created_at: '2026-03-19T10:30:00Z' },
        ],
        created_at: '2026-03-18T14:00:00Z',
        updated_at: '2026-03-19T10:30:00Z',
      },
      {
        id:          'tkt-003',
        subject:     'Station fermée pendant ma réservation',
        status:      'resolved',
        role:        'client',
        created_by:  'Client C',
        assigned_to: 'Admin Support',
        messages: [
          { id: 'm4', author: 'Client C',      role: 'user',  body: "La station était fermée à mon arrivée malgré la réservation confirmée. J'ai perdu du temps.", created_at: '2026-03-15T11:00:00Z' },
          { id: 'm5', author: 'Admin Support', role: 'admin', body: "Nous nous excusons pour ce désagrément. Un remboursement complet a été initié et devrait apparaître sous 3-5 jours.", created_at: '2026-03-15T16:00:00Z' },
        ],
        created_at: '2026-03-15T11:00:00Z',
        updated_at: '2026-03-15T16:00:00Z',
      },
      {
        id:          'tkt-004',
        subject:     'Modifier les horaires de la station',
        status:      'open',
        role:        'station',
        created_by:  'Station Alpha',
        assigned_to: null,
        messages: [
          { id: 'm6', author: 'Station Alpha', role: 'user', body: "Bonjour, je souhaite modifier mes horaires d'ouverture pour les jours fériés. Comment puis-je faire cela depuis l'interface ?", created_at: '2026-03-22T08:30:00Z' },
        ],
        created_at: '2026-03-22T08:30:00Z',
        updated_at: '2026-03-22T08:30:00Z',
      },
      {
        id:          'tkt-005',
        subject:     'Problème avec le QR code',
        status:      'closed',
        role:        'station',
        created_by:  'Station Beta',
        assigned_to: 'Admin Support',
        messages: [
          { id: 'm7', author: 'Station Beta',  role: 'user',  body: "Le QR code affiché dans mon tableau de bord ne fonctionne pas — les clients ne peuvent pas le scanner.", created_at: '2026-03-10T10:00:00Z' },
          { id: 'm8', author: 'Admin Support', role: 'admin', body: "Le problème a été identifié et corrigé. Veuillez actualiser votre page pour obtenir le nouveau QR code.", created_at: '2026-03-10T11:45:00Z' },
          { id: 'm9', author: 'Station Beta',  role: 'user',  body: "Parfait, tout fonctionne maintenant. Merci !", created_at: '2026-03-10T12:00:00Z' },
        ],
        created_at: '2026-03-10T10:00:00Z',
        updated_at: '2026-03-10T12:00:00Z',
      },
    ]
  : [];

/** Tickets belonging to the current user (client or station) — filtered server-side in real API. */
export const MOCK_MY_TICKETS: SupportTicket[] = process.env.NODE_ENV === 'development'
  ? MOCK_TICKETS.filter((t) => t.role === 'client').slice(0, 3)
  : [];

/** Tickets visible from the station perspective. */
export const MOCK_STATION_TICKETS: SupportTicket[] = process.env.NODE_ENV === 'development'
  ? MOCK_TICKETS.filter((t) => t.role === 'station')
  : [];
