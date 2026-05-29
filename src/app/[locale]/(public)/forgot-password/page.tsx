import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { AuthRedirectGuard } from '@/components/auth/AuthRedirectGuard';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'forgot_password' });
  return { title: `Hurryline - ${t('title')}` };
}

/**
 * Forgot password page - email submission, always shows success card.
 */
export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'forgot_password' });

  return (
    <AuthRedirectGuard locale={locale}>
      <AuthPageLayout>
        <div className="w-full max-w-lg animate-fade-in">
          <AuthHeader
            title={t('title')}
            subtitle={t('subtitle')}
            locale={locale}
          />

          <div className="bg-white dark:bg-surface rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),_0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-gold/10 overflow-hidden">
            <div className="pt-6">
              <ForgotPasswordForm />
            </div>
          </div>
        </div>
      </AuthPageLayout>
    </AuthRedirectGuard>
  );
}
