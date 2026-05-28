'use client';

import { useTranslations } from 'next-intl';
import { FileUploadZone, type UploadedFile } from './FileUploadZone';
import { Button } from '@/components/ui/Button';

export interface Step3Data {
  certificate: UploadedFile | null;
  addressProof: UploadedFile | null;
  license: UploadedFile | null;
  termsAccepted: boolean;
}

export interface Step3Errors {
  certificate?: string;
  addressProof?: string;
  terms?: string;
}

interface StepDocumentsProps {
  data: Step3Data;
  errors: Step3Errors;
  isLoading: boolean;
  onChange: (data: Step3Data) => void;
  onErrors: (errors: Step3Errors) => void;
  onSubmit: () => void;
  onPrev: () => void;
}

/**
 * Step 3 of the station onboarding form: document upload and legal consent.
 */
export function StepDocuments({ data, errors, isLoading, onChange, onErrors, onSubmit, onPrev }: StepDocumentsProps) {
  const t = useTranslations('station_apply');

  function validate(): boolean {
    const next: Step3Errors = {};

    if (!data.certificate) next.certificate = t('error_doc_required');
    if (!data.addressProof) next.addressProof = t('error_doc_required');
    if (!data.termsAccepted) next.terms = t('error_terms');

    onErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (validate()) onSubmit();
  }

  return (
    <div>
      <FileUploadZone
        label={t('doc_certificate')}
        hint={t('doc_certificate_hint')}
        required
        value={data.certificate}
        onChange={(file) => {
          onChange({ ...data, certificate: file });
          if (errors.certificate) onErrors({ ...errors, certificate: undefined });
        }}
        error={errors.certificate}
      />

      <FileUploadZone
        label={t('doc_address_proof')}
        hint={t('doc_address_proof_hint')}
        required
        value={data.addressProof}
        onChange={(file) => {
          onChange({ ...data, addressProof: file });
          if (errors.addressProof) onErrors({ ...errors, addressProof: undefined });
        }}
        error={errors.addressProof}
      />

      <FileUploadZone
        label={t('doc_license')}
        hint={t('doc_license_hint')}
        value={data.license}
        onChange={(file) => onChange({ ...data, license: file })}
      />

      <div className="mb-5">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={data.termsAccepted}
              onChange={(e) => {
                onChange({ ...data, termsAccepted: e.target.checked });
                if (errors.terms) onErrors({ ...errors, terms: undefined });
              }}
              className="sr-only"
              aria-describedby={errors.terms ? 'terms-error' : undefined}
            />
            <div className={[
              'w-5 h-5 rounded border-[1.5px] flex items-center justify-center transition-colors duration-150',
              data.termsAccepted
                ? 'bg-gold border-gold'
                : errors.terms
                ? 'border-Hurryline-error bg-[#FFF9EC] dark:bg-[#391C01]'
                : 'border-[#CCCCCC] dark:border-border bg-white dark:bg-surface group-hover:border-gold',
            ].join(' ')}>
              {data.termsAccepted && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#001201" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-[14px] text-[#333] dark:text-[#C0C0B0] leading-relaxed">
            {t('terms_label')}
          </span>
        </label>
        {errors.terms && (
          <p id="terms-error" role="alert" className="mt-1.5 text-[13px] font-medium text-Hurryline-error flex items-center gap-1">
            <span aria-hidden="true">!</span>
            {errors.terms}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onPrev} className="flex-1">
          {t('btn_prev')}
        </Button>
        <Button type="button" loading={isLoading} onClick={handleSubmit} className="flex-[2]">
          {isLoading ? t('loading') : t('btn_submit')}
        </Button>
      </div>
    </div>
  );
}
