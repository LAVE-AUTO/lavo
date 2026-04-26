'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context';
import { useToast } from '@/context/toast-context';
import { isPasswordValid } from '@/helpers/validators';
import { getFromApi, postWithApi } from '@/services/axios-service';

/* ─── Toggle switch ─── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ${checked ? 'bg-gold' : 'bg-[#C8C8B4] dark:bg-[#2C2C28]'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

/* ─── Section wrapper ─── */
function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#E8E8D8] dark:bg-dark-card rounded-2xl border border-[rgba(200,152,10,0.12)] overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/* ─── Section header ─── */
function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(200,152,10,0.1)]">
      <h2 className="text-[14px] font-black uppercase tracking-wider text-[#888] dark:text-[#666]">{title}</h2>
      {action}
    </div>
  );
}

/* ─── "Coming soon" pill — paints disabled actions so users know the wiring is in flight. */
function ComingSoonBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E0E0D0] dark:bg-[#2C2C28] text-[10px] font-bold uppercase tracking-wider text-[#888] dark:text-[#666] whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-[#c8980a]/60" />
      {label}
    </span>
  );
}

interface ProfileStats {
  completedCount: number;
  totalSpent:     number;
  /** ISO date of first paid entry, or null when none. */
  firstActivityAt: string | null;
}

interface ApiEntry {
  status: string;
  amount_paid: string | null;
  created_at: string;
}

/* ─── Main page ─── */
export default function ProfilePage() {
  const t      = useTranslations('profile');
  const locale = useLocale();
  const { user } = useAuth();
  const { success: showSuccess, error: showError } = useToast();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  /* Notification toggles — local-only state until PATCH /me/notifications ships;
     the toggles are visually disabled so the user knows the change won't persist. */
  const [notifWash]     = useState(true);
  const [notifReminder] = useState(true);
  const [notifOffers]   = useState(false);
  const [notifReview]   = useState(true);

  /* Modals (only password is wired to a real endpoint today) */
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  /* Mock saved cards — kept until GET /me/payment-methods exists */
  const cards = [
    { id: '1', brand: 'Visa',       last4: '4242', expiry: '12/27' },
    { id: '2', brand: 'Mastercard', last4: '1234', expiry: '09/26' },
  ];

  /* Avatar */
  const initial = user
    ? (user.first_name ? user.first_name[0] : user.email[0]).toUpperCase()
    : '?';

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || '';

  /* Live stats — derived from GET /me/entries (server is the source of truth, the
     user can only see their own entries which are already authorized).
     `member_since` falls back to user.created_at when no completed entry exists yet. */
  const [stats, setStats]               = useState<ProfileStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      const [ok, data] = await getFromApi('/me/entries?per_page=200');
      if (cancelled || !mountedRef.current) return;

      if (!ok) {
        setStats({ completedCount: 0, totalSpent: 0, firstActivityAt: null });
        setStatsLoading(false);
        return;
      }

      const entries = (data as { data?: { entries?: ApiEntry[] } })?.data?.entries ?? [];
      let completedCount = 0;
      let totalSpent     = 0;
      let firstActivityAt: string | null = null;
      for (const e of entries) {
        if (e.status === 'completed') {
          completedCount += 1;
          const paid = parseFloat(e.amount_paid ?? '0');
          if (!isNaN(paid)) totalSpent += paid;
          if (!firstActivityAt || e.created_at < firstActivityAt) firstActivityAt = e.created_at;
        }
      }

      setStats({ completedCount, totalSpent, firstActivityAt });
      setStatsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const memberSinceLabel = (() => {
    const iso = stats?.firstActivityAt ?? user?.created_at;
    if (!iso) return t('stats_empty');
    return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', { month: 'short', year: 'numeric' });
  })();

  const totalSpentLabel = stats
    ? `${stats.totalSpent.toLocaleString(locale === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
    : t('stats_empty');

  const completedLabel = stats ? String(stats.completedCount) : t('stats_empty');

  const isVerified = Boolean(user?.email_verified_at);

  const handleAvatarPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      showError(t('avatar_upload_error'));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError(t('avatar_upload_error'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        showError(t('avatar_upload_error'));
        return;
      }

      const body = (await response.json()) as { data?: { url?: string } };
      const url = body?.data?.url ?? null;
      if (!url) {
        showError(t('avatar_upload_error'));
        return;
      }

      setPhotoUrl(url);
      showSuccess(t('avatar_upload_success'));
    } catch {
      showError(t('avatar_upload_error'));
    }
  };

  const statsRow = [
    { label: t('stats_washes'), value: completedLabel, icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12h8M12 8v8"/>
      </svg>
    )},
    { label: t('stats_spent'),  value: totalSpentLabel, icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    )},
    { label: t('stats_since'),  value: memberSinceLabel, icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )},
  ];

  /* Card brand icons */
  const CardBrandIcon = ({ brand }: { brand: string }) => {
    if (brand === 'Visa') return (
      <span className="text-[11px] font-black tracking-widest text-[#1a1f71] dark:text-[#a8b4f8] bg-[#dde2ff] dark:bg-[#1a1f71]/30 px-2 py-0.5 rounded">VISA</span>
    );
    if (brand === 'Mastercard') return (
      <span className="flex gap-[-4px]">
        <span className="w-5 h-5 rounded-full bg-[#eb001b] opacity-90 inline-block" />
        <span className="w-5 h-5 rounded-full bg-[#f79e1b] opacity-90 inline-block -ml-2" />
      </span>
    );
    return <span className="text-[12px] font-bold text-[#888]">{brand}</span>;
  };

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] pb-28 sm:pb-10">
      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-5">

        {/* ── Header card ── */}
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-2xl border border-[rgba(200,152,10,0.12)] p-6">
          <div className="flex items-center gap-5">

            {/* Avatar — disabled until POST /me/avatar (or PATCH /me { avatar_url }) ships */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative w-20 h-20 rounded-full bg-gold/15 border-2 border-gold/30 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              title={t('avatar_upload_title')}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[28px] font-black text-gold">{initial}</span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                {t('avatar_upload_action')}
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarPick}
              className="hidden"
            />

            {/* Name + email */}
            <div className="min-w-0 flex-1">
              <p className="text-[19px] font-black text-[#1a1a1a] dark:text-white truncate leading-tight">{fullName}</p>
              <p className="text-[13px] text-[#888] dark:text-[#666] truncate mt-0.5">{user?.email}</p>
              {isVerified ? (
                <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-lavo-success bg-lavo-success/10 px-2.5 py-0.5 rounded-full">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {t('verified')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-[#999] bg-[#999]/10 px-2.5 py-0.5 rounded-full">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {t('not_verified')}
                </span>
              )}
            </div>
          </div>

          {/* Stats row — live from /me/entries (completed count, total spent, member since) */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-[rgba(200,152,10,0.1)]">
            {statsRow.map(({ label, value, icon }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                <div className="w-9 h-9 rounded-xl bg-gold/10 text-[#c8980a] flex items-center justify-center">
                  {icon}
                </div>
                <p className="text-[15px] sm:text-[17px] font-black text-[#1a1a1a] dark:text-white leading-none">
                  {statsLoading ? <span className="inline-block w-8 h-4 bg-gold/10 rounded animate-pulse" /> : value}
                </p>
                <p className="text-[11px] text-[#888] dark:text-[#666]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Informations personnelles ── */}
        <Section>
          <SectionHeader
            title={t('personal_info')}
            action={<ComingSoonBadge label={t('coming_soon')} />}
          />
          <div className="divide-y divide-[rgba(200,152,10,0.08)]">
            {[
              { label: t('first_name'), value: user?.first_name || '—' },
              { label: t('last_name'),  value: user?.last_name  || '—' },
              { label: t('phone'),      value: user?.phone      || '—' },
              { label: t('email'),      value: user?.email      || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#888] dark:text-[#666] w-28 shrink-0">{label}</span>
                <span className="text-[14px] text-[#1a1a1a] dark:text-white text-right truncate">{value}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Sécurité ── */}
        <Section>
          <SectionHeader title={t('password_section')} />
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-[14px] font-semibold text-[#1a1a1a] dark:text-white">{t('change_password')}</p>
              <p className="text-[12px] text-[#888] dark:text-[#666] mt-0.5">{t('password_desc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-gold/40 rounded-xl text-[12px] font-bold text-[#c8980a] hover:bg-gold/10 transition-colors cursor-pointer shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              {t('modify')}
            </button>
          </div>
        </Section>

        {/* ── Moyens de paiement ── */}
        <Section>
          <SectionHeader
            title={t('payment_section')}
            action={<ComingSoonBadge label={t('coming_soon')} />}
          />
          {cards.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <p className="text-[13px] text-[#888] dark:text-[#666]">{t('no_cards')}</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(200,152,10,0.08)]">
              {cards.map((card) => (
                <div key={card.id} className="flex items-center gap-4 px-5 py-3.5 opacity-60">
                  <CardBrandIcon brand={card.brand} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#1a1a1a] dark:text-white">
                      {card.brand} •••• {card.last4}
                    </p>
                    <p className="text-[12px] text-[#888] dark:text-[#666]">{t('card_expires')} {card.expiry}</p>
                  </div>
                  <button
                    type="button"
                    disabled
                    title={t('coming_soon')}
                    className="text-[12px] font-bold text-[#999] cursor-not-allowed"
                  >
                    {t('payment_remove')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Notifications ── */}
        <Section>
          <SectionHeader title={t('notif_section')} action={<ComingSoonBadge label={t('coming_soon')} />} />
          <div className="divide-y divide-[rgba(200,152,10,0.08)] opacity-60 pointer-events-none">
            {[
              { label: t('notif_wash_status'),    desc: t('notif_wash_status_desc'),    checked: notifWash },
              { label: t('notif_reminder'),       desc: t('notif_reminder_desc'),       checked: notifReminder },
              { label: t('notif_offers'),         desc: t('notif_offers_desc'),         checked: notifOffers },
              { label: t('notif_review'),         desc: t('notif_review_desc'),         checked: notifReview },
            ].map(({ label, desc, checked }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#1a1a1a] dark:text-white leading-snug">{label}</p>
                  <p className="text-[12px] text-[#888] dark:text-[#666] mt-0.5 leading-snug">{desc}</p>
                </div>
                <Toggle checked={checked} onChange={() => { /* disabled: PATCH /me/notifications missing */ }} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Aide & légal ── */}
        <Section>
          <SectionHeader title={t('help_section')} />
          <div className="divide-y divide-[rgba(200,152,10,0.08)]">
            {[
              { href: '/support',              label: t('help_center'),  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
              { href: '/cgu',                  label: t('help_cgu'),     icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
              { href: '#',                     label: t('help_privacy'), icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
            ].map(({ href, label, icon }) => (
              <Link
                key={label}
                href={href as Parameters<typeof Link>[0]['href']}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gold/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[#c8980a]">{icon}</span>
                  <span className="text-[14px] font-semibold text-[#1a1a1a] dark:text-white">{label}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[#C8C8B4] dark:text-[#444] group-hover:text-[#c8980a] transition-colors" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            ))}
          </div>
        </Section>

        {/* ── Zone de danger ── */}
        <div className="bg-lavo-error/5 rounded-2xl border border-lavo-error/20 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-lavo-error/15">
            <h2 className="text-[14px] font-black uppercase tracking-wider text-lavo-error/70">{t('danger_zone')}</h2>
            <ComingSoonBadge label={t('coming_soon')} />
          </div>
          <div className="flex items-center justify-between px-5 py-4 opacity-60">
            <div>
              <p className="text-[14px] font-semibold text-[#1a1a1a] dark:text-white">{t('delete_account')}</p>
              <p className="text-[12px] text-[#888] dark:text-[#666] mt-0.5 max-w-[260px] leading-snug">{t('danger_desc')}</p>
            </div>
            <button
              type="button"
              disabled
              title={t('coming_soon')}
              className="shrink-0 px-4 py-2 bg-lavo-error/5 border border-lavo-error/20 rounded-xl text-[12px] font-bold text-lavo-error/50 cursor-not-allowed"
            >
              {t('delete_account_btn')}
            </button>
          </div>
        </div>

      </div>

      {/* ── Modals — only password is wired to a real endpoint today ── */}
      {showPasswordModal && (
        <PasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => showSuccess(t('toast_password_success'))}
        />
      )}
    </main>
  );
}

/* ═══════════════════════════════════════
   PASSWORD MODAL — only modal wired to a real endpoint
   (POST /auth/change-password)
═══════════════════════════════════════ */
function PasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const t = useTranslations('profile');
  const [oldPwd,     setOldPwd]     = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error,      setError]      = useState('');
  const [done,       setDone]       = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const handleSubmit = async () => {
    setError('');
    if (!oldPwd || !newPwd || !confirmPwd) { setError(t('error_required')); return; }
    if (newPwd !== confirmPwd) { setError(t('error_mismatch')); return; }
    if (!isPasswordValid(newPwd)) { setError(t('error_too_short')); return; }

    setSubmitting(true);
    const [ok, data] = await postWithApi(
      '/auth/change-password',
      { current_password: oldPwd, new_password: newPwd, confirm_new_password: confirmPwd },
      { successStatus: 200 },
    );
    if (!mountedRef.current) return;
    setSubmitting(false);

    if (!ok) {
      const errBody = data as { code?: string; message?: string } | null;
      // Backend returns 401 UNAUTHORIZED when the current password is wrong.
      if (errBody?.code === 'UNAUTHORIZED') {
        setError(t('error_old_password'));
      } else {
        setError(t('error_generic'));
      }
      return;
    }

    setDone(true);
    onSuccess();
  };

  const inputClass = 'w-full px-4 py-2.5 bg-[#F5F5E6] dark:bg-[#0F0F0D] border border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] text-[#1a1a1a] dark:text-white focus:outline-none focus:border-gold transition-colors';

  return (
    <Modal onClose={onClose}>
      {done ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-full bg-lavo-success/15 flex items-center justify-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p className="text-[18px] font-black text-[#1a1a1a] dark:text-white">{t('password_success')}</p>
          <button type="button" onClick={onClose} className="w-full py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer">{t('close')}</button>
        </div>
      ) : (
        <>
          <h3 className="text-[18px] font-black text-[#1a1a1a] dark:text-white mb-5">{t('change_password')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('old_password')}</label>
              <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('new_password')}</label>
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('confirm_password')}</label>
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} className={inputClass} />
            </div>
            {error && <p className="text-[13px] text-lavo-error font-semibold">{error}</p>}
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] dark:hover:bg-[#1A1A18] transition-colors cursor-pointer disabled:opacity-50">{t('cancel')}</button>
            <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              )}
              {t('confirm')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════
   GENERIC MODAL WRAPPER
═══════════════════════════════════════ */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Single overlay layer: backdrop + dialog wrapper share the same click handler
  // so any click outside the inner card dismisses the modal. The inner card
  // stops propagation so its content stays interactive.
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#F5F5E6] dark:bg-[#1A1A18] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 animate-fade-in-up"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#666] dark:text-[#B0B0A0] hover:text-gold transition-colors cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
