'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';

interface RawEntry {
  id: string;
  user_id: string;
  entry_type: 'reservation' | 'queue';
  status: string;
  amount_paid: string | null;
  created_at: string;
  completed_at: string | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  in_progress: { label: 'En cours', color: '#2ECC71', bg: 'rgba(46,204,113,0.12)' },
  completed: { label: 'Terminé', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  cancelled: { label: 'Annulé', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

export default function StationReservationsPage() {
  const t = useTranslations('station_dashboard');
  const [entries, setEntries] = useState<RawEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [ok, data] = await getFromApi('/station/entries');
    if (ok) {
      const raw = (data as { data: RawEntry[] }).data ?? [];
      setEntries(raw.filter((e) => e.entry_type === 'reservation'));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: '#0C1209' }}>
      <div className="border-b px-6 py-4" style={{ borderColor: '#1A2A14', background: '#111A0E' }}>
        <h1 className="text-[18px] font-black" style={{ color: '#F0EDD4' }}>{t('nav_reservations')}</h1>
        <p className="text-[12px]" style={{ color: '#8A8A7A' }}>{entries.length} réservation{entries.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[13px]" style={{ color: '#8A8A7A' }}>Chargement...</div>
        ) : entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px]" style={{ color: '#8A8A7A' }}>Aucune réservation</div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => {
              const st = STATUS_LABEL[entry.status] ?? STATUS_LABEL.pending;
              const date = new Date(entry.created_at).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <div key={entry.id} className="flex items-center justify-between rounded-xl p-4" style={{ background: '#111A0E', border: '1px solid #1A2A14' }}>
                  <div>
                    <div className="text-[13px] font-bold" style={{ color: '#F0EDD4' }}>
                      Client #{entry.user_id.slice(0, 8)}
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: '#8A8A7A' }}>
                      {date} {entry.amount_paid ? `• ${parseFloat(entry.amount_paid)}$` : ''}
                    </div>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-bold"
                    style={{ background: st.bg, color: st.color }}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
