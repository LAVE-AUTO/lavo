'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { postWithApi } from '@/services/axios-service';
import {
  SUPPORT_SUBJECT_MIN_LENGTH,
  SUPPORT_SUBJECT_MAX_LENGTH,
  SUPPORT_MESSAGE_MIN_LENGTH,
  SUPPORT_MESSAGE_MAX_LENGTH,
} from '@/helpers/constants';

interface Props {
  onCreated: () => void;
  onCancel:  () => void;
}

const inputClass =
  'w-full rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:focus:border-[#C49A1E] dark:focus:bg-[#182214]';

export function SupportCreateForm({ onCreated, onCancel }: Props) {
  const t      = useTranslations('client_support');
  const { success: toastSuccess, error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [saving,  setSaving]  = useState(false);

  const subjectTrimmed = subject.trim();
  const messageTrimmed = message.trim();
  const subjectLen = subjectTrimmed.length;
  const messageLen = messageTrimmed.length;
  const subjectTooShort = subjectLen > 0 && subjectLen < SUPPORT_SUBJECT_MIN_LENGTH;
  const messageTooShort = messageLen > 0 && messageLen < SUPPORT_MESSAGE_MIN_LENGTH;
  const canSubmit = subjectLen >= SUPPORT_SUBJECT_MIN_LENGTH && messageLen >= SUPPORT_MESSAGE_MIN_LENGTH;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectTrimmed) { toastError(t('error_subject_empty')); return; }
    if (subjectLen < SUPPORT_SUBJECT_MIN_LENGTH) {
      toastError(t('error_subject_too_short', { min: SUPPORT_SUBJECT_MIN_LENGTH }));
      return;
    }
    if (!messageTrimmed) { toastError(t('error_message_empty')); return; }
    if (messageLen < SUPPORT_MESSAGE_MIN_LENGTH) {
      toastError(t('error_message_too_short', { min: SUPPORT_MESSAGE_MIN_LENGTH }));
      return;
    }
    setSaving(true);
    try {
      const [ok] = await postWithApi('/support', { subject: subjectTrimmed, message: messageTrimmed });
      if (!mountedRef.current) return;
      if (ok) {
        toastSuccess(t('submit_success'));
        onCreated();
      } else {
        toastError(t('submit_error'));
      }
    } catch {
      if (mountedRef.current) toastError(t('submit_error'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
      <div className="flex items-center gap-2.5 border-b border-[#F0EDE4] px-5 py-3.5 dark:border-[#1A2A14]">
        <span className="h-4 w-[3px] rounded-full bg-[#C49A1E]" />
        <span className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('section_create')}</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="support-subject" className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('field_subject')}</label>
          <input
            id="support-subject"
            type="text"
            minLength={SUPPORT_SUBJECT_MIN_LENGTH}
            maxLength={SUPPORT_SUBJECT_MAX_LENGTH}
            className={inputClass}
            placeholder={t('field_subject_placeholder')}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-invalid={subjectTooShort || undefined}
            aria-describedby="support-subject-hint"
          />
          <div id="support-subject-hint" className="flex items-center justify-between text-[11px]">
            <span className={subjectTooShort ? 'text-[#B2351F] dark:text-[#F0A090]' : 'text-[#7A7A6A] dark:text-[#6A6A5A]'}>
              {subjectTooShort
                ? t('error_subject_too_short', { min: SUPPORT_SUBJECT_MIN_LENGTH })
                : t('hint_subject_min', { min: SUPPORT_SUBJECT_MIN_LENGTH })}
            </span>
            <span className="tabular-nums text-[#AAAAAA] dark:text-[#4A4A3A]">{subject.length}/{SUPPORT_SUBJECT_MAX_LENGTH}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="support-message" className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('field_message')}</label>
          <textarea
            id="support-message"
            rows={5}
            minLength={SUPPORT_MESSAGE_MIN_LENGTH}
            maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
            className={inputClass + ' resize-none leading-relaxed'}
            placeholder={t('field_message_placeholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-invalid={messageTooShort || undefined}
            aria-describedby="support-message-hint"
          />
          <div id="support-message-hint" className="flex items-center justify-between text-[11px]">
            <span className={messageTooShort ? 'text-[#B2351F] dark:text-[#F0A090]' : 'text-[#7A7A6A] dark:text-[#6A6A5A]'}>
              {messageTooShort
                ? t('error_message_too_short', { min: SUPPORT_MESSAGE_MIN_LENGTH })
                : t('hint_message_min', { min: SUPPORT_MESSAGE_MIN_LENGTH })}
            </span>
            <span className="tabular-nums text-[#AAAAAA] dark:text-[#4A4A3A]">{message.length}/{SUPPORT_MESSAGE_MAX_LENGTH}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving}
            className="rounded-[10px] border border-[#E0DCD0] px-4 py-2.5 text-[13px] font-semibold text-[#666] transition-colors hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]">
            {t('btn_cancel')}
          </button>
          <button type="submit" disabled={saving || !canSubmit}
            className="rounded-[10px] bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? t('btn_submitting') : t('btn_submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
