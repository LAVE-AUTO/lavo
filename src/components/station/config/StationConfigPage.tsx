'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import type { StationConfig, StationPost } from './types';
import type { StationProfile } from './StationProfileForm';
import type { StationLocation } from './StationLocationForm';
import { ConfigTabs, type ConfigTab, type ConfigTabId } from './ConfigTabs';
import { CommerceIcon, HoursIcon, CapacityIcon, NotificationsIcon, PaymentsIcon } from './tab-icons';
import { CommerceTab } from './tabs/CommerceTab';
import { CapacityTab } from './tabs/CapacityTab';
import { HoursTab } from './tabs/HoursTab';
import { NotificationsTab } from './tabs/NotificationsTab';
import { PaymentsTab } from './tabs/PaymentsTab';
import { PageLoader } from '@/components/ui/PageLoader';

const EMPTY_CONFIG: StationConfig = {
  id: '',
  opening_time: null,
  closing_time: null,
  break_start: null,
  break_end: null,
  wash_duration_minutes: null,
  wash_post_count: null,
  late_tolerance_minutes: null,
  cancellation_delay_minutes: null,
  max_concurrent_posts: null,
  margin_before_minutes: null,
  margin_after_minutes: null,
  reservation_surcharge: null,
};

const EMPTY_PROFILE: StationProfile = { name: '', description: null, service_scope: null };
const EMPTY_LOCATION: StationLocation = { address: '', city: '', latitude: null, longitude: null };

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

  const [config, setConfig] = useState<StationConfig>(EMPTY_CONFIG);
  const [posts, setPosts] = useState<StationPost[]>([]);
  const [profile, setProfile] = useState<StationProfile>(EMPTY_PROFILE);
  const [location, setLocation] = useState<StationLocation>(EMPTY_LOCATION);
  const [loading, setLoading] = useState(true);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigTabId>('commerce');

  const loadData = useCallback(async () => {
    // /station/config and /station/me are independent — fetch in parallel
    const [[configOk, configData], [meOk, meData]] = await Promise.all([
      getFromApi('/station/config'),
      getFromApi('/station/me'),
    ]);

    // Station not yet approved — all station API calls return 403 BUSINESS_NOT_APPROVED
    if (!configOk && (configData as { code?: string }).code === 'BUSINESS_NOT_APPROVED') {
      setIsPendingApproval(true);
      setLoading(false);
      return;
    }

    if (configOk) {
      const res = configData as { data: { config: StationConfig; posts: StationPost[] } };
      setConfig(res.data.config);
      setPosts(res.data.posts);
    }

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

  const tabs: ConfigTab[] = [
    { id: 'commerce', label: t('tab_commerce'), icon: <CommerceIcon /> },
    { id: 'hours', label: t('tab_hours'), icon: <HoursIcon /> },
    { id: 'capacity', label: t('tab_capacity'), icon: <CapacityIcon /> },
    { id: 'notifications', label: t('tab_notifications'), icon: <NotificationsIcon /> },
    { id: 'payments', label: t('tab_payments'), icon: <PaymentsIcon /> },
  ];

  if (loading) {
    return <PageLoader label={t('loading')} />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-[#E0DCD0] bg-white px-6 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <div className="text-[16px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {t('page_title')}
        </div>
      </div>

      <ConfigTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
          {/* Pending approval banner */}
          {isPendingApproval && (
            <div className="flex items-start gap-4 rounded-xl border border-[#C49A1E]/25 bg-[#C49A1E]/8 px-5 py-4 dark:border-[#C49A1E]/20 dark:bg-[#C49A1E]/5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C49A1E]/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#8A6A00] dark:text-[#C49A1E]">{t('pending_banner_title')}</p>
                <p className="mt-0.5 text-[13px] text-[#8A6A00]/80 dark:text-[#C49A1E]/70">{t('pending_banner_desc')}</p>
              </div>
            </div>
          )}

          <div
            id={`config-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`config-tab-${activeTab}`}
          >
            {activeTab === 'commerce' && (
              <CommerceTab
                profile={profile}
                location={location}
                locked={isPendingApproval}
                onProfileSaved={setProfile}
                onLocationSaved={setLocation}
              />
            )}
            {activeTab === 'hours' && (
              <HoursTab config={config} locked={isPendingApproval} />
            )}
            {activeTab === 'capacity' && (
              <CapacityTab
                config={config}
                posts={posts}
                locked={isPendingApproval}
                onSaved={(c, p) => {
                  setConfig(c);
                  setPosts(p);
                }}
              />
            )}
            {activeTab === 'notifications' && <NotificationsTab locked={isPendingApproval} />}
            {activeTab === 'payments' && <PaymentsTab locked={isPendingApproval} />}
          </div>
        </div>
      </div>
    </div>
  );
}
