import { getLegalContent } from '@/server/admin/legal-content-service';
import type { LegalContentKey } from '@/validators/legal-content';
import { Link } from '@/i18n/navigation';

interface Props {
  contentKey: LegalContentKey;
  locale: 'fr' | 'en';
  eyebrow: string;
  title: string;
  updated?: string;
  questions?: string;
  contactBtn?: string;
}

/**
 * Renders the admin-editable HTML for a legal/landing page inside the
 * shared chrome (eyebrow, title, optional "updated" date, "questions?"
 * footer with contact CTA). Content is fetched server-side via
 * getLegalContent which transparently falls back to the bundled defaults
 * when no admin override exists.
 *
 * The HTML is sanitized server-side before persistence (see
 * `legal-content-service.updateLegalContent`), so it is safe to inject.
 */
export async function LegalContentRenderer({
  contentKey,
  locale,
  eyebrow,
  title,
  updated,
  questions,
  contactBtn,
}: Props) {
  const html = (await getLegalContent(contentKey, { withDefault: true, locale })) ?? '';

  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 pt-12 pb-20">
      <div className="max-w-3xl">

        {/* Header */}
        <p className="text-[12px] font-bold tracking-[3px] uppercase text-[#DDAF3B] mb-3">{eyebrow}</p>
        <h1 className="font-playfair text-[36px] sm:text-[44px] font-black text-[#001201] dark:text-white leading-tight mb-3">
          {title}
        </h1>
        {updated && (
          <p className="text-[13px] text-foreground/55 dark:text-foreground/65 mb-10">{updated}</p>
        )}

        {/* Body — admin-editable HTML */}
        <div
          className={[
            'text-[14px] sm:text-[15px] text-foreground/70 dark:text-[#B0BFB1] leading-[1.85]',
            '[&_h2]:font-playfair [&_h2]:text-[20px] sm:[&_h2]:text-[22px] [&_h2]:font-black [&_h2]:text-[#001201] dark:[&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-3',
            '[&_h3]:text-[17px] [&_h3]:font-bold [&_h3]:text-[#001201] dark:[&_h3]:text-white [&_h3]:mt-6 [&_h3]:mb-2',
            '[&_p]:mb-4',
            '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1.5',
            '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1.5',
            '[&_li]:leading-relaxed',
            '[&_strong]:text-[#001201] dark:[&_strong]:text-white [&_strong]:font-bold',
            '[&_a]:text-[#DDAF3B] [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-80',
            '[&_blockquote]:border-l-4 [&_blockquote]:border-[rgba(221,175,59,0.4)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-5 [&_blockquote]:text-foreground/65 dark:[&_blockquote]:text-[#B0BFB1]',
            '[&_code]:bg-[rgba(221,175,59,0.08)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono dark:[&_code]:bg-[rgba(221,175,59,0.12)]',
            '[&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[rgba(221,175,59,0.2)] [&_hr]:my-8',
          ].join(' ')}
          // The HTML is sanitized server-side before storage via DOMPurify.
          // See src/server/admin/legal-content-service.ts#updateLegalContent.
           
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Contact CTA */}
        {(questions || contactBtn) && (
          <div className="mt-12 pt-8 border-t border-[rgba(221,175,59,0.15)] flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {questions && (
              <p className="text-[14px] text-foreground/70 dark:text-[#B0BFB1]">{questions}</p>
            )}
            {contactBtn && (
              <Link
                href={`/nous-contacter` as Parameters<typeof Link>[0]['href']}
                className="shrink-0 px-5 py-2.5 bg-gold hover:bg-gold-hover text-dark-bg text-[13px] font-bold rounded-xl transition-colors"
              >
                {contactBtn}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
