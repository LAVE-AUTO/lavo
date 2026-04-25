import { getFromApi } from './axios-service';
import type { Station, StationDetailData, ServiceCategory, TimeSlot, Review } from '@/types/station';

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

interface ApiTimeSlot {
    id: string;
    start_time: string; // ISO date string
    end_time: string;
    capacity: number;
    booked_count: number;
    status: string;
}

interface ApiStationDetail extends ApiStationListItem {
    stationConfig: ApiStationConfig | null;
    vehicleFormats: ApiVehicleFormat[];
    timeSlots: ApiTimeSlot[];
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

interface ApiRatingItem {
    id: string;
    score: number;
    comment: string | null;
    created_at: string;
}

interface ApiRatingsResponse {
    data: {
        items: ApiRatingItem[];
        meta: { total: number; page: number; per_page: number; total_pages: number };
    };
}

interface ApiQueueEntry {
    id: string;
    status: string;
    queue_position: number | null;
}

/* ------------------------------------------------------------------ */
/*  Mapping helpers                                                    */
/* ------------------------------------------------------------------ */

function formatTime(time: string): string {
    const parts = time.split(':');
    if (parts.length < 2) return time;
    return `${parts[0]}h${parts[1]}`;
}

/**
 * Deterministic mock for available slots when the API returns 0.
 * Uses the last hex character of the station UUID to produce a stable,
 * varied result across stations (0 = unavailable, 1-4 = available).
 * Remove once the backend populates available_slots reliably.
 */
function mockAvailableSlots(id: string, apiValue: number): number {
    if (apiValue > 0) return apiValue;
    const hex = id.replace(/-/g, '');
    const n = parseInt(hex.slice(-1), 16); // 0-15
    return n < 4 ? 0 : (n % 4) + 1;         // ~25% unavailable, rest 1-4
}

function mapRatingToReview(r: ApiRatingItem): Review {
    const d = new Date(r.created_at);
    const date = d.toLocaleDateString('fr-CA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return {
        id: r.id,
        authorName: 'Anonyme',
        rating: r.score,
        comment: r.comment || '',
        date,
    };
}

function calcEstimatedWait(queueCount: number, washDuration: number, washPostCount: number): number {
    if (queueCount === 0) return 0;
    return Math.ceil(queueCount / Math.max(washPostCount, 1)) * washDuration;
}

function mapApiStationToStation(s: ApiStationListItem): Station {
    return {
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        rating: parseFloat(s.average_score || '0') || 0,
        reviewCount: s.total_ratings || 0,
        completedCount: s.completed_count ?? 0,
        availableSlots: process.env.NODE_ENV === 'production' ? (s.available_slots || 0) : mockAvailableSlots(s.id, s.available_slots || 0),
        totalSlots: s.wash_post_count || 0,
        /* priceFrom is absent from the list payload — leave it null so the UI
         * can hide the price block instead of faking a "0 $" value. Populated
         * on the detail page once vehicle_formats are available. */
        priceFrom: null,
        tags: [],
        latitude: s.latitude != null ? parseFloat(s.latitude) : undefined,
        longitude: s.longitude != null ? parseFloat(s.longitude) : undefined,
        isOpen: s.is_open,
        description: s.description || undefined,
        /* imageUrl comes from the backend — `GET /stations` does not expose it yet,
         * so stay undefined and let the placeholder render in the card. */
        imageUrl: undefined,
    };
}

function mapApiStationToDetail(s: ApiStationListItem): StationDetailData {
    return {
        ...mapApiStationToStation(s),
        reviews: [],
        services: [],
        /* List payload exposes neither service categories (Essentiel/Premium/VIP/…) nor extras —
         * leave both empty so the card hides forfait tags until the backend exposes them. */
        serviceCategories: [],
        extras: [],
        timeSlots: [],
        queueCount: 0,
        estimatedWaitMinutes: 0,
    };
}

function mapApiDetailToStationDetail(
    s: ApiStationDetail,
    reviews: Review[] = [],
    queueCount: number = 0,
    estimatedWaitMinutes: number = 0,
): StationDetailData {
    const base = mapApiStationToStation(s);

    const activeFormats = (s.vehicleFormats || []).filter((f) => f.is_active);
    const vehicleTypes = activeFormats.map((f) => f.label);
    const prices = activeFormats.map((f) => parseFloat(f.price));
    const priceFrom = prices.length > 0 ? Math.min(...prices) : null;

    let openingHours: string | undefined;
    if (s.stationConfig) {
        openingHours = `${formatTime(s.stationConfig.opening_time)} - ${formatTime(s.stationConfig.closing_time)}`;
    }

    /* Map vehicle formats to service forfaits so forfait.id is a real UUID
     * sent as vehicle_format_id to POST /stations/:id/reservations. When the
     * station has no active format we leave the list empty (no fake fallback). */
    const serviceCategories: ServiceCategory[] = activeFormats.length > 0 ? [
        {
            type: 'hand_wash',
            label: 'Format de véhicule',
            description: 'Choisissez le format correspondant à votre véhicule.',
            forfaits: activeFormats.map((f) => ({
                id: f.id,
                name: f.label,
                description: f.label,
                price: parseFloat(f.price),
                duration: s.stationConfig?.wash_duration_minutes ?? 30,
            })),
        },
    ] : [];

    /* Map real time slots: only future, non-blocked, available slots. */
    const now = new Date();
    const timeSlots: TimeSlot[] = (s.timeSlots || [])
        .filter((slot) => {
            const startTime = new Date(slot.start_time);
            return startTime > now && slot.status !== 'blocked' && slot.booked_count < slot.capacity;
        })
        .map((slot) => {
            const startTime = new Date(slot.start_time);
            const year = startTime.getFullYear();
            const month = String(startTime.getMonth() + 1).padStart(2, '0');
            const day = String(startTime.getDate()).padStart(2, '0');
            const hours = String(startTime.getHours()).padStart(2, '0');
            const minutes = String(startTime.getMinutes()).padStart(2, '0');
            return {
                id: slot.id,
                date: `${year}-${month}-${day}`,
                time: `${hours}:${minutes}`,
                available: true,
            };
        });

    return {
        ...base,
        priceFrom,
        vehicleTypes,
        openingHours,
        reviews,
        services: [],
        serviceCategories,
        /* Extras (Polish, Soin cuir, Renovation phares…) have no backend model yet —
         * empty list until a `services`/`station_services` schema lands. */
        extras: [],
        timeSlots,
        queueCount,
        estimatedWaitMinutes,
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
    const encodedId = encodeURIComponent(id);

    const [detailResult, ratingsResult, queueResult] = await Promise.all([
        getFromApi<{ data: ApiStationDetail }>(`/stations/${encodedId}`),
        getFromApi<ApiRatingsResponse>(`/stations/${encodedId}/ratings?limit=10`),
        getFromApi<{ data: ApiQueueEntry[] }>(`/stations/${encodedId}/queue`),
    ]);

    const [ok, data] = detailResult;
    if (!ok || !data || !('data' in data)) {
        return null;
    }
    const station = (data as { data: ApiStationDetail }).data;

    const [ratingsOk, ratingsData] = ratingsResult;
    const reviews: Review[] = (ratingsOk && ratingsData && 'data' in (ratingsData as object))
        ? ((ratingsData as ApiRatingsResponse).data?.items || []).map(mapRatingToReview)
        : [];

    const [queueOk, queueData] = queueResult;
    const queueEntries: ApiQueueEntry[] = (queueOk && queueData && 'data' in (queueData as object))
        ? ((queueData as { data: ApiQueueEntry[] }).data || [])
        : [];
    const activeStatuses = new Set(['waiting', 'in_progress', 'pending']);
    const queueCount = queueEntries.filter((e) => activeStatuses.has(e.status)).length;
    const washDuration = station.stationConfig?.wash_duration_minutes ?? 30;
    const washPostCount = station.wash_post_count ?? 1;
    const estimatedWaitMinutes = calcEstimatedWait(queueCount, washDuration, washPostCount);

    return mapApiDetailToStationDetail(station, reviews, queueCount, estimatedWaitMinutes);
}
