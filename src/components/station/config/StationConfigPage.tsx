'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import { StationConfigForm, type StationConfig, type StationPost } from './StationConfigForm';
import { StationSlotList } from './StationSlotList';
import { SlotModal, type CreatedSlot } from './SlotModal';

// TODO: connect to API once endpoint is available — GET /station/slots does not exist yet
const MOCK_SLOTS: CreatedSlot[] = [];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function StationConfigPage() {
  const t = useTranslations('station_config');
  const { isLoading: authLoading } = useAuth();

  const [config, setConfig] = useState<StationConfig | null>(null);
  const [posts, setPosts] = useState<StationPost[]>([]);
  const [slots, setSlots] = useState<CreatedSlot[]>(MOCK_SLOTS);
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<'add' | 'generate' | null>(null);

  const loadConfig = useCallback(async () => {
    const [ok, data] = await getFromApi('/station/config');
    if (ok) {
      const res = data as { data: { config: StationConfig; posts: StationPost[] } };
      setConfig(res.data.config);
      setPosts(res.data.posts);
    } else {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) loadConfig();
  }, [authLoading, loadConfig]);

  function handleSaved(newConfig: StationConfig, newPosts: StationPost[]) {
    setConfig(newConfig);
    setPosts(newPosts);
  }

  function handleDeleted(id: string) {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  function handleCreated(newSlots: CreatedSlot[]) {
    setSlots((prev) => [...prev, ...newSlots]);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-[#666] dark:text-[#8A8A7A]">
        {t('loading')}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px]" style={{ color: '#EF4444' }}>
        {t('save_error')}
      </div>
    );
  }

  const visibleSlots = slots.filter((s) => s.start_time.startsWith(selectedDate));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-[#E0DCD0] bg-white px-6 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <div className="text-[16px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {t('page_title')}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
        {config && (
          <StationConfigForm config={config} posts={posts} onSaved={handleSaved} />
        )}
        <StationSlotList
          slots={visibleSlots}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onDeleted={handleDeleted}
          onAddSlot={() => setModal('add')}
          onGenerate={() => setModal('generate')}
        />
      </div>

      {modal && (
        <SlotModal
          mode={modal}
          selectedDate={selectedDate}
          onClose={() => setModal(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
