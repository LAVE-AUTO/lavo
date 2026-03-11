'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';
import { Spinner } from '@/components/ui/Spinner';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" fill="#1877F2" />
    </svg>
  );
}

interface SocialButtonsProps {
  namespace?: 'register' | 'login';
}

/**
 * OAuth social login buttons (Google and Facebook) with divider.
 */
export function SocialButtons({ namespace = 'register' }: SocialButtonsProps) {
  const t = useTranslations(namespace);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingFacebook, setLoadingFacebook] = useState(false);

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      await signIn('google');
    } catch {
      setLoadingGoogle(false);
    }
  };

  const handleFacebook = async () => {
    setLoadingFacebook(true);
    try {
      await signIn('facebook');
    } catch {
      setLoadingFacebook(false);
    }
  };

  const btnClass = [
    'flex items-center gap-2.5 px-5 py-2.5 rounded-xl',
    'bg-[#F0F0E8] dark:bg-tab-inactive',
    'border border-[#CCCCCC] dark:border-tab-inactive',
    'hover:bg-[#E8E8E0] dark:hover:bg-tab-inactive',
    'transition-colors duration-150 text-[14px] font-semibold',
    'text-[#333] dark:text-white',
  ].join(' ');

  return (
    <div>
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-[#E0E0E0] dark:bg-[#444]" />
        <span className="text-[12px] font-medium text-[#888] dark:text-lavo-muted tracking-wider uppercase">
          {t('or_continue_with')}
        </span>
        <div className="flex-1 h-px bg-[#E0E0E0] dark:bg-[#444]" />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loadingGoogle || loadingFacebook}
          className={`flex-1 ${btnClass} cursor-pointer disabled:opacity-60`}
          aria-label="Continue with Google"
        >
          {loadingGoogle ? <Spinner size="sm" /> : <GoogleIcon />}
          Google
        </button>
        <button
          type="button"
          onClick={handleFacebook}
          disabled={loadingGoogle || loadingFacebook}
          className={`flex-1 ${btnClass} cursor-pointer disabled:opacity-60`}
          aria-label="Continue with Facebook"
        >
          {loadingFacebook ? <Spinner size="sm" /> : <FacebookIcon />}
          Facebook
        </button>
      </div>
    </div>
  );
}
