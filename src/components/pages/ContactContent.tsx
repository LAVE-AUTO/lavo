'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

type FormState = 'idle' | 'sending' | 'sent' | 'error';

export function ContactContent() {
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
      // TODO: connect to API once endpoint is available (POST /support or /contact)
      await new Promise((r) => setTimeout(r, 1200));
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  const inputClass = (hasVal: boolean) => [
    'w-full px-4 py-3 rounded-xl border text-[14px] outline-none transition-all',
    hasVal
      ? 'border-gold bg-gold/5 dark:bg-gold/8 text-[#1a1a1a] dark:text-white'
      : 'border-[#E0E0D0] dark:border-tab-inactive bg-white dark:bg-dark-card text-[#1a1a1a] dark:text-white placeholder:text-[#999]',
  ].join(' ');

  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 pt-12 pb-20">
      <div className="lg:grid lg:grid-cols-[1fr_480px] lg:gap-16 lg:items-start">

        {/* Left — info */}
        <div className="mb-10 lg:mb-0">
          <p className="text-[12px] font-bold tracking-[3px] uppercase text-[#c8980a] mb-3">{t('eyebrow')}</p>
          <h1 className="font-playfair text-[36px] sm:text-[48px] font-black text-[#1a1a1a] dark:text-white leading-tight mb-4">
            {t('title')}
          </h1>
          <p className="text-[15px] sm:text-[16px] text-[#555] dark:text-[#A0A090] leading-relaxed mb-10">
            {t('subtitle')}
          </p>

          {/* Contact cards */}
          <div className="space-y-4">
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                ),
                label: t('email_label'),
                value: 'support@slowtime.ca',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ),
                label: t('hours_label'),
                value: t('hours_value'),
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                ),
                label: t('location_label'),
                value: 'Montréal, Québec, Canada',
              },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-start gap-4 p-4 rounded-xl bg-[#E8E8D8] dark:bg-dark-card border border-[rgba(200,152,10,0.12)]">
                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
                  {icon}
                </div>
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-wider text-[#888] dark:text-[#666] mb-0.5">{label}</div>
                  <div className="text-[14px] font-semibold text-[#1a1a1a] dark:text-white">{value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-[rgba(200,152,10,0.12)]">
            <p className="text-[13px] text-[#555] dark:text-[#A0A090] mb-3">{t('faq_hint')}</p>
            <Link href="/faq" className="inline-flex items-center gap-2 text-[13px] font-bold text-[#c8980a] hover:text-gold-hover transition-colors">
              {t('faq_link')}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Right — form */}
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-2xl p-6 sm:p-8 border border-[rgba(200,152,10,0.12)] shadow-sm">
          {status === 'sent' ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-4">
              <div className="w-14 h-14 rounded-full bg-lavo-success/15 flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2 className="text-[20px] font-black text-[#1a1a1a] dark:text-white">{t('success_title')}</h2>
              <p className="text-[14px] text-[#555] dark:text-[#A0A090]">{t('success_desc')}</p>
              <button type="button" onClick={() => { setName(''); setEmail(''); setSubject(''); setMessage(''); setStatus('idle'); }} className="mt-2 text-[13px] font-bold text-[#c8980a] hover:text-gold-hover transition-colors cursor-pointer">
                {t('new_message')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-[18px] font-black text-[#1a1a1a] dark:text-white mb-5">{t('form_title')}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('field_name')}</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('field_name_placeholder')} required className={inputClass(!!name)} />
                </div>
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('field_email')}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" required className={inputClass(!!email)} />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('field_subject')}</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('field_subject_placeholder')} className={inputClass(!!subject)} />
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('field_message')}</label>
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
                <p role="alert" className="text-[13px] font-semibold text-lavo-error">{t('error_generic')}</p>
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
