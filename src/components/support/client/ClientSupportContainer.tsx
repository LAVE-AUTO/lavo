'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SupportCreateForm } from './SupportCreateForm';
import { SupportTicketCard } from './SupportTicketCard';
import type { SupportTicket } from '../support-mock';

interface Props {
  /** Pre-filtered list of tickets for the current user (client or station). */
  tickets: SupportTicket[];
}

export function ClientSupportContainer({ tickets: initialTickets }: Props) {
  const t = useTranslations('client_support');
  const [showForm, setShowForm] = useState(false);
  // TODO: connect to API once endpoint is available (GET /me/tickets)
  const tickets = initialTickets;

  function handleCreated() {
    setShowForm(false);
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 py-5 dark:border-[#1A2A14] dark:bg-[#0C1209]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
            <p className="mt-0.5 text-[12px] text-[#888] dark:text-[#6A6A5A]">{t('page_subtitle')}</p>
          </div>
          {!showForm && (
            <button type="button" onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-[10px] bg-[#C49A1E] px-4 py-2.5 text-[13px] font-bold text-[#0C1209] shadow-sm transition-all hover:bg-[#D4A830] hover:shadow-md active:scale-[0.98]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              {t('btn_new_ticket')}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5EE] p-6 dark:bg-[#0C1209]">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">

          {showForm && (
            <SupportCreateForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
          )}

          {/* Ticket list */}
          <div className="flex flex-col gap-3">
            <h2 className="text-[12px] font-black uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">
              {t('section_tickets')}
            </h2>
            {tickets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4DC] dark:bg-[#131E10] dark:ring-[#1E2E18]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                </div>
                <p className="text-[13px] font-semibold text-[#999]">{t('empty_tickets')}</p>
              </div>
            ) : (
              tickets.map((ticket) => (
                <SupportTicketCard key={ticket.id} ticket={ticket} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
