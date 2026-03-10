import { getFromApi } from './axios-service';
import type { Station, StationDetailData } from '@/types/station';

/* ------------------------------------------------------------------ */
/*  API response shapes (snake_case, matching backend output)          */
/* ------------------------------------------------------------------ */

interface ApiStationListItem {
    id: string;
    name: string;
    address: string;
    city: string;
    latitude: string | null;
    longitude: string | null;
    description: string | null;
    wash_post_count: number | null;
    is_open: boolean;
    average_score: string | null;
    total_ratings: number;
    available_slots: number;
    available: boolean;
    completed_count?: number;
    [key: string]: unknown;
}

interface ApiStationConfig {
    opening_time: string;
    closing_time: string;
    break_start: string | null;
    break_end: string | null;
    wash_duration_minutes: number;
    wash_post_count: number;
    [key: string]: unknown;
}

interface ApiVehicleFormat {
    id: string;
    label: string;
    price: string;
    is_active: boolean;
    [key: string]: unknown;
}

interface ApiStationDetail extends ApiStationListItem {
    stationConfig: ApiStationConfig | null;
    vehicleFormats: ApiVehicleFormat[];
    timeSlots: unknown[];
}

interface ApiStationListResponse {
    data: {
        all: ApiStationListItem[];
        available_now?: ApiStationListItem[];
        most_appreciated?: ApiStationListItem[];
        most_visited?: ApiStationListItem[];
    };
    meta: {
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
    };
}

/* ------------------------------------------------------------------ */
/*  Mapping helpers                                                    */
/* ------------------------------------------------------------------ */

function formatTime(time: string): string {
    const parts = time.split(':');
    if (parts.length < 2) return time;
    return `${parts[0]}h${parts[1]}`;
}

function mapApiStationToStation(s: ApiStationListItem): Station {
    return {
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        rating: parseFloat(s.average_score || '0') || 0,
        reviewCount: s.total_ratings || 0,
        availableSlots: s.available_slots || 0,
        totalSlots: s.wash_post_count || 0,
        priceFrom: 0,
        tags: [],
        latitude: s.latitude != null ? parseFloat(s.latitude) : undefined,
        longitude: s.longitude != null ? parseFloat(s.longitude) : undefined,
        isOpen: s.is_open,
        description: s.description || undefined,
    };
}

function mapApiStationToDetail(s: ApiStationListItem): StationDetailData {
    return {
        ...mapApiStationToStation(s),
        reviews: [],
        services: [],
        serviceCategories: [],
        extras: [],
        queueCount: 0,
        estimatedWaitMinutes: 0,
    };
}

function mapApiDetailToStationDetail(s: ApiStationDetail): StationDetailData {
    const base = mapApiStationToStation(s);

    const activeFormats = (s.vehicleFormats || []).filter((f) => f.is_active);
    const vehicleTypes = activeFormats.map((f) => f.label);
    const prices = activeFormats.map((f) => parseFloat(f.price));
    const priceFrom = prices.length > 0 ? Math.min(...prices) : 0;

    let openingHours: string | undefined;
    if (s.stationConfig) {
        openingHours = `${formatTime(s.stationConfig.opening_time)} - ${formatTime(s.stationConfig.closing_time)}`;
    }

    return {
        ...base,
        priceFrom,
        vehicleTypes,
        openingHours,
        verified: true,
        reviews: [],
        services: [],
        serviceCategories: [],
        extras: [],
        queueCount: 0,
        estimatedWaitMinutes: 0,
    };
}

/* ------------------------------------------------------------------ */
/*  Public fetch functions                                             */
/* ------------------------------------------------------------------ */

export interface FetchStationsResult {
    stations: StationDetailData[];
    meta: ApiStationListResponse['meta'];
    groups: {
        available_now: StationDetailData[];
        most_appreciated: StationDetailData[];
        most_visited: StationDetailData[];
    };
}

export async function fetchStations(params?: Record<string, string>): Promise<FetchStationsResult> {
    const query = new URLSearchParams({
        per_page: '100',
        groups: 'available_now,most_appreciated,most_visited',
        ...params,
    });

    const [ok, data] = await getFromApi<ApiStationListResponse>(
        `/stations?${query.toString()}`,
    );

    if (!ok || !data || !('data' in data)) {
        return {
            stations: [],
            meta: { total: 0, page: 1, per_page: 100, total_pages: 1 },
            groups: { available_now: [], most_appreciated: [], most_visited: [] },
        };
    }

    const response = data as ApiStationListResponse;

    return {
        stations: response.data.all.map(mapApiStationToDetail),
        meta: response.meta,
        groups: {
            available_now: (response.data.available_now || []).map(mapApiStationToDetail),
            most_appreciated: (response.data.most_appreciated || []).map(mapApiStationToDetail),
            most_visited: (response.data.most_visited || []).map(mapApiStationToDetail),
        },
    };
}

export async function fetchStationById(id: string): Promise<StationDetailData | null> {
    const [ok, data] = await getFromApi<{ data: ApiStationDetail }>(
        `/stations/${encodeURIComponent(id)}`,
    );

    if (!ok || !data || !('data' in data)) {
        return null;
    }

    return mapApiDetailToStationDetail((data as { data: ApiStationDetail }).data);
}
