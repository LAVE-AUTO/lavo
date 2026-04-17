'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { getFromApi } from '@/services/axios-service';

export interface CommissionEntry {
  id: string;
  rate: number;
  set_by: string;
  effective_at: string;
  created_at: string;
}

interface CommissionContextValue {
  rate: number;
  history: CommissionEntry[];
  loading: boolean;
  updateRate: (newRate: number) => void;
  reload: () => Promise<void>;
}

const CommissionContext = createContext<CommissionContextValue | null>(null);

/* Convert backend decimal rate (0.1) to display percentage (10) */
function toPercent(v: string | number): number {
  return Math.round(parseFloat(String(v)) * 1000) / 10;
}

export function CommissionProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [okCurrent, dataCurrent] = await getFromApi('/admin/commission');
      const [okHistory, dataHistory] = await getFromApi('/admin/commission/history');
      if (!mountedRef.current) return;

      if (okHistory) {
        const result = (dataHistory as { data: { history: Array<{ id: string; rate: string; set_by: string; effective_at: string; created_at: string }> } }).data;
        const rows = (result?.history ?? []).map((r) => ({
          id: r.id,
          rate: toPercent(r.rate),
          set_by: r.set_by,
          effective_at: r.effective_at,
          created_at: r.created_at,
        }));
        setHistory(rows);
      } else if (okCurrent) {
        const d = (dataCurrent as { data: { rate: string; set_by: string | null; effective_at: string | null } }).data;
        setHistory([{
          id: 'current',
          rate: toPercent(d.rate),
          set_by: d.set_by ?? '',
          effective_at: d.effective_at ?? new Date().toISOString(),
          created_at: d.effective_at ?? new Date().toISOString(),
        }]);
      }
    } catch {
      // keep empty history on failure
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const rate = history[0]?.rate ?? 10;

  function updateRate(newRate: number) {
    const entry: CommissionEntry = {
      id: crypto.randomUUID(),
      rate: newRate,
      set_by: 'admin',
      effective_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setHistory((prev) => [entry, ...prev]);
  }

  return (
    <CommissionContext.Provider value={{ rate, history, loading, reload: loadData, updateRate }}>
      {children}
    </CommissionContext.Provider>
  );
}

export function useCommission() {
  const ctx = useContext(CommissionContext);
  if (!ctx) throw new Error('useCommission must be used inside CommissionProvider');
  return ctx;
}
