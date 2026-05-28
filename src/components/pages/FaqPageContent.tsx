import { Link } from '@/i18n/navigation';

interface Props {
  /** Sanitized HTML body (admin-editable Q&A). */
  html: string;
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  ctaTitle: string;
  ctaDesc: string;
  ctaBtn: string;
}

export function FaqPageContent({
  html,
  eyebrow,
  title,
  titleAccent,
  subtitle,
  ctaTitle,
  ctaDesc,
  ctaBtn,
}: Props) {
  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 pt-12 pb-20">

      {/* Header */}
      <div className="max-w-2xl mb-12">
        <p className="text-[12px] font-bold tracking-[3px] uppercase text-[#DDAF3B] mb-3">{eyebrow}</p>
        <h1 className="font-playfair text-[36px] sm:text-[48px] font-black text-[#001201] dark:text-white leading-tight mb-4">
          {title} <span className="text-[#DDAF3B]">{titleAccent}</span>
        </h1>
        <p className="text-[15px] sm:text-[16px] text-foreground/70 dark:text-[#A0A090] leading-relaxed">{subtitle}</p>
      </div>

      {/* Admin-editable Q&A body */}
      <div className="mb-14 max-w-3xl">
        <div
          className={[
            'text-[14px] sm:text-[15px] text-foreground/70 dark:text-[#A0A090] leading-[1.85]',
            '[&_h2]:font-playfair [&_h2]:text-[22px] [&_h2]:font-black [&_h2]:text-[#001201] dark:[&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-3',
            '[&_h3]:relative [&_h3]:pl-5 [&_h3]:text-[16px] sm:[&_h3]:text-[17px] [&_h3]:font-bold [&_h3]:text-[#001201] dark:[&_h3]:text-white [&_h3]:mt-8 [&_h3]:mb-2',
            '[&_h3]:before:content-[""] [&_h3]:before:absolute [&_h3]:before:left-0 [&_h3]:before:top-1/2 [&_h3]:before:-translate-y-1/2 [&_h3]:before:h-4 [&_h3]:before:w-1 [&_h3]:before:rounded-full [&_h3]:before:bg-[#DDAF3B]',
            '[&_p]:mb-4',
            '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1.5',
            '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1.5',
            '[&_strong]:text-[#001201] dark:[&_strong]:text-white [&_strong]:font-bold',
            '[&_a]:text-[#DDAF3B] [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2',
          ].join(' ')}
          // Sanitized server-side via DOMPurify before persistence.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Still have questions */}
      <div className="border border-[rgba(221,175,59,0.2)] rounded-2xl p-8 sm:p-10 text-center max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <h2 className="text-[20px] font-black text-[#001201] dark:text-white mb-2">{ctaTitle}</h2>
        <p className="text-[14px] text-foreground/70 dark:text-[#A0A090] mb-5">{ctaDesc}</p>
        <Link
          href={`/nous-contacter` as Parameters<typeof Link>[0]['href']}
          className="inline-block px-6 py-3 bg-gold hover:bg-gold-hover text-dark-bg text-[14px] font-bold rounded-xl transition-colors btn-shine"
        >
          {ctaBtn}
        </Link>
      </div>
    </div>
  );
}
