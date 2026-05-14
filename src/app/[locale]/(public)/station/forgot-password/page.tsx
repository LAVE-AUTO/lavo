import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StationBrandPanel } from '@/components/stations/apply/StationBrandPanel';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { AuthRedirectGuard } from '@/components/auth/AuthRedirectGuard';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'forgot_password' });
  return { title: `Slowtime - ${t('title')}` };
}

/**
 * Station forgot-password page - split-screen layout.
 * Left: station brand panel (desktop only).
 * Right: ForgotPasswordForm with back-link to station login.
 */
export default async function StationForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'forgot_password' });

  return (
    <AuthRedirectGuard locale={locale}>
      <div className="min-h-screen flex">
        {/* Left brand panel - desktop only */}
        <aside className="hidden lg:block lg:w-[42%] xl:w-[45%] shrink-0 sticky top-0 h-screen">
          <StationBrandPanel />
        </aside>

        {/* Right form panel */}
        <main className="flex-1 flex flex-col items-center justify-center min-h-screen auth-form-bg overflow-y-auto scroll-smooth px-6 py-10">
          <div className="w-full max-w-lg animate-fade-in">
            {/* Desktop controls */}
            <div className="hidden lg:flex justify-end gap-2 mb-4">
              <ThemeToggle />
              <LangToggle />
            </div>

            {/* Mobile top bar */}
            <div className="flex items-center justify-between mb-5 lg:hidden">
              <span className="text-[16px] font-bold text-dark-bg dark:text-white tracking-wide">Slowtime</span>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <LangToggle />
              </div>
            </div>

            <div className="text-center mb-6">
              <h1 className="text-[26px] sm:text-[30px] font-bold text-dark-bg dark:text-white mb-2">
                {t('title')}
              </h1>
              <p className="text-[15px] text-[#555] dark:text-Hurryline-muted">
                {t('subtitle')}
              </p>
            </div>

            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),_0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-gold/10 overflow-hidden animate-fade-in-up">
              <div className="pt-6">
                <ForgotPasswordForm backHref="/station/login" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthRedirectGuard>
  );
}
