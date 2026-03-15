'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import { FormatCard } from './FormatCard';
import { FormatModal, type VehicleFormat } from './FormatModal';

interface StationMeData {
  data: { id: string };
}

interface FormatsData {
  data: VehicleFormat[];
}

export function StationFormatsPage() {
  const t = useTranslations('station_formats');
  const { isLoading: authLoading } = useAuth();

  const [formats, setFormats] = useState<VehicleFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalFormat, setModalFormat] = useState<VehicleFormat | null | 'new'>(null);

  const loadFormats = useCallback(async () => {
    const [meOk, meData] = await getFromApi('/station/me');
    if (!meOk) {
      setLoading(false);
      return;
    }

    const stationId = (meData as StationMeData).data.id;
    const [formatsOk, formatsData] = await getFromApi(`/stations/${stationId}/formats`);
    if (formatsOk) {
      setFormats((formatsData as FormatsData).data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) loadFormats();
  }, [authLoading, loadFormats]);

  function handleSaved(saved: VehicleFormat) {
    setFormats((prev) => {
      const exists = prev.findIndex((f) => f.id === saved.id);
      if (exists !== -1) {
        const next = [...prev];
        next[exists] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setModalFormat(null);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-[#666] dark:text-[#8A8A7A]">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="border-b border-[#E0DCD0] bg-white px-6 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
            {t('page_title')}
          </div>
          <button
            type="button"
            onClick={() => setModalFormat('new')}
            className="flex items-center gap-2 rounded-[10px] bg-[#C49A1E] px-4 py-2 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('btn_add')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
        {formats.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <span className="text-[14px] font-semibold text-[#999] dark:text-[#6A6A5A]">
              {t('empty')}
            </span>
            <span className="text-[12px] text-[#BBBBAA] dark:text-[#4A4A3A]">
              {t('empty_hint')}
            </span>
          </div>
        ) : (
          formats.map((format) => (
            <FormatCard
              key={format.id}
              format={format}
              onEdit={(f) => setModalFormat(f)}
              onDeleted={(id) => setFormats((prev) => prev.filter((f) => f.id !== id))}
              onToggled={(updated) =>
                setFormats((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
              }
            />
          ))
        )}
      </div>

      {/* Add / Edit modal */}
      {modalFormat !== null && (
        <FormatModal
          format={modalFormat === 'new' ? null : modalFormat}
          onClose={() => setModalFormat(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
