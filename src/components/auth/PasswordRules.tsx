'use client';

import { useTranslations } from 'next-intl';

type RuleKey =
  | 'password_rule_min'
  | 'password_rule_upper'
  | 'password_rule_lower'
  | 'password_rule_number'
  | 'password_rule_special'
  | 'password_rule_chars';

interface Rule {
  key: RuleKey;
  test: (password: string) => boolean;
}

const PASSWORD_RULES: Rule[] = [
  { key: 'password_rule_min',     test: (p) => p.length >= 8 },
  { key: 'password_rule_upper',   test: (p) => /[A-Z]/.test(p) },
  { key: 'password_rule_lower',   test: (p) => /[a-z]/.test(p) },
  { key: 'password_rule_number',  test: (p) => /[0-9]/.test(p) },
  { key: 'password_rule_special', test: (p) => /[@$!%*#?&_\-+=]/.test(p) },
  { key: 'password_rule_chars',   test: (p) => /^[A-Za-z0-9@$!%*#?&_\-+=]+$/.test(p) },
];

interface PasswordRulesProps {
  password: string;
  namespace?: 'register' | 'reset_password' | 'change_password' | 'station_apply';
}

/**
 * Real-time password strength rules displayed below the password field.
 * Hidden when the password field is empty.
 */
export function PasswordRules({ password, namespace = 'register' }: PasswordRulesProps) {
  const t = useTranslations(namespace);

  if (!password) return null;

  return (
    <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 px-0.5 animate-fade-in">
      {PASSWORD_RULES.map(({ key, test }) => {
        const valid = test(password);
        return (
          <p
            key={key}
            className={`text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-200 ${
              valid ? 'text-Hurryline-success' : 'text-Hurryline-muted'
            }`}
          >
            <span className="w-3 text-center font-bold shrink-0">
              {valid ? '+' : '-'}
            </span>
            {t(key)}
          </p>
        );
      })}
    </div>
  );
}
