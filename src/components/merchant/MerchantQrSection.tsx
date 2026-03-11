'use client';

import { useTranslations } from 'next-intl';
import { RevealOnScroll } from '@/components/home/RevealOnScroll';

const QR_ICONS = [
  /* Store */
  <svg key="store" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l1-5h16l1 5" /><path d="M3 9a2 2 0 0 0 2 2 2 2 0 0 0 2-2 2 2 0 0 0 2 2 2 2 0 0 0 2-2 2 2 0 0 0 2 2 2 2 0 0 0 2-2" />
    <rect x="5" y="14" width="4" height="7" /><rect x="10" y="14" width="9" height="7" rx="1" />
  </svg>,
  /* Share */
  <svg key="share" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>,
  /* Gift */
  <svg key="gift" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>,
];

function QrCodePlaceholder() {
  const size = 120;
  const cell = size / 12;
  const pattern = [
    [1,1,1,1,1,1,1,0,1,0,0,0],
    [1,0,0,0,0,0,1,0,0,1,1,0],
    [1,0,1,1,1,0,1,0,1,0,1,0],
    [1,0,1,1,1,0,1,0,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,0],
    [1,0,0,0,0,0,1,0,0,0,1,1],
    [1,1,1,1,1,1,1,0,1,0,1,0],
    [0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,1,0,1,1,0,1,1,1,0],
    [0,1,0,0,1,0,0,1,0,0,1,1],
    [1,1,0,1,0,1,0,0,1,0,0,0],
    [0,0,1,1,1,0,1,0,0,1,1,1],
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {pattern.map((row, r) =>
        row.map((cell_val, c) =>
          cell_val ? (
            <rect
              key={`${r}-${c}`}
              x={c * cell}
              y={r * cell}
              width={cell - 0.5}
              height={cell - 0.5}
              fill="#3d2a10"
              rx="0.5"
            />
          ) : null
        )
      )}
    </svg>
  );
}

export function MerchantQrSection() {
  const t = useTranslations('merchant.qr');

  const uses = [
    { title: t('use_1_title'), desc: t('use_1_desc') },
    { title: t('use_2_title'), desc: t('use_2_desc') },
    { title: t('use_3_title'), desc: t('use_3_desc') },
  ];

  return (
    <RevealOnScroll>
      <section className="landing-alt-bg px-6 py-28 lg:px-16" id="qr">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-20 items-center">
            {/* Left */}
            <div>
              <div className="font-dm-mono mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[3px] text-[#c8980a]">
                {t('tag')}
                <span className="h-px w-9 bg-[#c8980a] opacity-50" />
              </div>
              <h2 className="font-playfair mb-5 text-[clamp(32px,3.6vw,50px)] font-bold leading-[1.1] text-[#1a1a1a] dark:text-[#fef9e7]">
                {t('title')}{' '}
                <em className="italic text-[#c8980a]">{t('title_accent')}</em>
              </h2>
              <p className="mb-10 text-[15px] leading-[1.8] text-[#4a6a4d] dark:text-[#7a9a7d] max-w-[420px]">
                {t('desc')}
              </p>
              <div className="flex flex-col gap-5">
                {uses.map((use, i) => (
                  <div key={use.title} className="flex items-start gap-4">
                    <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] border border-[rgba(200,152,10,0.3)] bg-[rgba(200,152,10,0.1)]">
                      {QR_ICONS[i]}
                    </div>
                    <div>
                      <div className="mb-0.5 text-[14px] font-bold text-[#1a1a1a] dark:text-[#fef9e7]">{use.title}</div>
                      <div className="text-[13px] leading-[1.6] text-[#4a6a4d] dark:text-[#7a9a7d]">{use.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — QR poster mockup */}
            <div className="flex items-center justify-center">
              <div className="animate-float max-w-[260px] w-full rounded-2xl bg-[#f5edd6] p-7 text-center shadow-[0_30px_80px_rgba(0,0,0,0.3)]">
                <div className="font-playfair mb-1 text-[26px] font-black text-[#c8980a] tracking-[3px]">Slowtime</div>
                <div className="mb-5 text-[13px] font-semibold text-[#3d2a10]">AutoSpa Premium</div>
                <div className="mb-5 flex items-center justify-center">
                  <QrCodePlaceholder />
                </div>
                <div className="font-dm-mono text-[10px] uppercase tracking-[2px] text-[#7a9a7d]">
                  {t('poster_tagline')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </RevealOnScroll>
  );
}
