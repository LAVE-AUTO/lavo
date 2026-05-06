'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TextField } from '../TextField';

export interface HourException {
  id: string;
  exception_date: string;
  reason: string;
}

interface Props {
  exceptions: HourException[];
  saving?: boolean;
  onAdd: (exception_date: string, reason: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
}

export function HoursExceptions({ exceptions, saving = false, onAdd, onDelete, disabled = false }: Props) {
  const t = useTranslations('station_config');

  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dateError, setDateError] = useState(false);
  const [reasonError, setReasonError] = useState(false);

  function handleCancel() {
    setDate('');
    setReason('');
    setDateError(false);
    setReasonError(false);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date);
    const reasonValid = reason.trim().length > 0;
    setDateError(!dateValid);
    setReasonError(!reasonValid);
    if (!dateValid || !reasonValid) return;

    setSubmitting(true);
    await onAdd(date, reason.trim());
    setSubmitting(false);
    handleCancel();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  return (
    <section className="rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#C49A1E]">
          {t('hours_exceptions_title')}
        </h3>
        {!showForm && (
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => setShowForm(true)}
            aria-label={t('hours_exceptions_add')}
            className="flex items-center gap-1.5 rounded-[8px] border border-[#C49A1E]/40 px-3 py-1.5 text-[12px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/8 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('hours_exceptions_add')}
          </button>
        )}
      </div>

      <p className="mb-4 text-[12px] leading-snug text-[#888] dark:text-[#9A9A8A]">
        {t('hours_exceptions_hint')}
      </p>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-3 rounded-xl border border-[#E0DCD0] bg-[#F7F6F2] p-4 dark:border-[#243020] dark:bg-[#0F1A0C]">
          <p className="text-[12px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('hours_exceptions_add_title')}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#888] dark:text-[#9A9A8A]">
                {t('hours_exceptions_date_label')}
              </label>
              <TextField
                value={date}
                onChange={(v) => { setDate(v); if (dateError) setDateError(false); }}
                placeholder={t('hours_exceptions_date_placeholder')}
                maxLength={10}
                invalid={dateError}
                aria-invalid={dateError}
                inputClassName="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#888] dark:text-[#9A9A8A]">
                {t('hours_exceptions_reason_label')}
              </label>
              <TextField
                value={reason}
                onChange={(v) => { setReason(v); if (reasonError) setReasonError(false); }}
                placeholder={t('hours_exceptions_reason_placeholder')}
                maxLength={200}
                invalid={reasonError}
                aria-invalid={reasonError}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="rounded-xl border border-[#E0DCD0] px-4 py-2 text-[12px] font-semibold text-[#666] transition-colors hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]"
            >
              {t('hours_exceptions_add_cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#C49A1E] px-4 py-2 text-[12px] font-bold text-[#0C1209] transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {submitting ? '…' : t('hours_exceptions_add_submit')}
            </button>
          </div>
        </form>
      )}

      {exceptions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#D8D4C8] bg-[#F7F6F2] px-4 py-8 dark:border-[#243020] dark:bg-[#0F1A0C]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BBBBAA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-[12px] font-semibold text-[#888] dark:text-[#9A9A8A]">
            {t('hours_exceptions_empty')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[#F0EDE4] dark:divide-[#1A2A14]">
          {exceptions.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
                  {ex.exception_date}
                </span>
                <span className="text-[12px] text-[#888] dark:text-[#9A9A8A]">{ex.reason}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(ex.id)}
                disabled={disabled || deletingId === ex.id}
                aria-label={t('hours_exceptions_delete_aria')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[#E0DCD0] text-[#AAAAAA] transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#243020] dark:hover:border-red-800/50 dark:hover:bg-red-950/20 dark:hover:text-red-400"
              >
                {deletingId === ex.id ? (
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
