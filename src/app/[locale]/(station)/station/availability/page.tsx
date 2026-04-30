'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/auth-context';
import { getFromApi } from '@/services';
import { AvailabilityViewToggle } from '@/components/station/availability/AvailabilityViewToggle';
import { MonthCalendar } from '@/components/station/availability/MonthCalendar';
import { WeekView } from '@/components/station/availability/WeekView';
import { DaySlotsList } from '@/components/station/availability/DaySlotsList';
import { AvailabilitySkeleton } from '@/components/station/availability/AvailabilitySkeleton';

export default function StationAvailabilityPage() {
  const t = useTranslations('station_dashboard');
  useAuth(); // ensure auth context is initialized
  const [viewType, setViewType] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const dateStr = selectedDate.toISOString().split('T')[0];
        const [success, data] = await getFromApi(`/station/slots?date=${dateStr}`);

        if (mountedRef.current) {
          if (success) {
            setSlots(data?.data || []);
          } else {
            setError(data?.error || t('error_queue_empty'));
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Fetch slots error:', err);
        if (mountedRef.current) {
          setError(t('error_queue_empty'));
          setIsLoading(false);
        }
      }
    };

    fetchSlots();
  }, [selectedDate, t]);

  if (isLoading) {
    return <AvailabilitySkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('availability_title')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('availability_subtitle')}</p>
      </div>

      {/* View Toggle */}
      <AvailabilityViewToggle value={viewType} onChange={setViewType} />

      {/* Error Message */}
      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      {/* Calendar / Week View */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {viewType === 'month' ? <MonthCalendar selectedDate={selectedDate} onChange={setSelectedDate} /> : <WeekView selectedDate={selectedDate} onChange={setSelectedDate} />}
        </div>

        {/* Slots List */}
        <div className="lg:col-span-2">
          <DaySlotsList date={selectedDate} slots={slots} onSlotsChange={setSlots} />
        </div>
      </div>
    </div>
  );
}
