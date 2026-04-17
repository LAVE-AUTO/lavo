'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context';
import { useToast } from '@/context/toast-context';
import { isPasswordValid, validateName } from '@/helpers/validators';

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

/* ─── Main page ─── */
export default function ProfilePage() {
  const t = useTranslations('profile');
  const { user } = useAuth();
  const { success: showSuccess } = useToast();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Notification toggles */
  const [notifWash,     setNotifWash]     = useState(true);
  const [notifReminder, setNotifReminder] = useState(true);
  const [notifOffers,   setNotifOffers]   = useState(false);
  const [notifReview,   setNotifReview]   = useState(true);

  /* Modals */
  const [showEditModal,     setShowEditModal]     = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [showAddCardModal,  setShowAddCardModal]  = useState(false);

  /* Mock saved cards */
  const [cards, setCards] = useState([
    { id: '1', brand: 'Visa',       last4: '4242', expiry: '12/27' },
    { id: '2', brand: 'Mastercard', last4: '1234', expiry: '09/26' },
  ]);

  const removeCard = (id: string) => {
    setCards((c) => c.filter((card) => card.id !== id));
    showSuccess(t('remove_card_success'));
  };

  /* Avatar */
  const initial = user
    ? (user.first_name ? user.first_name[0] : user.email[0]).toUpperCase()
    : '?';

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || '';

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhotoUrl(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    return () => { if (photoUrl) URL.revokeObjectURL(photoUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Mock stats */
  const stats = [
    { label: t('stats_washes'), value: '12',      icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12h8M12 8v8"/>
      </svg>
    )},
    { label: t('stats_spent'),  value: '147,50 $', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    )},
    { label: t('stats_since'),  value: 'Jan 2025', icon: (
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

            {/* Avatar */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative w-20 h-20 rounded-full bg-gold/15 border-2 border-gold/30 flex items-center justify-center cursor-pointer overflow-hidden group shrink-0"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[28px] font-black text-gold">{initial}</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

            {/* Name + email */}
            <div className="min-w-0 flex-1">
              <p className="text-[19px] font-black text-[#1a1a1a] dark:text-white truncate leading-tight">{fullName}</p>
              <p className="text-[13px] text-[#888] dark:text-[#666] truncate mt-0.5">{user?.email}</p>
              <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-lavo-success bg-lavo-success/10 px-2.5 py-0.5 rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                {t('verified')}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-[rgba(200,152,10,0.1)]">
            {stats.map(({ label, value, icon }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                <div className="w-9 h-9 rounded-xl bg-gold/10 text-[#c8980a] flex items-center justify-center">
                  {icon}
                </div>
                <p className="text-[15px] sm:text-[17px] font-black text-[#1a1a1a] dark:text-white leading-none">{value}</p>
                <p className="text-[11px] text-[#888] dark:text-[#666]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Informations personnelles ── */}
        <Section>
          <SectionHeader
            title={t('personal_info')}
            action={
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 text-[12px] font-bold text-[#c8980a] hover:text-gold-hover transition-colors cursor-pointer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {t('edit_profile')}
              </button>
            }
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
            action={
              <button
                type="button"
                onClick={() => setShowAddCardModal(true)}
                className="flex items-center gap-1.5 text-[12px] font-bold text-[#c8980a] hover:text-gold-hover transition-colors cursor-pointer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {t('payment_add')}
              </button>
            }
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
                <div key={card.id} className="flex items-center gap-4 px-5 py-3.5">
                  <CardBrandIcon brand={card.brand} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#1a1a1a] dark:text-white">
                      {card.brand} •••• {card.last4}
                    </p>
                    <p className="text-[12px] text-[#888] dark:text-[#666]">{t('card_expires')} {card.expiry}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCard(card.id)}
                    className="text-[12px] font-bold text-lavo-error hover:text-lavo-error/80 transition-colors cursor-pointer"
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
          <SectionHeader title={t('notif_section')} />
          <div className="divide-y divide-[rgba(200,152,10,0.08)]">
            {[
              { label: t('notif_wash_status'),    desc: t('notif_wash_status_desc'),    checked: notifWash,     toggle: () => { setNotifWash(v => !v); showSuccess(t('toast_notif_saved')); } },
              { label: t('notif_reminder'),       desc: t('notif_reminder_desc'),       checked: notifReminder, toggle: () => { setNotifReminder(v => !v); showSuccess(t('toast_notif_saved')); } },
              { label: t('notif_offers'),         desc: t('notif_offers_desc'),         checked: notifOffers,   toggle: () => { setNotifOffers(v => !v); showSuccess(t('toast_notif_saved')); } },
              { label: t('notif_review'),         desc: t('notif_review_desc'),         checked: notifReview,   toggle: () => { setNotifReview(v => !v); showSuccess(t('toast_notif_saved')); } },
            ].map(({ label, desc, checked, toggle }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#1a1a1a] dark:text-white leading-snug">{label}</p>
                  <p className="text-[12px] text-[#888] dark:text-[#666] mt-0.5 leading-snug">{desc}</p>
                </div>
                <Toggle checked={checked} onChange={toggle} />
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
          <div className="px-5 py-4 border-b border-lavo-error/15">
            <h2 className="text-[14px] font-black uppercase tracking-wider text-lavo-error/70">{t('danger_zone')}</h2>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-[14px] font-semibold text-[#1a1a1a] dark:text-white">{t('delete_account')}</p>
              <p className="text-[12px] text-[#888] dark:text-[#666] mt-0.5 max-w-[260px] leading-snug">{t('danger_desc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="shrink-0 px-4 py-2 bg-lavo-error/10 hover:bg-lavo-error/20 border border-lavo-error/30 rounded-xl text-[12px] font-bold text-lavo-error transition-colors cursor-pointer"
            >
              {t('delete_account_btn')}
            </button>
          </div>
        </div>

      </div>

      {/* ── Modals ── */}
      {showEditModal     && <EditProfileModal user={user} onClose={() => setShowEditModal(false)}     onSuccess={() => showSuccess(t('toast_save_success'))} />}
      {showPasswordModal && <PasswordModal                onClose={() => setShowPasswordModal(false)} onSuccess={() => showSuccess(t('toast_password_success'))} />}
      {showDeleteModal   && <DeleteModal                  onClose={() => setShowDeleteModal(false)}   onSuccess={() => showSuccess(t('toast_delete_success'))} />}
      {showAddCardModal  && <AddCardModal                 onClose={() => setShowAddCardModal(false)}  onSuccess={() => showSuccess(t('add_card_success'))} />}
    </main>
  );
}

/* ═══════════════════════════════════════
   EDIT PROFILE MODAL
═══════════════════════════════════════ */
function EditProfileModal({ user, onClose, onSuccess }: { user: ReturnType<typeof useAuth>['user']; onClose: () => void; onSuccess: () => void }) {
  const t = useTranslations('profile');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName,  setLastName]  = useState(user?.last_name  || '');
  const [phone,     setPhone]     = useState(user?.phone      || '');
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string }>({});

  const handleSave = () => {
    const errs: { firstName?: string; lastName?: string } = {};
    if (!firstName.trim()) {
      errs.firstName = t('error_required');
    } else if (!validateName(firstName)) {
      errs.firstName = t('error_name_invalid');
    }
    if (!lastName.trim()) {
      errs.lastName = t('error_required');
    } else if (!validateName(lastName)) {
      errs.lastName = t('error_name_invalid');
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    onSuccess();
    onClose();
  };

  const inputClass = 'w-full px-4 py-2.5 bg-[#F5F5E6] dark:bg-[#0F0F0D] border border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] text-[#1a1a1a] dark:text-white focus:outline-none focus:border-gold transition-colors';

  return (
    <Modal onClose={onClose}>
      <h3 className="text-[18px] font-black text-[#1a1a1a] dark:text-white mb-5">{t('edit_title')}</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('first_name')}</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => { setFirstName(e.target.value); if (fieldErrors.firstName) setFieldErrors((prev) => ({ ...prev, firstName: undefined })); }}
            aria-invalid={fieldErrors.firstName ? 'true' : undefined}
            aria-describedby={fieldErrors.firstName ? 'edit-firstName-error' : undefined}
            className={`${inputClass}${fieldErrors.firstName ? ' border-lavo-error' : ''}`}
          />
          {fieldErrors.firstName && <p id="edit-firstName-error" role="alert" className="mt-1 text-[12px] text-lavo-error font-medium">! {fieldErrors.firstName}</p>}
        </div>
        <div>
          <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('last_name')}</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => { setLastName(e.target.value); if (fieldErrors.lastName) setFieldErrors((prev) => ({ ...prev, lastName: undefined })); }}
            aria-invalid={fieldErrors.lastName ? 'true' : undefined}
            aria-describedby={fieldErrors.lastName ? 'edit-lastName-error' : undefined}
            className={`${inputClass}${fieldErrors.lastName ? ' border-lavo-error' : ''}`}
          />
          {fieldErrors.lastName && <p id="edit-lastName-error" role="alert" className="mt-1 text-[12px] text-lavo-error font-medium">! {fieldErrors.lastName}</p>}
        </div>
        <div>
          <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('phone')}</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phone_placeholder')} className={inputClass} />
        </div>
        <div>
          <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('email')}</label>
          <input type="email" value={user?.email || ''} disabled className="w-full px-4 py-2.5 bg-[#E0E0D0] dark:bg-[#151514] border border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] text-[#999] cursor-not-allowed" />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onClose} className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] dark:hover:bg-[#1A1A18] transition-colors cursor-pointer">
          {t('cancel')}
        </button>
        <button type="button" onClick={handleSave} className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer">
          {t('save')}
        </button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════
   ADD CARD MODAL
═══════════════════════════════════════ */
function AddCardModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const t = useTranslations('profile');
  const [number,  setNumber]  = useState('');
  const [expiry,  setExpiry]  = useState('');
  const [cvc,     setCvc]     = useState('');
  const [name,    setName]    = useState('');

  const formatCardNumber = (val: string) => val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry     = (val: string) => { const d = val.replace(/\D/g, '').slice(0, 4); return d.length >= 3 ? `${d.slice(0,2)}/${d.slice(2)}` : d; };

  const canSubmit = number.replace(/\s/g, '').length === 16 && expiry.length === 5 && cvc.length >= 3 && name.trim().length > 1;

  const inputClass = 'w-full px-4 py-2.5 bg-[#F5F5E6] dark:bg-[#0F0F0D] border border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] text-[#1a1a1a] dark:text-white focus:outline-none focus:border-gold transition-colors';

  return (
    <Modal onClose={onClose}>
      <h3 className="text-[18px] font-black text-[#1a1a1a] dark:text-white mb-5">{t('add_card_title')}</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('card_number')}</label>
          <input type="text" inputMode="numeric" value={number} onChange={(e) => setNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('card_expiry_label')}</label>
            <input type="text" inputMode="numeric" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} placeholder="MM/AA" className={inputClass} />
          </div>
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">CVC</label>
            <input type="text" inputMode="numeric" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="•••" className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('card_holder')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="NOM PRÉNOM" className={`${inputClass} uppercase`} />
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#888] dark:text-[#666]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          {t('card_secure_hint')}
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onClose} className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] dark:hover:bg-[#1A1A18] transition-colors cursor-pointer">
          {t('cancel')}
        </button>
        <button type="button" onClick={() => { if (canSubmit) { onSuccess(); onClose(); } }} disabled={!canSubmit} className="flex-1 py-3 bg-gold hover:bg-gold-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer">
          {t('payment_add')}
        </button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════
   PASSWORD MODAL
═══════════════════════════════════════ */
function PasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const t = useTranslations('profile');
  const [oldPwd,     setOldPwd]     = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error,      setError]      = useState('');
  const [done,       setDone]       = useState(false);

  const handleSubmit = () => {
    setError('');
    if (!oldPwd || !newPwd || !confirmPwd) { setError(t('error_required')); return; }
    if (newPwd !== confirmPwd) { setError(t('error_mismatch')); return; }
    if (!isPasswordValid(newPwd)) { setError(t('error_too_short')); return; }
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
            <button type="button" onClick={onClose} className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] dark:hover:bg-[#1A1A18] transition-colors cursor-pointer">{t('cancel')}</button>
            <button type="button" onClick={handleSubmit} className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer">{t('confirm')}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════
   DELETE MODAL
═══════════════════════════════════════ */
function DeleteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const t = useTranslations('profile');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const canDelete = password.length >= 8;

  const handleDelete = () => {
    if (!canDelete) { setError(t('error_required')); return; }
    onSuccess();
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center gap-2 mb-5">
        <div className="w-14 h-14 rounded-full bg-lavo-error/15 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E8472A" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </div>
        <h3 className="text-[18px] font-black text-lavo-error">{t('delete_title')}</h3>
        <p className="text-[13px] text-[#555] dark:text-[#A0A090] text-center leading-relaxed">{t('delete_warning')}</p>
      </div>
      <div>
        <label className="block text-[12px] font-bold uppercase tracking-wider text-[#555] dark:text-[#888] mb-1.5">{t('confirm_with_password')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          placeholder={t('password_placeholder')}
          className="w-full px-4 py-2.5 bg-[#F5F5E6] dark:bg-[#0F0F0D] border border-lavo-error/30 rounded-xl text-[14px] text-[#1a1a1a] dark:text-white focus:outline-none focus:border-lavo-error transition-colors"
        />
      </div>
      {error && <p className="mt-2 text-[13px] text-lavo-error font-semibold">{error}</p>}
      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onClose} className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] dark:hover:bg-[#1A1A18] transition-colors cursor-pointer">{t('cancel')}</button>
        <button type="button" onClick={handleDelete} disabled={!canDelete} className={['flex-1 py-3 rounded-xl text-[14px] font-bold text-white transition-colors', canDelete ? 'bg-lavo-error hover:bg-lavo-error/90 cursor-pointer' : 'bg-[#D0D0C0] dark:bg-[#2A2A28] text-[#999] cursor-not-allowed'].join(' ')}>{t('delete_confirm')}</button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════
   GENERIC MODAL WRAPPER
═══════════════════════════════════════ */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-[#F5F5E6] dark:bg-[#1A1A18] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6">
          {children}
        </div>
      </div>
    </>
  );
}
