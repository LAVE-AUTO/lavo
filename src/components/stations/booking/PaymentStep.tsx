'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface PaymentStepProps {
  grandTotal: number;
  onConfirm: () => Promise<void>;
  onBack: () => void;
}

export function PaymentStep({ grandTotal, onConfirm, onBack }: PaymentStepProps) {
  const t = useTranslations('booking');
  const mockCardEnabled = process.env.NEXT_PUBLIC_ENABLE_CARD_MOCK === 'true';
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [processing, setProcessing] = useState(false);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const isValid = cardNumber.replace(/\s/g, '').length === 16
    && expiry.length === 5
    && cvc.length >= 3;

  const handlePay = async () => {
    if (mockCardEnabled && !isValid) return;
    setProcessing(true);
    // In mock mode, simulate a Stripe payment on the client.
    // In production, this component must be backed by a real PSP integration
    // (e.g. Stripe Elements) that never exposes PAN/expiry/CVC to React state.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setProcessing(false);
    onConfirm();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 space-y-5 pb-4">
        <p className="text-[14px] text-[#555] dark:text-[#B0B0A0]">{t('payment_subtitle')}</p>

        {mockCardEnabled ? (
          // Mock-only Stripe-style card form for non-production environments.
          <div className="bg-[#E8E8D8] dark:bg-dark-bg/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="28" height="18" viewBox="0 0 28 18" fill="none"><rect width="28" height="18" rx="3" fill="#635BFF" /><text x="5" y="13" fontSize="10" fill="white" fontWeight="bold">S</text></svg>
              <span className="text-[13px] font-bold text-[#555] dark:text-[#A0A090]">{t('payment_secured')}</span>
            </div>

            {/* Card number */}
            <div>
              <label className="block text-[12px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-1.5">
                {t('payment_card_number')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="4242 4242 4242 4242"
                className="w-full px-4 py-3 rounded-lg border-2 border-[#D0D0C0] dark:border-tab-inactive bg-white dark:bg-dark-bg text-[15px] text-[#000C1F] dark:text-[#FFF8EC] placeholder:text-[#BBB] focus:border-gold focus:outline-none transition-colors"
              />
            </div>

            {/* Expiry + CVC */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[12px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-1.5">
                  {t('payment_expiry')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  className="w-full px-4 py-3 rounded-lg border-2 border-[#D0D0C0] dark:border-tab-inactive bg-white dark:bg-dark-bg text-[15px] text-[#000C1F] dark:text-[#FFF8EC] placeholder:text-[#BBB] focus:border-gold focus:outline-none transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[12px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-1.5">
                  {t('payment_cvc')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123"
                  className="w-full px-4 py-3 rounded-lg border-2 border-[#D0D0C0] dark:border-tab-inactive bg-white dark:bg-dark-bg text-[15px] text-[#000C1F] dark:text-[#FFF8EC] placeholder:text-[#BBB] focus:border-gold focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        ) : (
          // Production-safe placeholder: real payment is handled by a PSP integration.
          <div className="bg-[#E8E8D8] dark:bg-dark-bg/60 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <svg width="28" height="18" viewBox="0 0 28 18" fill="none"><rect width="28" height="18" rx="3" fill="#635BFF" /><text x="5" y="13" fontSize="10" fill="white" fontWeight="bold">S</text></svg>
              <span className="text-[13px] font-bold text-[#555] dark:text-[#A0A090]">
                {t('payment_psp_placeholder')}
              </span>
            </div>
            <p className="text-[13px] text-[#555] dark:text-[#B0B0A0]">
              {t('payment_psp_explainer')}
            </p>
          </div>
        )}

        {/* Total reminder */}
        <div className="bg-gold/10 dark:bg-gold/5 border-2 border-gold rounded-xl p-4 flex justify-between items-center">
          <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('ticket_total')}</span>
          <span className="text-[20px] font-black text-gold">{grandTotal}$</span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-[#D0D0C0] dark:border-tab-inactive pt-4 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          className="py-3 px-5 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer disabled:opacity-50"
        >
          {t('back')}
        </button>
        <button
          type="button"
          disabled={mockCardEnabled ? !isValid || processing : processing}
          onClick={handlePay}
          className={`flex-1 py-3 rounded-xl text-[15px] font-black transition-colors cursor-pointer ${
            isValid && !processing
              ? 'bg-gold hover:bg-gold-hover text-dark-bg'
              : 'bg-[#D0D0C0] dark:bg-tab-inactive text-[#888] cursor-not-allowed'
          }`}
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {t('payment_processing')}
            </span>
          ) : (
            t('payment_confirm', { amount: grandTotal })
          )}
        </button>
      </div>
    </div>
  );
}
