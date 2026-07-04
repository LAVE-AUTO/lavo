import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StationListView } from '@/components/stations/StationListView';
import type { FetchStationsResult } from '@/services/station-api';

const mockFetchStations = jest.fn<Promise<FetchStationsResult>, [Record<string, string>?]>();
const mockUseUserLocation = jest.fn();
const mockRequestUserLocation = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/services/station-api', () => ({
  fetchStations: (params?: Record<string, string>) => mockFetchStations(params),
}));

jest.mock('@/components/stations/useUserLocation', () => ({
  useUserLocation: () => mockUseUserLocation(),
  requestUserLocation: () => mockRequestUserLocation(),
}));

jest.mock('@/components/stations/SearchBar', () => ({
  SearchBar: ({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) => (
    <input
      aria-label={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

jest.mock('@/components/stations/StationCard', () => ({
  StationCard: ({ station }: { station: { name: string } }) => <div>{station.name}</div>,
}));

jest.mock('@/components/ui/PageSpinner', () => ({
  PageSpinner: () => <div>loading</div>,
}));

jest.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

jest.mock('@/components/ui/SectionHeader', () => ({
  SectionHeader: ({ title, count }: { title: string; count?: number }) => (
    <div>
      <span>{title}</span>
      <span>{count}</span>
    </div>
  ),
}));

jest.mock('@/components/stations/StationFilters', () => ({
  StationFilters: () => null,
}));

describe('StationListView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUserLocation.mockReturnValue({ latitude: 45.5019, longitude: -73.5674 });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });

  it('keeps stations from the full dataset visible when returning to the "all" filter', async () => {
    mockFetchStations.mockResolvedValue({
      stations: [
        {
          id: 'station-1',
          name: 'Spas Number 1',
          address: '123 Rue',
          city: 'Montreal',
          rating: 0,
          reviewCount: 0,
          completedCount: 0,
          availableSlots: 0,
          totalSlots: 0,
          priceFrom: null,
          tags: [],
          isOpen: true,
          reviews: [],
          services: [],
          serviceCategories: [],
          extras: [],
          timeSlots: [],
          queueCount: 0,
          estimatedWaitMinutes: 0,
          stationServices: [],
          stationConfig: null,
          photos: [],
          stationHours: [],
          stationStatus: 'temporarily_unavailable',
        },
      ],
      meta: { total: 1, page: 1, per_page: 100, total_pages: 1 },
      groups: {
        available_now: [],
        most_appreciated: [],
        most_visited: [],
      },
    });

    render(<StationListView washTypes={[]} vehicleFormats={[]} />);

    await waitFor(() => expect(mockFetchStations).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'filter_nearby' }));
    expect(await screen.findByText('Spas Number 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'filter_all' }));

    expect(await screen.findByText('Spas Number 1')).toBeInTheDocument();
  });
});
