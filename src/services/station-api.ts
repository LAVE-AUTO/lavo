import { getFromApi } from './axios-service';
import type { Station, StationDetailData, ServiceCategory, ServiceExtra, TimeSlot } from '@/types/station';

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

/* ------------------------------------------------------------------ */
/*  Static mock data (images not yet in DB seed)                      */
/* ------------------------------------------------------------------ */

/**
 * Temporary static image map keyed by station name.
 * Replace with a real CDN field once the backend exposes it.
 */
const STATION_IMAGE_MAP: Record<string, string> = {
    'LAVO Paris Centre':
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    'LAVO Lyon Confluence':
        'https://images.unsplash.com/photo-1632823471406-4c5c7e4c6f24?w=800&q=80',
    'LAVO Marseille Vieux-Port':
        'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=800&q=80',
    'LAVO Bordeaux Saint-Pierre':
        'https://images.unsplash.com/photo-1603052875534-9a0b6ff90f3e?w=800&q=80',
    'LAVO Toulouse Capitole':
        'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=800&q=80',
    'LAVO Nantes Commerce':
        'https://images.unsplash.com/photo-1596995804697-27d11d43652e?w=800&q=80',
    'LAVO Strasbourg Grande Île':
        'https://images.unsplash.com/photo-1610647752706-3bb12232b3ab?w=800&q=80',
};

/**
 * Mock service categories while the backend does not expose them yet.
 */
const MOCK_SERVICE_CATEGORIES: ServiceCategory[] = [
    {
        type: 'hand_wash',
        label: 'Lavage a la main',
        description: 'Un lavage soigne realise entierement a la main pour un resultat impeccable.',
        forfaits: [
            { id: 'hw-basic', name: 'Essentiel', description: 'Carrosserie + vitres + jantes', price: 15, duration: 30 },
            { id: 'hw-premium', name: 'Premium', description: 'Essentiel + interieur complet + tableau de bord', price: 25, duration: 50 },
            { id: 'hw-vip', name: 'VIP', description: 'Premium + cire de protection + parfum habitacle', price: 40, duration: 75 },
        ],
    },
    {
        type: 'automatic_wash',
        label: 'Lavage automatique',
        description: 'Passez dans notre portique automatique pour un lavage rapide et efficace.',
        forfaits: [
            { id: 'aw-express', name: 'Express', description: 'Lavage + sechage en 5 minutes', price: 8, duration: 5 },
            { id: 'aw-confort', name: 'Confort', description: 'Express + cire + brillance', price: 12, duration: 8 },
        ],
    },
    {
        type: 'exterior_wash',
        label: 'Lavage exterieur',
        description: 'Nettoyage complet de la carrosserie avec finition soignee.',
        forfaits: [
            { id: 'ew-standard', name: 'Standard', description: 'Carrosserie + jantes + vitres', price: 10, duration: 20 },
            { id: 'ew-complet', name: 'Complet', description: 'Standard + dessous de caisse + cire', price: 18, duration: 35 },
        ],
    },
];

/**
 * Mock extras while the backend does not expose them yet.
 */
const MOCK_EXTRAS: ServiceExtra[] = [
    { id: 'ex-interior', name: 'Nettoyage interieur', description: 'Aspiration et nettoyage complet de l\'habitacle', price: 10, duration: 20, tags: ['1 personne', '20 min'] },
    { id: 'ex-polish', name: 'Polish carrosserie', description: 'Lustrage pour redonner de l\'eclat a votre peinture', price: 15, duration: 25, tags: ['25 min'] },
    { id: 'ex-perfume', name: 'Parfum habitacle', description: 'Desodorisant longue duree pour votre vehicule', price: 5, duration: 5, tags: ['5 min'] },
    { id: 'ex-leather', name: 'Soin cuir', description: 'Nettoyage et hydratation des sieges en cuir', price: 20, duration: 30, tags: ['30 min', 'cuir uniquement'] },
    { id: 'ex-headlights', name: 'Renovation phares', description: 'Polissage des optiques pour une meilleure visibilite', price: 25, duration: 20, tags: ['20 min'] },
];

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

function mapApiStationToStation(s: ApiStationListItem): Station {
    return {
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        rating: parseFloat(s.average_score || '0') || 0,
        reviewCount: s.total_ratings || 0,
        availableSlots: process.env.NODE_ENV === 'production' ? (s.available_slots || 0) : mockAvailableSlots(s.id, s.available_slots || 0),
        totalSlots: s.wash_post_count || 0,
        priceFrom: 0,
        tags: [],
        latitude: s.latitude != null ? parseFloat(s.latitude) : undefined,
        longitude: s.longitude != null ? parseFloat(s.longitude) : undefined,
        isOpen: s.is_open,
        description: s.description || undefined,
        imageUrl: STATION_IMAGE_MAP[s.name] || undefined,
    };
}

function mapApiStationToDetail(s: ApiStationListItem): StationDetailData {
    return {
        ...mapApiStationToStation(s),
        reviews: [],
        services: [],
        serviceCategories: MOCK_SERVICE_CATEGORIES,
        extras: MOCK_EXTRAS,
        timeSlots: [],
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

    /* Map vehicle formats to service forfaits so forfait.id is a real UUID
     * sent as vehicle_format_id to POST /stations/:id/reservations.
     * Falls back to MOCK_SERVICE_CATEGORIES when no formats are configured yet. */
    const serviceCategories: ServiceCategory[] = activeFormats.length > 0 ? [
        {
            type: 'hand_wash',
            label: 'Format de vehicule',
            description: 'Choisissez le format correspondant a votre vehicule.',
            forfaits: activeFormats.map((f) => ({
                id: f.id,
                name: f.label,
                description: f.label,
                price: parseFloat(f.price),
                duration: s.stationConfig?.wash_duration_minutes ?? 30,
            })),
        },
    ] : MOCK_SERVICE_CATEGORIES;

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
        verified: true,
        reviews: [],
        services: [],
        serviceCategories,
        extras: MOCK_EXTRAS,
        timeSlots,
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
