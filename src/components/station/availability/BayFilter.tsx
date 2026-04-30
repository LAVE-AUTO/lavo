import { useTranslations } from 'next-intl';

interface BayFilterProps {
  bays: string[];
  selectedBay: string | null;
  onBayChange: (bay: string | null) => void;
}

export function BayFilter({ bays, selectedBay, onBayChange }: BayFilterProps) {
  const t = useTranslations('station_dashboard');

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#666] dark:text-[#A0A090]">{t('filter_all_posts')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onBayChange(null)}
          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            selectedBay === null
              ? 'bg-[#C09A18] text-[#1A1A0A]'
              : 'bg-[#C09A18]/10 text-[#1A1A0A] hover:bg-[#C09A18]/20 dark:text-[#F0EDD4]'
          }`}
        >
          {t('filter_all_posts')}
        </button>
        {bays.map((bay) => (
          <button
            key={bay}
            type="button"
            onClick={() => onBayChange(bay)}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              selectedBay === bay
                ? 'bg-[#C09A18] text-[#1A1A0A]'
                : 'bg-[#C09A18]/10 text-[#1A1A0A] hover:bg-[#C09A18]/20 dark:text-[#F0EDD4]'
            }`}
          >
            {t('filter_post', { n: bay })}
          </button>
        ))}
      </div>
    </div>
  );
}
