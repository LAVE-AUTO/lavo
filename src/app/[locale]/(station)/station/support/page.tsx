import { ClientSupportContainer } from '@/components/support/client/ClientSupportContainer';
import { MOCK_STATION_TICKETS } from '@/components/support/support-mock';

export default function StationSupportPage() {
  // TODO: replace mock with server-side getFromApi('/station/tickets') once endpoint is available
  return <ClientSupportContainer tickets={MOCK_STATION_TICKETS} />;
}
