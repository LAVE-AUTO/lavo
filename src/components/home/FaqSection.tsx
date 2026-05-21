'use client';

import { RevealOnScroll } from './RevealOnScroll';

interface Props {
  tag: string;
  title: string;
  titleAccent: string;
  /** Sanitized HTML body (admin-editable). */
  html: string;
}

export function FaqSection({ tag, title, titleAccent, html }: Props) {
  return (
    <section className="landing-alt-bg px-6 py-16 lg:px-16 lg:py-20" id="faq">
      <div className="mx-auto max-w-[1280px]">
        <RevealOnScroll className="text-center mb-2">
          <div className="font-dm-mono mb-3 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[3px] text-[#c8980a]">
            {tag}
            <span className="h-px w-9 bg-[#c8980a] opacity-50" />
          </div>
          <h2 className="font-playfair text-[clamp(34px,3.8vw,52px)] font-bold leading-[1.1] text-[#1a1a1a] dark:text-[#fef9e7]">
            {title}{' '}
            <em className="italic text-[#c8980a]">{titleAccent}</em>
          </h2>
        </RevealOnScroll>

        <RevealOnScroll>
          <div
            className={[
              'mx-auto mt-10 max-w-3xl text-[14px] sm:text-[15px] text-[#4a6a4d] dark:text-[#a8c2a8] leading-[1.85]',
              '[&_h2]:font-playfair [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-[#1a1a1a] dark:[&_h2]:text-[#fef9e7] [&_h2]:mt-10 [&_h2]:mb-3',
              '[&_h3]:relative [&_h3]:pl-6 [&_h3]:mt-8 [&_h3]:mb-2.5 [&_h3]:text-[16px] sm:[&_h3]:text-[17px] [&_h3]:font-bold [&_h3]:text-[#1a1a1a] dark:[&_h3]:text-[#fef9e7]',
              '[&_h3]:before:content-[""] [&_h3]:before:absolute [&_h3]:before:left-0 [&_h3]:before:top-1/2 [&_h3]:before:-translate-y-1/2 [&_h3]:before:h-4 [&_h3]:before:w-1 [&_h3]:before:rounded-full [&_h3]:before:bg-[#c8980a]',
              '[&_p]:mb-4',
              '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1.5',
              '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1.5',
              '[&_strong]:text-[#1a1a1a] dark:[&_strong]:text-[#fef9e7] [&_strong]:font-bold',
              '[&_a]:text-[#c8980a] [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2',
            ].join(' ')}
            // Sanitized server-side via DOMPurify before persistence.
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </RevealOnScroll>
      </div>
    </section>
  );
}
