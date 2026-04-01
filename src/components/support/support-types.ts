export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  is_from_admin: boolean;
  created_at: string;
}

export interface LastMessagePreview {
  content: string;
  created_at: string;
}

/** Ticket as returned by GET /support (list view — lastMessage preview, no full thread). */
export interface SupportTicketSummary {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_by: string;
  assigned_to: string | null;
  lastMessage: LastMessagePreview | null;
  created_at: string;
  updated_at: string;
}

/** Ticket as returned by GET /support/[id] (detail view — full message thread). */
export interface SupportTicketDetail {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_by: string;
  assigned_to: string | null;
  messages: SupportMessage[];
  createdByUser?: { id: string; first_name: string; last_name: string; email: string; role: string };
  assignedToAdmin?: { id: string; first_name: string; last_name: string; email: string; role: string } | null;
  created_at: string;
  updated_at: string;
}

/** Map backend status values (French) to internal status keys. */
export function mapApiStatus(apiStatus: string): TicketStatus {
  switch (apiStatus) {
    case 'ouvert': return 'open';
    case 'en_cours': return 'in_progress';
    case 'resolu': return 'resolved';
    case 'ferme': return 'closed';
    default: return 'open';
  }
}
