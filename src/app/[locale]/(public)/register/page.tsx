import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { TabSwitcher } from '@/components/auth/TabSwitcher';
import { RegisterForm } from '@/components/auth/RegisterForm';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'register' });
  return { title: `LAVO — ${t('tab_register')}` };
}

/**
 * Public registration page.
 */
export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'register' });

  return (
    <AuthPageLayout>
      <div className="w-full max-w-lg animate-fade-in">
        <AuthHeader
          title={t('welcome_title')}
          subtitle={t('welcome_subtitle')}
        />

        <div className="bg-white dark:bg-dark-bg rounded-2xl shadow-lg overflow-hidden">
          <div className="px-8 pt-6 pb-2">
            <TabSwitcher
              activeTab="register"
              loginLabel={t('tab_login')}
              registerLabel={t('tab_register')}
            />
          </div>
          <RegisterForm />
        </div>
      </div>
    </AuthPageLayout>
  );
}
