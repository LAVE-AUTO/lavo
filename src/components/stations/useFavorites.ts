'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'lavo_favorites';

function readIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/**
 * Manages a persisted set of favourite station IDs in localStorage.
 * Safe for SSR - reads only in effects/callbacks.
 */
export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readIds());
  }, []);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeIds(next);
      return next;
    });
  }, []);

  return { isFavorite, toggle, favoriteIds: ids };
}
