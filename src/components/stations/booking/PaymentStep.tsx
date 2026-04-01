'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface PaymentStepProps {
  grandTotal: number;
  clientSecret: string | null;
  onConfirm: () => Promise<void>;
  onBack: () => void;
}

// Lazy singleton: loadStripe is deferred until first client render to avoid
// Turbopack/SSR module initialization issues with @stripe/stripe-js.
let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
  if (stripePromise !== null) return stripePromise;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (key) stripePromise = loadStripe(key);
  return stripePromise;
}

/* ------------------------------------------------------------------
 *  Stripe card form — only rendered when clientSecret is provided
 * ------------------------------------------------------------------ */

interface StripeCardFormProps {
  grandTotal: number;
  clientSecret: string;
  onConfirm: () => Promise<void>;
  onBack: () => void;
}

function StripeCardForm({ grandTotal, clientSecret, onConfirm, onBack }: StripeCardFormProps) {
  const t = useTranslations('booking');
  const stripe = useStripe();
  const elements = useElements();
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;
    setProcessing(true);
    setStripeError(null);
    try {
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });
      if (error) {
        setStripeError(error.message ?? t('error_stripe_payment'));
        return;
      }
      await onConfirm();
    } catch {
      setStripeError(t('error_stripe_payment'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 space-y-5 pb-4">
        <p className="text-[14px] text-[#555] dark:text-[#B0B0A0]">{t('payment_subtitle')}</p>

        <div className="bg-[#E8E8D8] dark:bg-dark-bg/60 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <svg width="28" height="18" viewBox="0 0 28 18" fill="none" aria-hidden="true"><rect width="28" height="18" rx="3" fill="#635BFF" /><text x="5" y="13" fontSize="10" fill="white" fontWeight="bold">S</text></svg>
            <span className="text-[13px] font-bold text-[#555] dark:text-[#A0A090]">{t('payment_secured')}</span>
          </div>
          <div className="rounded-lg border-2 border-[#D0D0C0] dark:border-tab-inactive bg-white dark:bg-dark-bg px-4 py-3">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '15px',
                    color: '#000C1F',
                    '::placeholder': { color: '#BBBBBB' },
                    fontFamily: 'Rajdhani, sans-serif',
                  },
                  invalid: { color: '#E8472A' },
                },
                hidePostalCode: true,
              }}
            />
          </div>
          {stripeError && (
            <p className="text-[13px] text-lavo-error" role="alert">{stripeError}</p>
          )}
        </div>

        <div className="bg-gold/10 dark:bg-gold/5 border-2 border-gold rounded-xl p-4 flex justify-between items-center">
          <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('ticket_total')}</span>
          <span className="text-[20px] font-black text-gold">{grandTotal}$</span>
        </div>
      </div>

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
          disabled={!stripe || processing}
          onClick={handlePay}
          aria-busy={processing}
          className={`flex-1 py-3 rounded-xl text-[15px] font-black transition-colors cursor-pointer ${stripe && !processing ? 'bg-gold hover:bg-gold-hover text-dark-bg' : 'bg-[#D0D0C0] dark:bg-tab-inactive text-[#888] cursor-not-allowed'}`}
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {t('payment_processing')}
            </span>
          ) : t('payment_confirm', { amount: grandTotal })}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
 *  Queue confirm form — no card needed
 * ------------------------------------------------------------------ */

function QueueConfirmForm({ grandTotal, onConfirm, onBack }: { grandTotal: number; onConfirm: () => Promise<void>; onBack: () => void }) {
  const t = useTranslations('booking');
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      await onConfirm();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 space-y-5 pb-4">
        <p className="text-[14px] text-[#555] dark:text-[#B0B0A0]">{t('payment_queue_subtitle')}</p>
        <div className="bg-gold/10 dark:bg-gold/5 border-2 border-gold rounded-xl p-4 flex justify-between items-center">
          <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('ticket_total')}</span>
          <span className="text-[20px] font-black text-gold">{grandTotal}$</span>
        </div>
      </div>

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
          disabled={processing}
          onClick={handleConfirm}
          aria-busy={processing}
          className={`flex-1 py-3 rounded-xl text-[15px] font-black transition-colors cursor-pointer ${!processing ? 'bg-gold hover:bg-gold-hover text-dark-bg' : 'bg-[#D0D0C0] dark:bg-tab-inactive text-[#888] cursor-not-allowed'}`}
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {t('payment_processing')}
            </span>
          ) : t('payment_confirm_queue')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
 *  Exported component
 * ------------------------------------------------------------------ */

export function PaymentStep({ grandTotal, clientSecret, onConfirm, onBack }: PaymentStepProps) {
  const t = useTranslations('booking');

  if (!clientSecret) {
    return <QueueConfirmForm grandTotal={grandTotal} onConfirm={onConfirm} onBack={onBack} />;
  }

  const resolvedStripePromise = getStripePromise();

  if (!resolvedStripePromise) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center py-8 text-center">
          <p className="text-[14px] text-lavo-error">{t('error_stripe_unavailable')}</p>
        </div>
        <div className="border-t border-[#D0D0C0] dark:border-tab-inactive pt-4">
          <button
            type="button"
            onClick={onBack}
            className="py-3 px-5 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
          >
            {t('back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={resolvedStripePromise} options={{ clientSecret }}>
      <StripeCardForm
        grandTotal={grandTotal}
        clientSecret={clientSecret}
        onConfirm={onConfirm}
        onBack={onBack}
      />
    </Elements>
  );
}
