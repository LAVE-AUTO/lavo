import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminBrandPanel } from '@/components/auth/AdminBrandPanel';
import { LoginForm } from '@/components/auth/LoginForm';
import { AuthRedirectGuard } from '@/components/auth/AuthRedirectGuard';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin_login' });
  return { title: t('meta_title') };
}

/**
 * Admin login page — accessible only by typing the URL directly (/login/admin).
 * Not linked from any public navigation.
 * Split-screen: left admin brand panel (desktop) + right login form (no tabs, no mode switcher).
 */
export default async function AdminLoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'admin_login' });

  return (
    <>
      <AuthRedirectGuard />
      <div className="min-h-screen flex">

        {/* Left brand panel — desktop only */}
        <aside className="hidden lg:block lg:w-[42%] xl:w-[45%] shrink-0 sticky top-0 h-screen">
          <AdminBrandPanel />
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
              <span className="text-[16px] font-bold text-dark-bg dark:text-white tracking-wide">
                Slowtime
              </span>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <LangToggle />
              </div>
            </div>

            {/* Title */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8980A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold tracking-[2px] uppercase text-gold">
                  Administration
                </span>
              </div>
              <h1 className="text-[28px] font-bold text-dark-bg dark:text-white leading-tight">
                {t('welcome_title')}
              </h1>
              <p className="mt-1.5 text-[15px] text-[#5A6B54] dark:text-lavo-muted leading-snug">
                {t('welcome_subtitle')}
              </p>
            </div>

            {/* Login form — no TabSwitcher, no AuthModeSwitcher */}
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),_0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-gold/10 overflow-hidden animate-fade-in-up">
              <LoginForm forgotPasswordHref="/forgot-password" hideSocialButtons />
            </div>

          </div>
        </main>

      </div>
    </>
  );
}
