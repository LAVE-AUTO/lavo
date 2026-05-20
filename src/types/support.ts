export type ApiTicketStatus = 'ouvert' | 'en_cours' | 'resolu' | 'ferme';
export type DisplayStatus   = 'open' | 'in_progress' | 'resolved' | 'closed';

export const STATUS_MAP: Record<ApiTicketStatus, DisplayStatus> = {
  ouvert:   'open',
  en_cours: 'in_progress',
  resolu:   'resolved',
  ferme:    'closed',
};

export interface SafeUser {
  id:         string;
  first_name: string | null;
  last_name:  string | null;
  email:      string;
  role:       string;
}

export interface ApiTicketListItem {
  id:            string;
  ticket_number: string;
  subject:       string;
  status:        ApiTicketStatus;
  priority:      string;
  category:      string;
  created_by:    string;
  assigned_to:   string | null;
  created_at:    string;
  updated_at:    string;
  resolved_at:   string | null;
  createdByUser: SafeUser;
  lastMessage:   { content: string; created_at: string } | null;
}

export interface ApiMessage {
  id:           string;
  ticket_id:    string;
  sender_id:    string;
  content:      string;
  is_from_admin: boolean;
  created_at:   string;
}

export interface ApiTicketDetail {
  id:              string;
  ticket_number:   string;
  subject:         string;
  status:          ApiTicketStatus;
  priority:        string;
  category:        string;
  created_by:      string;
  assigned_to:     string | null;
  created_at:      string;
  updated_at:      string;
  resolved_at:     string | null;
  messages:        ApiMessage[];
  createdByUser:   SafeUser;
  assignedToAdmin: SafeUser | null;
}

export function userDisplayName(user: SafeUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
}
