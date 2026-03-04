import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'register' });
  return { title: `LAVO — ${t('confirmation_title')}` };
}

/**
 * Envelope icon displayed on the confirmation page.
 */
function EnvelopeIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#00C851"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

/**
 * Registration confirmation page.
 * Informs the user to check their email and provides a link back to login.
 */
export default async function RegisterConfirmationPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'register' });

  return (
    <div className="min-h-screen bg-[#EDEDED] dark:bg-[#111810] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm bg-white dark:bg-dark-bg rounded-3xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-lavo-success/10 flex items-center justify-center mx-auto mb-6">
          <EnvelopeIcon />
        </div>

        <h1 className="text-[22px] font-bold text-[#000C1F] dark:text-white mb-3 font-rajdhani">
          {t('confirmation_title')}
        </h1>
        <p className="text-[14px] text-[#555] dark:text-lavo-muted mb-3 leading-relaxed font-rajdhani">
          {t('confirmation_message')}
        </p>
        <p className="text-[12px] text-[#888] dark:text-lavo-muted mb-8 font-rajdhani">
          {t('confirmation_spam')}
        </p>

        <Link
          href="/login"
          className="block w-full py-3.5 bg-gold hover:bg-gold-hover rounded-[10px] text-[15px] font-extrabold text-[#1A2116] tracking-wide transition-colors duration-150 font-rajdhani text-center"
        >
          {t('confirmation_back')}
        </Link>
      </div>
    </div>
  );
}
