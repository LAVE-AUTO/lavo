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
  availableSlots: number;
  totalSlots: number;
  priceFrom: number;
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
  time: string;       // e.g. "09:00"
  available: boolean;
}

/**
 * Extended station data returned by GET /stations/:id.
 */
export interface StationDetailData extends Station {
  reviews: Review[];
  services: string[];
  serviceCategories: ServiceCategory[];
  extras: ServiceExtra[];
  queueCount: number;
  estimatedWaitMinutes: number;
}
