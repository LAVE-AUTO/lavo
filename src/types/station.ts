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
  imageUrl?: string;
  description?: string;
  openingHours?: string;
  verified?: boolean;
  latitude?: number;
  longitude?: number;
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

/**
 * Extended station data returned by GET /stations/:id.
 */
export interface StationDetailData extends Station {
  reviews: Review[];
  services: string[];
  queueCount: number;
  estimatedWaitMinutes: number;
}
