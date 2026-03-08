'use client';

import { useState, useEffect } from 'react';

interface UserLocation {
  latitude: number;
  longitude: number;
}

let cachedLocation: UserLocation | null = null;
let locationPromise: Promise<UserLocation | null> | null = null;

function requestLocation(): Promise<UserLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        cachedLocation = loc;
        resolve(loc);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}

/**
 * Haversine distance in km between two lat/lng points.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useUserLocation(): UserLocation | null {
  const [location, setLocation] = useState<UserLocation | null>(cachedLocation);

  useEffect(() => {
    if (cachedLocation) {
      setLocation(cachedLocation);
      return;
    }
    if (!locationPromise) {
      locationPromise = requestLocation();
    }
    locationPromise.then((loc) => {
      if (loc) setLocation(loc);
    });
  }, []);

  return location;
}
