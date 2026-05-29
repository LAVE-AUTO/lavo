'use client';

import { RevealOnScroll } from './RevealOnScroll';

interface Props {
  tag: string;
  title: string;
  titleAccent: string;
  /** Sanitized HTML body (admin-editable). */
  html: string;
}

export function HowItWorksSection({ tag, title, titleAccent, html }: Props) {
  return (
    <section className="landing-alt-bg px-6 py-16 lg:px-16 lg:py-20" id="how-it-works">
      <div className="mx-auto max-w-[1280px]">
        <RevealOnScroll className="text-center">
          <div className="font-dm-mono mb-3 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[3px] text-[#DDAF3B]">
            {tag}
            <span className="h-px w-9 bg-[#DDAF3B] opacity-50" />
          </div>
          <h2 className="font-playfair text-[clamp(34px,3.8vw,52px)] font-bold leading-[1.1] text-[#001201] dark:text-[#FFEECA]">
            {title}{' '}
            <em className="italic text-[#DDAF3B]">{titleAccent}</em>
          </h2>
        </RevealOnScroll>

        <RevealOnScroll>
          <div
            className={[
              'mx-auto mt-10 max-w-3xl text-[14px] sm:text-[15px] text-[var(--foreground)] dark:text-[#a8c2a8] leading-[1.85]',
              '[&_h2]:relative [&_h2]:pl-7 [&_h2]:mt-9 [&_h2]:mb-3 [&_h2]:font-playfair [&_h2]:text-[20px] sm:[&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-[#001201] dark:[&_h2]:text-[#FFEECA]',
              '[&_h2]:before:content-[""] [&_h2]:before:absolute [&_h2]:before:left-0 [&_h2]:before:top-1/2 [&_h2]:before:-translate-y-1/2 [&_h2]:before:h-5 [&_h2]:before:w-1 [&_h2]:before:rounded-full [&_h2]:before:bg-[#DDAF3B]',
              '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[16px] [&_h3]:font-bold [&_h3]:text-[#001201] dark:[&_h3]:text-[#FFEECA]',
              '[&_p]:mb-4',
              '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1.5',
              '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1.5',
              '[&_strong]:text-[#001201] dark:[&_strong]:text-[#FFEECA] [&_strong]:font-bold',
              '[&_a]:text-[#DDAF3B] [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2',
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
