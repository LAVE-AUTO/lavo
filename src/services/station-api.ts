import { getFromApi } from './axios-service';
import type { Station, StationDetailData, ServiceCategory, TimeSlot, Review, StationServicePublic, StationServiceEntry, StationServiceExtra } from '@/types/station';

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
    min_duration?: number | null;
    price_from?: string | null;
    image_url?: string | null;
    verified?: boolean;
    queue_count?: number;
    opening_hours?: { open: string; close: string } | null;
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

interface ApiPublicServiceEntry {
    id: string;
    vehicle_format_id: string | null;
    vehicle_label: string;
    price: string;
    duration_min: number;
}

interface ApiPublicServiceExtra {
    id: string;
    label: string;
    scope: string;
    price: string;
    duration_min: number;
}

interface ApiPublicStationService {
    id: string;
    name: string;
    category: string;
    service_type: string;
    description: string | null;
    is_popular: boolean;
    vehicle_entries: ApiPublicServiceEntry[];
    extras: ApiPublicServiceExtra[];
}

interface ApiStationDetailConfig {
    opening_time: string;
    closing_time: string;
    wash_duration_minutes: number;
    wash_post_count: number;
}

interface ApiStationDetail extends ApiStationListItem {
    stationConfig: ApiStationConfig | null;
    vehicleFormats: ApiVehicleFormat[];
    timeSlots: ApiTimeSlot[];
    station_services?: ApiPublicStationService[];
    station_config?: ApiStationDetailConfig | null;
    photos?: string[];
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
    author_first_name?: string | null;
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
        authorName: r.author_first_name?.trim() || 'Anonyme',
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
    const priceFromRaw = s.price_from != null ? parseFloat(s.price_from) : null;
    const openingHours = s.opening_hours
        ? `${formatTime(s.opening_hours.open)} - ${formatTime(s.opening_hours.close)}`
        : undefined;
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
        priceFrom: Number.isFinite(priceFromRaw) ? priceFromRaw : null,
        tags: [],
        latitude: s.latitude != null ? parseFloat(s.latitude) : undefined,
        longitude: s.longitude != null ? parseFloat(s.longitude) : undefined,
        isOpen: s.is_open,
        description: s.description || undefined,
        imageUrl: s.image_url ?? undefined,
        verified: s.verified ?? false,
        openingHours,
    };
}

function mapApiStationToDetail(s: ApiStationListItem): StationDetailData {
    return {
        ...mapApiStationToStation(s),
        reviews: [],
        services: [],
        serviceCategories: [],
        extras: [],
        timeSlots: [],
        queueCount: s.queue_count ?? 0,
        estimatedWaitMinutes: s.min_duration ?? 0,
        stationServices: [],
        stationConfig: null,
        photos: [],
    };
}

function mapApiDetailToStationDetail(
    s: ApiStationDetail,
    reviews: Review[] = [],
    queueCount: number = 0,
    estimatedWaitMinutes: number = 0,
    reviewCountOverride?: number,
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

    // Map station_services (new booking flow)
    const stationServices: StationServicePublic[] = (s.station_services ?? []).map(
        (svc: ApiPublicStationService): StationServicePublic => ({
            id: svc.id,
            name: svc.name,
            category: svc.category,
            serviceType: svc.service_type,
            description: svc.description,
            isPopular: svc.is_popular,
            vehicleEntries: svc.vehicle_entries.map((e: ApiPublicServiceEntry): StationServiceEntry => ({
                id: e.id,
                vehicleFormatId: e.vehicle_format_id,
                formatLabel: e.vehicle_label,
                price: parseFloat(e.price),
                duration: e.duration_min,
            })),
            extras: svc.extras.map((ex: ApiPublicServiceExtra): StationServiceExtra => ({
                id: ex.id,
                name: ex.label,
                scope: ex.scope,
                price: parseFloat(ex.price),
                duration: ex.duration_min,
            })),
        })
    );

    const stationConfig = s.station_config
        ? {
              openingTime: s.station_config.opening_time,
              closingTime: s.station_config.closing_time,
              washDurationMinutes: s.station_config.wash_duration_minutes,
              washPostCount: s.station_config.wash_post_count,
          }
        : null;

    // Derive priceFrom from station_services when available
    const allEntryPrices = stationServices.flatMap((svc) => svc.vehicleEntries.map((e) => e.price));
    const derivedPriceFrom = allEntryPrices.length > 0 ? Math.min(...allEntryPrices) : priceFrom;

    const photos = s.photos ?? [];
    return {
        ...base,
        reviewCount: reviewCountOverride ?? base.reviewCount,
        priceFrom: derivedPriceFrom,
        vehicleTypes,
        openingHours,
        imageUrl: base.imageUrl ?? photos[0],
        reviews,
        services: [],
        serviceCategories,
        extras: [],
        timeSlots,
        queueCount,
        estimatedWaitMinutes,
        stationServices,
        stationConfig,
        photos,
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
    const ratingsPayload = (ratingsOk && ratingsData && 'data' in (ratingsData as object))
        ? (ratingsData as ApiRatingsResponse).data
        : null;
    const reviews: Review[] = ratingsPayload?.items?.map(mapRatingToReview) ?? [];
    const reviewCountFromApi = ratingsPayload?.meta?.total;

    const [queueOk, queueData] = queueResult;
    const queueEntries: ApiQueueEntry[] = (queueOk && queueData && 'data' in (queueData as object))
        ? ((queueData as { data: ApiQueueEntry[] }).data || [])
        : [];
    const activeStatuses = new Set(['waiting', 'in_progress', 'pending']);
    const queueCount = queueEntries.filter((e) => activeStatuses.has(e.status)).length;
    const washDuration = station.stationConfig?.wash_duration_minutes ?? 30;
    const washPostCount = station.wash_post_count ?? 1;
    const estimatedWaitMinutes = calcEstimatedWait(queueCount, washDuration, washPostCount);

    return mapApiDetailToStationDetail(station, reviews, queueCount, estimatedWaitMinutes, reviewCountFromApi);
}
