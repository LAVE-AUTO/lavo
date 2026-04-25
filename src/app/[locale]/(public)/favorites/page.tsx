'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useToast } from '@/context/toast-context';
import { MOCK_STATIONS } from '@/data/stations-mock';

export default function FavoritesPage() {
  const t = useTranslations('favorites');
  const { success: showSuccess } = useToast();

  /* Mock: first 4 stations as favorites */
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    MOCK_STATIONS.slice(0, 4).map((s) => s.id),
  );

  const favorites = MOCK_STATIONS.filter((s) => favoriteIds.includes(s.id));

  const removeFavorite = (id: string) => {
    setFavoriteIds((prev) => prev.filter((fid) => fid !== id));
    showSuccess(t('toast_removed'));
  };

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] pb-24 sm:pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <h1 className="text-[22px] font-black text-[#0A0A14] dark:text-white">{t('title')}</h1>
        <p className="text-[14px] text-[#666] dark:text-[#B0B0A0] mt-1">{t('subtitle')}</p>
      </div>

      <div className="px-4 max-w-2xl mx-auto">
        {favorites.length > 0 ? (
          <div className="space-y-3">
            {favorites.map((station) => {
              const isOpen = station.isOpen !== false;
              return (
                <div
                  key={station.id}
                  className="bg-[#E8E8D8] dark:bg-[#1A1A18] rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-4 hover:border-gold/30 transition-colors"
                >
                  <div className="flex gap-3">
                    {/* Image */}
                    <Link href={`/stations/${station.id}`} className="shrink-0">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#D0D0C0] dark:bg-tab-inactive">
                        {station.imageUrl && (
                          <img src={station.imageUrl} alt={station.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/stations/${station.id}`} className="flex-1 min-w-0">
                          <h3 className="text-[15px] font-bold text-[#0A0A14] dark:text-white leading-tight truncate">
                            {station.name}
                          </h3>
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeFavorite(station.id)}
                          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-lavo-error/10 transition-colors cursor-pointer"
                          title={t('remove')}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                          </svg>
                        </button>
                      </div>

                      <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5 truncate">{station.address}</p>

                      <div className="flex items-center gap-3 mt-2 text-[13px]">
                        <span className="flex items-center gap-1">
                          <span className="text-gold">&#9733;</span>
                          <span className="font-semibold text-[#0A0A14] dark:text-white">{station.rating.toFixed(1)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-lavo-success' : 'bg-lavo-error'}`} />
                          <span className={`font-bold text-[12px] ${isOpen ? 'text-lavo-success' : 'text-lavo-error'}`}>
                            {isOpen ? t('open') : t('closed')}
                          </span>
                        </span>
                        {station.priceFrom != null && (
                          <span className="ml-auto font-bold text-gold">{station.priceFrom}$+</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#E0E0D0] dark:bg-[#1A1A18] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
            <p className="text-[18px] font-black text-[#1A1A1A] dark:text-white">{t('empty_title')}</p>
            <p className="text-[15px] text-[#555] dark:text-[#C0C0B0] max-w-xs">{t('empty_desc')}</p>
            <Link
              href="/stations"
              className="mt-2 px-6 py-2.5 bg-gold hover:bg-gold-hover rounded-lg text-[14px] font-bold text-dark-bg transition-colors"
            >
              {t('explore_stations')}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
