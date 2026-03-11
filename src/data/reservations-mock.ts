export type ReservationStatus = 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type QueueStatus = 'waiting' | 'in_progress';

export interface MockReservation {
    id: string;
    stationId: string;
    stationName: string;
    stationAddress: string;
    stationImageUrl: string;
    stationLatitude: number;
    stationLongitude: number;
    forfaitName: string;
    categoryLabel: string;
    extras: string[];
    date: string;       // ISO date
    timeSlot: string;   // e.g. "10:30"
    duration: number;   // minutes
    totalPrice: number;
    status: ReservationStatus;
    createdAt: string;
}

export interface MockQueueEntry {
    id: string;
    stationId: string;
    stationName: string;
    stationAddress: string;
    stationImageUrl: string;
    stationLatitude: number;
    stationLongitude: number;
    forfaitName: string;
    categoryLabel: string;
    extras: string[];
    position: number;
    estimatedWaitMinutes: number;
    totalPrice: number;
    status: QueueStatus;
    joinedAt: string;
}

/* Today and upcoming date helpers */
const today = new Date();
const todayStr = today.toISOString().split('T')[0];
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow.toISOString().split('T')[0];
const nextWeek = new Date(today);
nextWeek.setDate(nextWeek.getDate() + 5);
const nextWeekStr = nextWeek.toISOString().split('T')[0];

/* Static time for the "startable" reservation (avoids hydration mismatch) */
const soonTime = '14:30';

export const MOCK_RESERVATIONS: MockReservation[] = [
    {
        id: 'res-1',
        stationId: '1',
        stationName: 'Prestige AutoSpa Plateau',
        stationAddress: '4321 avenue du Mont-Royal Est',
        stationImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
        stationLatitude: 45.5228,
        stationLongitude: -73.5757,
        forfaitName: 'Premium',
        categoryLabel: 'Lavage a la main',
        extras: ['Cirage premium', 'Nettoyage interieur'],
        date: todayStr,
        timeSlot: soonTime,
        duration: 50,
        totalPrice: 110,
        status: 'confirmed',
        createdAt: new Date(today.getTime() - 86400000).toISOString(),
    },
    {
        id: 'res-2',
        stationId: '3',
        stationName: 'EcoWash Villeray',
        stationAddress: '3456 rue Jarry Est',
        stationImageUrl: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=600&q=80',
        stationLatitude: 45.5508,
        stationLongitude: -73.5980,
        forfaitName: 'Express',
        categoryLabel: 'Lavage automatique',
        extras: [],
        date: tomorrowStr,
        timeSlot: '14:00',
        duration: 10,
        totalPrice: 15,
        status: 'confirmed',
        createdAt: new Date(today.getTime() - 3600000).toISOString(),
    },
    {
        id: 'res-3',
        stationId: '5',
        stationName: 'Lavage Direct Longueuil',
        stationAddress: '1500 chemin de Chambly',
        stationImageUrl: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?w=600&q=80',
        stationLatitude: 45.5312,
        stationLongitude: -73.5018,
        forfaitName: 'Complet',
        categoryLabel: 'Lavage exterieur',
        extras: ['Traitement ceramique'],
        date: nextWeekStr,
        timeSlot: '09:30',
        duration: 70,
        totalPrice: 100,
        status: 'confirmed',
        createdAt: new Date(today.getTime() - 7200000).toISOString(),
    },
    {
        id: 'res-4',
        stationId: '2',
        stationName: 'QuickWash Express Rosemont',
        stationAddress: '2180 boulevard Rosemont',
        stationImageUrl: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=600&q=80',
        stationLatitude: 45.5387,
        stationLongitude: -73.5852,
        forfaitName: 'Standard',
        categoryLabel: 'Lavage automatique',
        extras: ['Desodorisation'],
        date: '2025-01-15',
        timeSlot: '11:00',
        duration: 30,
        totalPrice: 45,
        status: 'completed',
        createdAt: '2025-01-14T10:00:00Z',
    },
];

export const MOCK_QUEUE_ENTRIES: MockQueueEntry[] = [
    {
        id: 'q-1',
        stationId: '1',
        stationName: 'Prestige AutoSpa Plateau',
        stationAddress: '4321 avenue du Mont-Royal Est',
        stationImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
        stationLatitude: 45.5228,
        stationLongitude: -73.5757,
        forfaitName: 'Essentiel',
        categoryLabel: 'Lavage a la main',
        extras: [],
        position: 3,
        estimatedWaitMinutes: 25,
        totalPrice: 35,
        status: 'waiting',
        joinedAt: new Date(today.getTime() - 600000).toISOString(),
    },
    {
        id: 'q-2',
        stationId: '4',
        stationName: 'Crystal Clean Laval',
        stationAddress: '6780 boulevard des Laurentides',
        stationImageUrl: 'https://images.unsplash.com/photo-1605164599901-db40d49436e0?w=600&q=80',
        stationLatitude: 45.5668,
        stationLongitude: -73.7498,
        forfaitName: 'Maximum',
        categoryLabel: 'Lavage automatique',
        extras: ['Cirage premium'],
        position: 1,
        estimatedWaitMinutes: 8,
        totalPrice: 63,
        status: 'in_progress',
        joinedAt: new Date(today.getTime() - 1800000).toISOString(),
    },
];
