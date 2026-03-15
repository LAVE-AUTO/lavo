'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import { StationConfigForm, type StationConfig, type StationPost } from './StationConfigForm';
import { StationProfileForm, type StationProfile } from './StationProfileForm';
import { StationLocationForm, type StationLocation } from './StationLocationForm';
import { StationSlotList } from './StationSlotList';
import { SlotModal, type CreatedSlot } from './SlotModal';
import { StationExtrasForm, type StationExtras } from './StationExtrasForm';

// TODO: connect to API once endpoint is available — GET /station/slots does not exist yet
const MOCK_SLOTS: CreatedSlot[] = [];

// Fallback config used when GET /station/config is unavailable
const MOCK_CONFIG: StationConfig = {
  id: 'mock',
  opening_time: '08:00',
  closing_time: '20:00',
  break_start: '12:00',
  break_end: '13:00',
  wash_duration_minutes: 30,
  late_tolerance_minutes: 10,
  cancellation_delay_minutes: 60,
  max_concurrent_posts: 3,
  margin_before_minutes: 5,
  margin_after_minutes: 5,
  reservation_surcharge: '2.00',
};

const MOCK_POSTS: StationPost[] = [
  { id: 'post-1', position: 1, is_active: true },
  { id: 'post-2', position: 2, is_active: true },
  { id: 'post-3', position: 3, is_active: false },
];

const MOCK_PROFILE: StationProfile = { name: 'Station', description: null, service_scope: null };
const MOCK_LOCATION: StationLocation = { address: '', city: '', latitude: null, longitude: null };
const MOCK_EXTRAS: StationExtras = { exterior: [], interior: [], both: [] };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface StationMeData {
  data: {
    name: string;
    description: string | null;
    service_scope: string | null;
    address: string;
    city: string;
    latitude: string | null;
    longitude: string | null;
  };
}

export function StationConfigPage() {
  const t = useTranslations('station_config');
  const { isLoading: authLoading } = useAuth();

  const [config, setConfig] = useState<StationConfig>(MOCK_CONFIG);
  const [posts, setPosts] = useState<StationPost[]>(MOCK_POSTS);
  const [profile, setProfile] = useState<StationProfile>(MOCK_PROFILE);
  const [location, setLocation] = useState<StationLocation>(MOCK_LOCATION);
  const [extras, setExtras] = useState<StationExtras>(MOCK_EXTRAS);
  const [slots, setSlots] = useState<CreatedSlot[]>(MOCK_SLOTS);
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'generate' | null>(null);

  const loadData = useCallback(async () => {
    const [configOk, configData] = await getFromApi('/station/config');
    if (configOk) {
      const res = configData as { data: { config: StationConfig; posts: StationPost[] } };
      setConfig(res.data.config);
      setPosts(res.data.posts);
    }

    const [meOk, meData] = await getFromApi('/station/me');
    if (meOk) {
      const res = meData as StationMeData;
      setProfile({
        name: res.data.name,
        description: res.data.description,
        service_scope: res.data.service_scope,
      });
      setLocation({
        address: res.data.address,
        city: res.data.city,
        latitude: res.data.latitude,
        longitude: res.data.longitude,
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-[#666] dark:text-[#8A8A7A]">
        {t('loading')}
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
        <StationProfileForm profile={profile} onSaved={setProfile} />
        <StationLocationForm location={location} onSaved={setLocation} />
        <StationConfigForm
          config={config}
          posts={posts}
          onSaved={(c, p) => {
            setConfig(c);
            setPosts(p);
          }}
        />
        <StationExtrasForm extras={extras} onSaved={setExtras} />
        <StationSlotList
          slots={visibleSlots}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onDeleted={(id) => setSlots((prev) => prev.filter((s) => s.id !== id))}
          onAddSlot={() => setModal('add')}
          onGenerate={() => setModal('generate')}
        />
      </div>

      {modal && (
        <SlotModal
          mode={modal}
          selectedDate={selectedDate}
          onClose={() => setModal(null)}
          onCreated={(newSlots) => setSlots((prev) => [...prev, ...newSlots])}
        />
      )}
    </div>
  );
}
