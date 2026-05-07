/**
 * Public station entity returned by GET /stations and GET /stations/:id.
 */
export interface Station {
  id: string;
  name: string;
  address: string;
  city: string;
  rating: number;
  reviewCount: number;
  /** Total reservations completed at this station (Services terminés). Used to decide "most visited" section membership. */
  completedCount: number;
  availableSlots: number;
  totalSlots: number;
  /** Lowest active format price. Null when the API does not expose it on the list payload. */
  priceFrom: number | null;
  tags: string[];
  vehicleTypes?: string[];
  imageUrl?: string;
  description?: string;
  openingHours?: string;
  verified?: boolean;
  latitude?: number;
  longitude?: number;
  isOpen?: boolean;
}

/**
 * Single public review attached to a station.
 */
export interface Review {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  date: string;
}

/** Service category offered by a station */
export type ServiceCategoryType = 'hand_wash' | 'automatic_wash' | 'exterior_wash';

/** A forfait (package) within a service category */
export interface ServiceForfait {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number; // minutes
}

/** A service category with its forfaits */
export interface ServiceCategory {
  type: ServiceCategoryType;
  label: string;
  description: string;
  forfaits: ServiceForfait[];
}

/** An optional extra that can be added to any service */
export interface ServiceExtra {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number; // minutes
  tags: string[];   // e.g. ["1 personne", "15 min"]
}

/** Available time slot for booking */
export interface TimeSlot {
  id: string;         // UUID - sent as time_slot_id to POST /stations/:id/reservations
  date: string;       // YYYY-MM-DD (local time) - used to filter slots by selected date
  time: string;       // HH:MM (local time) - displayed in the grid
  available: boolean;
}

// ─── Station services (new booking flow) ────────────────────────────────────

/** A vehicle entry within a station service (one row per format for hand_wash, one row for others) */
export interface StationServiceEntry {
  id: string;                    // service_vehicle_entries.id
  vehicleFormatId: string | null; // null for non-hand_wash services
  formatLabel: string;            // display label (format name or package name)
  price: number;
  duration: number;               // minutes
}

/** An extra available for a specific service */
export interface StationServiceExtra {
  id: string;
  name: string;     // from station_extras.label
  scope: string;    // exterior | interior | both
  price: number;
  duration: number; // minutes
}

/** A station service as returned by GET /stations/:id */
export interface StationServicePublic {
  id: string;
  name: string;
  category: string;   // hand_wash | automatic_wash | self_service | …
  serviceType: string;
  description: string | null;
  isPopular: boolean;
  vehicleEntries: StationServiceEntry[];
  extras: StationServiceExtra[];
}

/** Raw station config exposed for time validation in the booking flow */
export interface StationConfigPublic {
  openingTime: string;        // "HH:MM:SS"
  closingTime: string;        // "HH:MM:SS"
  washDurationMinutes: number;
  washPostCount: number;
  /** Extra amount charged on top of service price for slot reservations (queue = no surcharge). */
  reservationSurcharge: number | null;
}

/**
 * Extended station data returned by GET /stations/:id.
 */
export interface StationDetailData extends Station {
  reviews: Review[];
  services: string[];
  serviceCategories: ServiceCategory[];
  extras: ServiceExtra[];
  timeSlots: TimeSlot[];
  queueCount: number;
  estimatedWaitMinutes: number;
  /** Real services configured by the station (new booking flow). */
  stationServices: StationServicePublic[];
  stationConfig: StationConfigPublic | null;
  /** Public photos for the station detail hero carousel. */
  photos?: string[];
}
