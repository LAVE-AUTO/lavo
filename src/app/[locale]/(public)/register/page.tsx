import { getTranslations, setRequestLocale } from 'next-intl/server';
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
 * Renders the auth header, tab switcher (active: register) and the register form.
 */
export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'register' });

  return (
    <div className="min-h-screen bg-[#EDEDED] dark:bg-[#111810] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-dark-bg rounded-3xl shadow-xl overflow-hidden">
        <AuthHeader
          title={t('welcome_title')}
          subtitle={t('welcome_subtitle')}
        />
        <TabSwitcher
          activeTab="register"
          loginLabel={t('tab_login')}
          registerLabel={t('tab_register')}
        />
        <RegisterForm />
      </div>
    </div>
  );
}
