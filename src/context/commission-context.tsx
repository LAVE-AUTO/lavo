'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export interface CommissionEntry {
  id: string;
  rate: number;
  set_by: string;
  effective_at: string;
  created_at: string;
}

// TODO: replace initial values with API call once GET /admin/commission is available
const INITIAL_HISTORY: CommissionEntry[] = [
  { id: 'h1', rate: 10, set_by: 'admin@lavo.ca',      effective_at: '2026-01-01T00:00:00Z', created_at: '2025-12-28T14:30:00Z' },
  { id: 'h2', rate: 8,  set_by: 'admin@lavo.ca',      effective_at: '2025-09-01T00:00:00Z', created_at: '2025-08-25T10:15:00Z' },
  { id: 'h3', rate: 12, set_by: 'superadmin@lavo.ca', effective_at: '2025-05-01T00:00:00Z', created_at: '2025-04-30T08:00:00Z' },
  { id: 'h4', rate: 10, set_by: 'superadmin@lavo.ca', effective_at: '2025-01-01T00:00:00Z', created_at: '2024-12-20T16:00:00Z' },
];

interface CommissionContextValue {
  rate: number;
  history: CommissionEntry[];
  updateRate: (newRate: number) => void;
}

const CommissionContext = createContext<CommissionContextValue | null>(null);

export function CommissionProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<CommissionEntry[]>(INITIAL_HISTORY);

  const rate = history[0]?.rate ?? 10;

  function updateRate(newRate: number) {
    const entry: CommissionEntry = {
      id: crypto.randomUUID(),
      rate: newRate,
      set_by: 'admin@lavo.ca',
      effective_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setHistory((prev) => [entry, ...prev]);
  }

  return (
    <CommissionContext.Provider value={{ rate, history, updateRate }}>
      {children}
    </CommissionContext.Provider>
  );
}

export function useCommission() {
  const ctx = useContext(CommissionContext);
  if (!ctx) throw new Error('useCommission must be used inside CommissionProvider');
  return ctx;
}
