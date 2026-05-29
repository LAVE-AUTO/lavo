'use client';

import { useState, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { FormField } from '@/components/auth/FormField';
import { PasswordRules } from '@/components/auth/PasswordRules';
import { PhoneInput, type PhoneInputValue } from '@/components/auth/PhoneInput';
import { Button } from '@/components/ui/Button';
import { validateEmail, isPasswordValid, validatePhone, joinPhoneNumber } from '@/helpers/validators';

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export interface Step1Data {
  email: string;
  phone: PhoneInputValue;
  password: string;
  confirmPassword: string;
}

export interface Step1Errors {
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

interface StepAccountProps {
  data: Step1Data;
  errors: Step1Errors;
  isLoading: boolean;
  onChange: (data: Step1Data) => void;
  onErrors: (errors: Step1Errors) => void;
  onNext: () => void;
}

/**
 * Step 1 of the station onboarding form: account credentials.
 * Collects email, phone, password, and password confirmation.
 */
export function StepAccount({ data, errors, isLoading, onChange, onErrors, onNext }: StepAccountProps) {
  const t = useTranslations('station_apply');
  const [showPassword, setShowPassword]         = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function validate(): boolean {
    const next: Step1Errors = {};
    if (!data.email) {
      next.email = t('error_required');
    } else if (!validateEmail(data.email)) {
      next.email = t('error_email_invalid');
    }

    const fullPhone = joinPhoneNumber(data.phone.country, data.phone.localNumber);
    if (!data.phone.localNumber.trim()) {
      next.phone = t('error_required');
    } else if (!validatePhone(fullPhone)) {
      next.phone = t('error_phone_invalid');
    }

    if (!data.password) {
      next.password = t('error_required');
    } else if (!isPasswordValid(data.password)) {
      next.password = t('error_password_invalid');
    }

    if (!data.confirmPassword) {
      next.confirmPassword = t('error_required');
    } else if (data.password !== data.confirmPassword) {
      next.confirmPassword = t('error_password_mismatch');
    }

    onErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleNext() {
    if (validate()) onNext();
  }

  return (
    <div>
      <FormField
        label={t('email')}
        required
        type="email"
        placeholder={t('email_placeholder')}
        value={data.email}
        autoComplete="email"
        autoFocus
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...data, email: e.target.value });
          if (errors.email) onErrors({ ...errors, email: undefined });
        }}
        error={errors.email}
      />

      <PhoneInput
        label={t('phone')}
        required
        value={data.phone}
        onChange={(phone) => {
          onChange({ ...data, phone });
          if (errors.phone) onErrors({ ...errors, phone: undefined });
        }}
        error={errors.phone}
      />

      <FormField
        label={t('password')}
        required
        type={showPassword ? 'text' : 'password'}
        placeholder={t('password_placeholder')}
        value={data.password}
        autoComplete="new-password"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...data, password: e.target.value });
          if (errors.password) onErrors({ ...errors, password: undefined });
        }}
        error={errors.password}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="text-foreground/55 hover:text-foreground/70 dark:hover:text-[#ccc] transition-colors"
          >
            <EyeIcon open={showPassword} />
          </button>
        }
      />
      <PasswordRules password={data.password} namespace="station_apply" />

      <FormField
        label={t('confirm_password')}
        required
        type={showConfirmPassword ? 'text' : 'password'}
        placeholder={t('confirm_password_placeholder')}
        value={data.confirmPassword}
        autoComplete="new-password"
        onBlur={() => {
          if (data.confirmPassword && data.password !== data.confirmPassword) {
            onErrors({ ...errors, confirmPassword: t('error_password_mismatch') });
          }
        }}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...data, confirmPassword: e.target.value });
          if (errors.confirmPassword) onErrors({ ...errors, confirmPassword: undefined });
        }}
        error={errors.confirmPassword}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="text-foreground/55 hover:text-foreground/70 dark:hover:text-[#ccc] transition-colors"
          >
            <EyeIcon open={showConfirmPassword} />
          </button>
        }
      />

      <Button type="button" fullWidth loading={isLoading} onClick={handleNext} className="mt-2">
        {isLoading ? t('loading') : t('btn_next')}
      </Button>
    </div>
  );
}
