import { ClientSupportContainer } from '@/components/support/client/ClientSupportContainer';
import { MOCK_MY_TICKETS } from '@/components/support/support-mock';

export default function ClientSupportPage() {
  // TODO: replace mock with server-side getFromApi('/me/tickets') once endpoint is available
  return <ClientSupportContainer tickets={MOCK_MY_TICKETS} />;
}
