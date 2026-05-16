'use client';

import { useState, useEffect } from 'react';

interface UserLocation {
    latitude: number;
    longitude: number;
}

const DISMISS_KEY = 'Hurryline_geo_banner_dismissed';
const LOCATION_KEY = 'Hurryline_geo_location';

function readStoredLocation(): UserLocation | null {
    try {
        const raw = sessionStorage.getItem(LOCATION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (
            parsed && typeof parsed === 'object' &&
            'latitude' in parsed && 'longitude' in parsed &&
            typeof (parsed as UserLocation).latitude === 'number' &&
            typeof (parsed as UserLocation).longitude === 'number'
        ) {
            return parsed as UserLocation;
        }
    } catch { /* storage unavailable */ }
    return null;
}

let cachedLocation: UserLocation | null =
    typeof window !== 'undefined' ? readStoredLocation() : null;

const listeners = new Set<(loc: UserLocation | null) => void>();

function broadcast(loc: UserLocation | null) {
    cachedLocation = loc;
    if (loc) {
        try { sessionStorage.setItem(LOCATION_KEY, JSON.stringify(loc)); } catch { /* storage unavailable */ }
    }
    listeners.forEach((l) => l(loc));
}

/**
 * Triggers the native browser geolocation prompt and broadcasts the result
 * to every subscribed `useUserLocation` consumer. Resolves to `null` when
 * the user denies permission, the navigator API is missing, or the request
 * times out.
 */
export async function requestUserLocation(): Promise<UserLocation | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return null;
    }
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                broadcast(loc);
                resolve(loc);
            },
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
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

/**
 * Subscribes to the cached browser geolocation.
 * When permission is already `granted`, silently fetches on mount so
 * distances populate without any user interaction.
 * Does NOT trigger the native permission prompt when permission is `prompt`.
 */
export function useUserLocation(): UserLocation | null {
    const [location, setLocation] = useState<UserLocation | null>(cachedLocation);

    useEffect(() => {
        listeners.add(setLocation);
        return () => { listeners.delete(setLocation); };
    }, []);

    useEffect(() => {
        if (cachedLocation) return;
        if (typeof navigator === 'undefined' || !navigator.geolocation) return;

        const permissions = (navigator as Navigator & { permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> } }).permissions;
        if (!permissions?.query) return;

        permissions
            .query({ name: 'geolocation' as PermissionName })
            .then((result) => { if (result.state === 'granted') void requestUserLocation(); })
            .catch(() => {});
    }, []);

    return location;
}

interface GeolocationBannerState {
    visible: boolean;
    request: () => Promise<void>;
    dismiss: () => void;
}

/**
 * Drives the in-app geolocation banner. Shows the banner only when the
 * Permissions API reports `prompt` (or is unavailable, e.g. Safari iOS),
 * the user has not dismissed it during this session, and no location is
 * cached yet. When permission is already `granted` the location is
 * fetched silently in the background and the banner stays hidden.
 */
export function useGeolocationBanner(): GeolocationBannerState {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !navigator.geolocation) return;
        if (cachedLocation) return;

        const isDismissed = () => {
            try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
        };

        const permissions = (navigator as Navigator & { permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> } }).permissions;
        if (!permissions?.query) {
            if (!isDismissed()) setVisible(true);
            return;
        }
        permissions
            .query({ name: 'geolocation' as PermissionName })
            .then((result) => {
                /* When permission is already granted, refetch silently regardless
                 * of the dismiss flag - the user opted in, so distance should
                 * always populate after a fresh page load. */
                if (result.state === 'granted') {
                    void requestUserLocation();
                    return;
                }
                /* For both `prompt` and `denied`, surface the banner unless the
                 * user dismissed it this session. `denied` means the user can
                 * still re-enable from the site settings - we want to keep the
                 * affordance visible so distances stop showing as `--`. */
                if (!isDismissed()) setVisible(true);
            })
            .catch(() => { if (!isDismissed()) setVisible(true); });
    }, []);

    const request = async () => {
        setVisible(false);
        const loc = await requestUserLocation();
        if (!loc) {
            // Browser denied or timed out - keep the banner gone for this session
            try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { }
        }
    };

    const dismiss = () => {
        setVisible(false);
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { }
    };

    return { visible, request, dismiss };
}
