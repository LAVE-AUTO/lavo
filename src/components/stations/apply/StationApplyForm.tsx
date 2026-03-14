'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { postWithApi } from '@/services/axios-service';
import { joinPhoneNumber } from '@/helpers/validators';
import { HTTP_STATUS } from '@/helpers/constants';
import { StepperHeader } from './StepperHeader';
import { StepAccount, type Step1Data, type Step1Errors } from './StepAccount';
import { StepCommerce, type Step2Data, type Step2Errors, type WashTypeOption } from './StepCommerce';
import { StepDocuments, type Step3Data, type Step3Errors } from './StepDocuments';
import { ApplySuccess } from './ApplySuccess';

interface StationApplyFormProps {
  washTypes: WashTypeOption[];
  onStepChange?: (step: Step) => void;
}

type Step = 1 | 2 | 3;

const DEFAULT_STEP1: Step1Data = {
  email: '',
  phone: { country: 'CA', localNumber: '' },
  password: '',
  confirmPassword: '',
};

const DEFAULT_STEP2: Step2Data = {
  stationName: '',
  legalName: '',
  registrationNumber: '',
  address: '',
  city: '',
  washPostCount: '',
  washTypeIds: [],
  serviceScope: '',
  description: '',
};

const DEFAULT_STEP3: Step3Data = {
  certificate: null,
  addressProof: null,
  license: null,
  termsAccepted: false,
};

/**
 * Multi-step station onboarding form.
 * Orchestrates three steps (Account → Commerce → Documents) and submits
 * the full payload to POST /stations/onboarding/submit.
 */
export function StationApplyForm({ washTypes, onStepChange }: StationApplyFormProps) {
  const t = useTranslations('station_apply');
  const { error: showError } = useToast();

  const [currentStep, setCurrentStep] = useState<Step>(1);

  function goToStep(step: Step) {
    setCurrentStep(step);
    onStepChange?.(step);
  }
  const [isLoading, setIsLoading]     = useState(false);
  const [success, setSuccess]         = useState(false);

  const [step1, setStep1] = useState<Step1Data>(DEFAULT_STEP1);
  const [step2, setStep2] = useState<Step2Data>(DEFAULT_STEP2);
  const [step3, setStep3] = useState<Step3Data>(DEFAULT_STEP3);

  const [errors1, setErrors1] = useState<Step1Errors>({});
  const [errors2, setErrors2] = useState<Step2Errors>({});
  const [errors3, setErrors3] = useState<Step3Errors>({});

  async function handleStep1Next() {
    setIsLoading(true);
    try {
      const [ok, data] = await postWithApi('/stations/onboarding/validate/step1', {
        email:            step1.email.trim(),
        phone:            joinPhoneNumber(step1.phone.country, step1.phone.localNumber),
        password:         step1.password,
        confirm_password: step1.confirmPassword,
      }, { successStatus: HTTP_STATUS.OK });

      if (ok) {
        goToStep(2);
        return;
      }

      const res = data as { errors?: Record<string, string> };
      if (res?.errors) {
        const mapped: Record<string, string> = {};
        if (res.errors.email)            mapped.email            = res.errors.email;
        if (res.errors.phone)            mapped.phone            = res.errors.phone;
        if (res.errors.password)         mapped.password         = res.errors.password;
        if (res.errors.confirm_password) mapped.confirmPassword  = res.errors.confirm_password;
        setErrors1(mapped);
      } else {
        showError(t('error_generic'));
      }
    } catch {
      showError(t('error_generic'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStep2Next() {
    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = {
        station_name:    step2.stationName.trim(),
        address:         step2.address.trim(),
        city:            step2.city.trim(),
        wash_post_count: parseInt(step2.washPostCount, 10),
        wash_type_ids:   step2.washTypeIds,
      };
      if (step2.legalName.trim())          payload.legal_name           = step2.legalName.trim();
      if (step2.registrationNumber.trim()) payload.registration_number  = step2.registrationNumber.trim();
      if (step2.serviceScope)             payload.service_scope         = step2.serviceScope;
      if (step2.description.trim())       payload.description           = step2.description.trim();

      const [ok, data] = await postWithApi('/stations/onboarding/validate/step2', payload, {
        successStatus: HTTP_STATUS.OK,
      });

      if (ok) {
        goToStep(3);
        return;
      }

      const res = data as { errors?: Record<string, string> };
      if (res?.errors) {
        const mapped: Record<string, string> = {};
        if (res.errors.station_name)    mapped.stationName    = res.errors.station_name;
        if (res.errors.address)         mapped.address        = res.errors.address;
        if (res.errors.city)            mapped.city           = res.errors.city;
        if (res.errors.wash_post_count) mapped.washPostCount  = res.errors.wash_post_count;
        if (res.errors.wash_type_ids)   mapped.washTypeIds    = res.errors.wash_type_ids;
        setErrors2(mapped);
      } else {
        showError(t('error_generic'));
      }
    } catch {
      showError(t('error_generic'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    setIsLoading(true);
    try {
      const documents: { document_type: string; file_url: string; storage?: string }[] = [];
      if (step3.certificate) {
        documents.push({ document_type: 'registration_certificate', file_url: step3.certificate.url, storage: step3.certificate.storage });
      }
      if (step3.addressProof) {
        documents.push({ document_type: 'address_proof', file_url: step3.addressProof.url, storage: step3.addressProof.storage });
      }
      if (step3.license) {
        documents.push({ document_type: 'license', file_url: step3.license.url, storage: step3.license.storage });
      }

      const payload: Record<string, unknown> = {
        email:            step1.email.trim(),
        phone:            joinPhoneNumber(step1.phone.country, step1.phone.localNumber),
        password:         step1.password,
        confirm_password: step1.confirmPassword,
        station_name:     step2.stationName.trim(),
        address:          step2.address.trim(),
        city:             step2.city.trim(),
        wash_post_count:  parseInt(step2.washPostCount, 10),
        wash_type_ids:    step2.washTypeIds,
        documents,
        terms_accepted:   true,
      };
      if (step2.legalName.trim())          payload.legal_name          = step2.legalName.trim();
      if (step2.registrationNumber.trim()) payload.registration_number = step2.registrationNumber.trim();
      if (step2.serviceScope)             payload.service_scope        = step2.serviceScope;
      if (step2.description.trim())       payload.description          = step2.description.trim();

      const [ok, data] = await postWithApi('/stations/onboarding/submit', payload, {
        successStatus: HTTP_STATUS.CREATED,
      });

      if (ok) {
        setSuccess(true);
        return;
      }

      const res = data as { code?: string };
      if (res?.code === 'EMAIL_ALREADY_EXISTS') {
        goToStep(1);
        setErrors1({ email: t('error_email_taken') });
      } else if (res?.code === 'TOO_MANY_REQUESTS') {
        showError(t('error_rate_limit'));
      } else {
        showError(t('error_generic'));
      }
    } catch {
      showError(t('error_generic'));
    } finally {
      setIsLoading(false);
    }
  }

  if (success) return <ApplySuccess />;

  return (
    <>
      <StepperHeader currentStep={currentStep} />

      {currentStep === 1 && (
        <StepAccount
          data={step1}
          errors={errors1}
          isLoading={isLoading}
          onChange={setStep1}
          onErrors={setErrors1}
          onNext={handleStep1Next}
        />
      )}

      {currentStep === 2 && (
        <StepCommerce
          data={step2}
          errors={errors2}
          isLoading={isLoading}
          washTypes={washTypes}
          onChange={setStep2}
          onErrors={setErrors2}
          onNext={handleStep2Next}
          onPrev={() => goToStep(1)}
        />
      )}

      {currentStep === 3 && (
        <StepDocuments
          data={step3}
          errors={errors3}
          isLoading={isLoading}
          onChange={setStep3}
          onErrors={setErrors3}
          onSubmit={handleSubmit}
          onPrev={() => goToStep(2)}
        />
      )}
    </>
  );
}
