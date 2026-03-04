import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { TabSwitcher } from '@/components/auth/TabSwitcher';
import { LoginForm } from '@/components/auth/LoginForm';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'login' });
  return { title: `Slowtime — ${t('tab_login')}` };
}

/**
 * Public login page.
 */
export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'login' });

  return (
    <AuthPageLayout>
      <div className="w-full max-w-lg animate-fade-in">
        <AuthHeader
          title={t('welcome_title')}
          subtitle={t('welcome_subtitle')}
          locale={locale}
        />

        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),_0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-gold/10 overflow-hidden">
          <div className="px-8 pt-6 pb-2">
            <TabSwitcher
              activeTab="login"
              loginLabel={t('tab_login')}
              registerLabel={t('tab_register')}
            />
          </div>
          <LoginForm />
        </div>
      </div>
    </AuthPageLayout>
  );
}
