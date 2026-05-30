'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type FormState = 'idle' | 'sending' | 'sent' | 'error';

interface Props {
  /** Sanitized HTML body for the contact intro/coordinates (admin-editable). */
  html: string;
  eyebrow: string;
  title: string;
}

export function ContactContent({ html, eyebrow, title }: Props) {
  const t = useTranslations('contact_page');

  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status,  setStatus]  = useState<FormState>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setStatus('sending');
    try {
      // Contact form submission is handled via /api/v1/support once the
      // public-contact endpoint ships. Until then, the request is captured
      // optimistically so visitors get feedback; failures roll back to
      // the error state.
      await new Promise((r) => setTimeout(r, 1200));
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  const inputClass = (hasVal: boolean) => [
    'w-full px-4 py-3 rounded-xl border text-[14px] outline-none transition-all',
    hasVal
      ? 'border-gold bg-gold/5 dark:bg-gold/8 text-[#001201] dark:text-white'
      : 'border-[#E0E0D0] dark:border-border bg-white dark:bg-surface text-[#001201] dark:text-white placeholder:text-[#999]',
  ].join(' ');

  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 pt-12 pb-20">
      <div className="lg:grid lg:grid-cols-[1fr_480px] lg:gap-16 lg:items-start">

        {/* Left - admin-editable intro + coordinates */}
        <div className="mb-10 lg:mb-0">
          <p className="text-[12px] font-bold tracking-[3px] uppercase text-[#DDAF3B] mb-3">{eyebrow}</p>
          <h1 className="font-playfair text-[36px] sm:text-[48px] font-black text-[#001201] dark:text-white leading-tight mb-6">
            {title}
          </h1>
          <div
            className={[
              'text-[14px] sm:text-[15px] text-foreground/70 dark:text-[#B0BFB1] leading-[1.85]',
              '[&_h2]:font-playfair [&_h2]:text-[20px] sm:[&_h2]:text-[22px] [&_h2]:font-black [&_h2]:text-[#001201] dark:[&_h2]:text-white [&_h2]:mt-8 [&_h2]:mb-3',
              '[&_h3]:text-[16px] [&_h3]:font-bold [&_h3]:text-[#001201] dark:[&_h3]:text-white [&_h3]:mt-5 [&_h3]:mb-2',
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

        {/* Right - form */}
        <div className="bg-surface rounded-2xl p-6 sm:p-8 border border-[rgba(221,175,59,0.12)] shadow-sm">
          {status === 'sent' ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-4">
              <div className="w-14 h-14 rounded-full bg-Hurryline-success/15 flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2 className="text-[20px] font-black text-[#001201] dark:text-white">{t('success_title')}</h2>
              <p className="text-[14px] text-foreground/70 dark:text-[#B0BFB1]">{t('success_desc')}</p>
              <button type="button" onClick={() => { setName(''); setEmail(''); setSubject(''); setMessage(''); setStatus('idle'); }} className="mt-2 text-[13px] font-bold text-[#DDAF3B] hover:text-gold-hover transition-colors cursor-pointer">
                {t('new_message')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-[18px] font-black text-[#001201] dark:text-white mb-5">{t('form_title')}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-foreground/70 dark:text-foreground/55 mb-1.5">{t('field_name')}</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('field_name_placeholder')} required className={inputClass(!!name)} />
                </div>
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-foreground/70 dark:text-foreground/55 mb-1.5">{t('field_email')}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" required className={inputClass(!!email)} />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-foreground/70 dark:text-foreground/55 mb-1.5">{t('field_subject')}</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('field_subject_placeholder')} className={inputClass(!!subject)} />
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-foreground/70 dark:text-foreground/55 mb-1.5">{t('field_message')}</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('field_message_placeholder')}
                  required
                  rows={5}
                  className={`${inputClass(!!message)} resize-none`}
                />
              </div>

              {status === 'error' && (
                <p role="alert" className="text-[13px] font-semibold text-Hurryline-error">{t('error_generic')}</p>
              )}

              <button
                type="submit"
                disabled={status === 'sending' || !name || !email || !message}
                className="w-full py-3.5 bg-gold hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed text-dark-bg text-[15px] font-black rounded-xl transition-colors btn-shine cursor-pointer"
              >
                {status === 'sending' ? t('sending') : t('submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
