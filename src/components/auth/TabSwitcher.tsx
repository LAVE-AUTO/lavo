'use client';

import { useRouter } from '@/i18n/navigation';

interface TabSwitcherProps {
  activeTab: 'login' | 'register';
  loginLabel: string;
  registerLabel: string;
  /** Override the login route (defaults to `/login`). Used by the station auth pages. */
  loginHref?: string;
  /** Override the register route (defaults to `/register`). Used by the station auth pages. */
  registerHref?: string;
}

/**
 * Tab switcher for navigating between Login and Register pages.
 *
 * @param activeTab - Currently active tab identifier
 * @param loginLabel - Translated label for the login tab
 * @param registerLabel - Translated label for the register tab
 * @param loginHref - Target path for the login tab (defaults to `/login`)
 * @param registerHref - Target path for the register tab (defaults to `/register`)
 */
export function TabSwitcher({
  activeTab,
  loginLabel,
  registerLabel,
  loginHref = '/login',
  registerHref = '/register',
}: TabSwitcherProps) {
  const router = useRouter();

  const goTo = (tab: 'login' | 'register') => {
    if (tab === activeTab) return;
    router.push(tab === 'login' ? loginHref : registerHref);
  };

  const activeClass = 'bg-gold text-dark-bg font-bold';
  const inactiveClass =
    'bg-transparent text-[#333] dark:text-white font-semibold hover:bg-black/5 dark:hover:bg-white/5';

  return (
    <div className="flex mb-4 bg-[#E0E0D0] dark:bg-tab-inactive rounded-[10px] p-1 gap-1">
      {(
        [
          { key: 'login', label: loginLabel },
          { key: 'register', label: registerLabel },
        ] as const
      ).map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => goTo(key)}
          className={`flex-1 py-2.5 rounded-lg text-[15px] tracking-wide transition-all duration-200 ${
            activeTab === key ? activeClass : inactiveClass
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
