'use client';

import { useTranslations } from 'next-intl';

export function MerchantMarqueeBanner() {
  const t = useTranslations('merchant.marquee');

  const items = [
    t('item_1'), t('item_2'), t('item_3'), t('item_4'),
    t('item_5'), t('item_6'), t('item_7'),
    t('item_1'), t('item_2'), t('item_3'), t('item_4'),
    t('item_5'), t('item_6'), t('item_7'),
  ];

  return (
    <div className="overflow-hidden bg-[#DDAF3B] py-3.5 whitespace-nowrap">
      <div className="animate-marquee">
        {items.map((item, i) => (
          <span
            key={i}
            className="font-dm-mono mr-10 inline-flex items-center gap-3.5 text-[11px] font-medium uppercase tracking-[2px] text-[#001201]"
          >
            {item}
            <span className="inline-block h-1 w-1 rounded-full bg-[#001201] opacity-35" />
          </span>
        ))}
      </div>
    </div>
  );
}
