'use client';

import { type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { FormField } from '@/components/auth/FormField';
import { PasswordRules } from '@/components/auth/PasswordRules';
import { PhoneInput, type PhoneInputValue } from '@/components/auth/PhoneInput';
import { Button } from '@/components/ui/Button';
import { validateEmail, isPasswordValid, validatePhone, joinPhoneNumber } from '@/helpers/validators';

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
        type="password"
        placeholder={t('password_placeholder')}
        value={data.password}
        autoComplete="new-password"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...data, password: e.target.value });
          if (errors.password) onErrors({ ...errors, password: undefined });
        }}
        error={errors.password}
      />
      <PasswordRules password={data.password} namespace="station_apply" />

      <FormField
        label={t('confirm_password')}
        required
        type="password"
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
      />

      <Button type="button" fullWidth loading={isLoading} onClick={handleNext} className="mt-2">
        {isLoading ? t('loading') : t('btn_next')}
      </Button>
    </div>
  );
}
