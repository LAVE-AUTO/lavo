'use client';

import { useTranslations } from 'next-intl';
import { RevealOnScroll } from './RevealOnScroll';

const NOTIF_ICONS = [
  <svg key="bell" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>,
  <svg key="clock" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>,
  <svg key="check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>,
  <svg key="star" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>,
];

const PHONE_ICONS = [
  <svg key="bell2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>,
  <svg key="alarm" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="8" /><polyline points="12 9 12 13 15 14" /><path d="M5 3 2 6M22 6l-3-3" />
  </svg>,
  <svg key="check2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>,
  <svg key="card" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>,
];

export function NotificationsSection() {
  const t = useTranslations('home.notifications');

  const features = [
    { title: t('feat_1_title'), desc: t('feat_1_desc') },
    { title: t('feat_2_title'), desc: t('feat_2_desc') },
    { title: t('feat_3_title'), desc: t('feat_3_desc') },
    { title: t('feat_4_title'), desc: t('feat_4_desc') },
  ];

  const notifs = [
    { title: t('notif_1_title'), body: t('notif_1_body'), time: t('notif_1_time') },
    { title: t('notif_2_title'), body: t('notif_2_body'), time: t('notif_2_time'), hasActions: true },
    { title: t('notif_3_title'), body: t('notif_3_body'), time: t('notif_3_time'), hasStars: true },
    { title: t('notif_4_title'), body: t('notif_4_body'), time: t('notif_4_time') },
  ];

  return (
    <section className="landing-alt-bg px-6 py-28 lg:px-16" id="notifications">
      <div className="mx-auto max-w-[1280px]">
        <RevealOnScroll>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-[72px] items-center">
            {/* Left: text + features */}
            <div>
              <div className="font-dm-mono mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[3px] text-[#c8980a]">
                {t('tag')}
                <span className="h-px w-9 bg-[#c8980a] opacity-50" />
              </div>
              <h2 className="font-playfair mb-5 text-[clamp(34px,3.8vw,52px)] font-bold leading-[1.1] text-[#1a1a1a] dark:text-[#fef9e7]">
                {t('title')}{' '}
                <em className="italic text-[#c8980a]">{t('title_accent')}</em>
              </h2>
              <p className="mb-9 text-[16px] leading-[1.75] text-[#4a6a4d] dark:text-[#7a9a7d]">
                {t('desc')}
              </p>

              <div className="flex flex-col gap-3.5">
                {features.map((feat, i) => (
                  <div
                    key={feat.title}
                    className="flex items-center gap-4 rounded-[10px] border border-[rgba(200,152,10,0.1)] bg-[rgba(245,237,214,0.03)] px-4 py-4 transition-all duration-300 hover:border-[rgba(200,152,10,0.35)] hover:bg-[rgba(200,152,10,0.05)]"
                  >
                    <div className="flex-shrink-0">{NOTIF_ICONS[i]}</div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#1a1a1a] dark:text-[#fef9e7]">
                        {feat.title}
                      </div>
                      <div className="text-[12px] text-[#4a6a4d] dark:text-[#7a9a7d]">{feat.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: phone mockup with notifications */}
            <div className="flex justify-center">
              <div className="w-[260px] rounded-[24px] border-2 border-[rgba(200,152,10,0.2)] bg-[#162218] p-4 shadow-[0_30px_60px_rgba(0,0,0,0.5)] flex flex-col gap-2.5">
                <div className="font-playfair py-1 text-center text-[16px] font-black tracking-[3px] text-[#c8980a]">
                  Slowtime
                </div>

                {notifs.map((notif, i) => (
                  <div key={notif.title} className="flex gap-2.5 items-start rounded-[10px] bg-[#f5edd6] px-3.5 py-3">
                    <div className="mt-0.5 flex-shrink-0">{PHONE_ICONS[i]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-[#3d2a10] mb-0.5">{notif.title}</div>
                      <div className="text-[10px] leading-[1.5] text-[rgba(61,42,16,0.55)]">{notif.body}</div>
                      {notif.hasActions && (
                        <div className="mt-2 flex gap-1.5">
                          <span className="rounded-[4px] bg-[#c8980a] px-2.5 py-1 text-[9px] font-bold text-[#0d1f0f]">
                            {t('btn_confirm')}
                          </span>
                          <span className="rounded-[4px] bg-[rgba(61,42,16,0.12)] px-2.5 py-1 text-[9px] font-semibold text-[#3d2a10]">
                            {t('btn_delay')}
                          </span>
                        </div>
                      )}
                      {notif.hasStars && (
                        <div className="mt-1.5 text-[14px] text-[#c8980a]">★★★★★</div>
                      )}
                      <div className="mt-1 text-right text-[9px] text-[rgba(61,42,16,0.35)]">{notif.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
