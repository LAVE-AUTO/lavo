import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { AuthRedirectGuard } from '@/components/auth/AuthRedirectGuard';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'register' });
  return { title: `Slowtime — ${t('confirmation_title')}` };
}

/**
 * Envelope icon for the confirmation page.
 */
function EnvelopeIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#00C851"
      strokeWidth="1.75"
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
 * Registration confirmation page — displayed after a successful sign-up.
 */
export default async function RegisterConfirmationPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'register' });

  return (
    <AuthRedirectGuard>
      <AuthPageLayout>
        <div className="w-full max-w-lg animate-fade-in">
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),_0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-gold/10 p-10 text-center">
            <div className="w-20 h-20 rounded-full bg-lavo-success/10 border border-lavo-success/20 flex items-center justify-center mx-auto mb-6">
              <EnvelopeIcon />
            </div>

            <h1 className="text-[26px] font-bold text-[#000C1F] dark:text-white mb-3">
              {t('confirmation_title')}
            </h1>
            <p className="text-[15px] text-[#555] dark:text-lavo-muted mb-3 leading-relaxed">
              {t('confirmation_message')}
            </p>
            <p className="text-[20px] text-[#888] dark:text-lavo-muted mb-10">
              {t('confirmation_spam')}
            </p>

            <Link
              href="/login"
              className="block w-full py-3.5 bg-gold hover:bg-gold-hover rounded-[10px] text-[15px] font-bold text-dark-bg tracking-wide transition-colors duration-150 text-center"
            >
              {t('confirmation_back')}
            </Link>
          </div>
        </div>
      </AuthPageLayout>
    </AuthRedirectGuard>
  );
}
