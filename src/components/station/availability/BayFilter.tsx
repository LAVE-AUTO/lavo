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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/65 dark:text-[#A0A090]">{t('filter_all_posts')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onBayChange(null)}
          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            selectedBay === null
              ? 'bg-[#DDAF3B] text-[#001201]'
              : 'bg-[#DDAF3B]/10 text-[#001201] hover:bg-[#DDAF3B]/20 dark:text-[#FFF9EC]'
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
                ? 'bg-[#DDAF3B] text-[#001201]'
                : 'bg-[#DDAF3B]/10 text-[#001201] hover:bg-[#DDAF3B]/20 dark:text-[#FFF9EC]'
            }`}
          >
            {t('filter_post', { n: bay })}
          </button>
        ))}
      </div>
    </div>
  );
}
