'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context';
import { useToast } from '@/context/toast-context';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const { user } = useAuth();
  const { success: showSuccess } = useToast();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Form state (mock — no backend calls) */
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email] = useState(user?.email || '');

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const initial = user
    ? (user.first_name ? user.first_name[0] : user.email[0]).toUpperCase()
    : '?';

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] pb-24 sm:pb-8">
      <div className="px-4 pt-6 max-w-lg mx-auto space-y-6">
        <h1 className="text-[22px] font-black text-[#0A0A14] dark:text-white">{t('title')}</h1>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current && fileRef.current.click()}
            className="relative w-24 h-24 rounded-full bg-gold/20 border-2 border-gold/40 flex items-center justify-center cursor-pointer overflow-hidden group"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[32px] font-black text-gold">{initial}</span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <p className="text-[13px] text-[#999] dark:text-[#777]">{t('change_photo')}</p>
        </div>

        {/* Info form */}
        <div className="bg-[#E8E8D8] dark:bg-[#1A1A18] rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5 space-y-4">
          <h2 className="text-[16px] font-black text-[#0A0A14] dark:text-white">{t('personal_info')}</h2>

          <div>
            <label className="block text-[13px] font-bold text-[#555] dark:text-[#B0B0A0] mb-1">{t('first_name')}</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#F5F5E6] dark:bg-[#0F0F0D] border border-[#D0D0C0] dark:border-tab-inactive rounded-lg text-[14px] text-[#0A0A14] dark:text-white focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[#555] dark:text-[#B0B0A0] mb-1">{t('last_name')}</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#F5F5E6] dark:bg-[#0F0F0D] border border-[#D0D0C0] dark:border-tab-inactive rounded-lg text-[14px] text-[#0A0A14] dark:text-white focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[#555] dark:text-[#B0B0A0] mb-1">{t('email')}</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-2.5 bg-[#E0E0D0] dark:bg-[#151514] border border-[#D0D0C0] dark:border-tab-inactive rounded-lg text-[14px] text-[#999] dark:text-[#666] cursor-not-allowed"
            />
          </div>

          <button
            type="button"
            onClick={() => showSuccess(t('toast_save_success'))}
            className="w-full py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer"
          >
            {t('save')}
          </button>
        </div>

        {/* Password change */}
        <div className="bg-[#E8E8D8] dark:bg-[#1A1A18] rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-black text-[#0A0A14] dark:text-white">{t('password_section')}</h2>
              <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5">{t('password_desc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 border-2 border-gold rounded-lg text-[13px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
            >
              {t('change_password')}
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-lavo-error/5 dark:bg-lavo-error/5 rounded-xl border border-lavo-error/20 p-5 space-y-3">
          <h2 className="text-[16px] font-black text-lavo-error">{t('danger_zone')}</h2>
          <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] leading-relaxed">
            {t('danger_desc')}
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-5 py-2.5 bg-lavo-error hover:bg-lavo-error/90 rounded-lg text-[13px] font-bold text-white transition-colors cursor-pointer"
          >
            {t('delete_account')}
          </button>
        </div>
      </div>

      {/* Password change modal */}
      {showPasswordModal && <PasswordModal onClose={() => setShowPasswordModal(false)} onSuccess={() => showSuccess(t('toast_password_success'))} />}

      {/* Delete account modal */}
      {showDeleteModal && <DeleteModal onClose={() => setShowDeleteModal(false)} onSuccess={() => showSuccess(t('toast_delete_success'))} />}
    </main>
  );
}

/* ---- Password change modal ---- */
function PasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const t = useTranslations('profile');
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = () => {
    setError('');
    if (!oldPwd || !newPwd || !confirmPwd) {
      setError(t('error_required'));
      return;
    }
    if (newPwd !== confirmPwd) {
      setError(t('error_mismatch'));
      return;
    }
    if (newPwd.length < 8) {
      setError(t('error_too_short'));
      return;
    }
    setSuccess(true);
    onSuccess();
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="bg-[#F5F5E6] dark:bg-[#1A1A18] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
          {success ? (
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-lavo-success/15 flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h3 className="text-[18px] font-black text-[#0A0A14] dark:text-white">{t('password_success')}</h3>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer"
              >
                {t('close')}
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-[18px] font-black text-[#0A0A14] dark:text-white">{t('change_password')}</h3>

              <div>
                <label className="block text-[13px] font-bold text-[#555] dark:text-[#B0B0A0] mb-1">{t('old_password')}</label>
                <input
                  type="password"
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#F5F5E6] dark:bg-[#0F0F0D] border border-[#D0D0C0] dark:border-tab-inactive rounded-lg text-[14px] text-[#0A0A14] dark:text-white focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#555] dark:text-[#B0B0A0] mb-1">{t('new_password')}</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#F5F5E6] dark:bg-[#0F0F0D] border border-[#D0D0C0] dark:border-tab-inactive rounded-lg text-[14px] text-[#0A0A14] dark:text-white focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#555] dark:text-[#B0B0A0] mb-1">{t('confirm_password')}</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#F5F5E6] dark:bg-[#0F0F0D] border border-[#D0D0C0] dark:border-tab-inactive rounded-lg text-[14px] text-[#0A0A14] dark:text-white focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              {error && <p className="text-[13px] text-lavo-error font-semibold">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] transition-colors cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer"
                >
                  {t('confirm')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ---- Delete account modal ---- */
function DeleteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const t = useTranslations('profile');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const canDelete = password.length >= 8;

  const handleDelete = () => {
    if (!canDelete) {
      setError(t('error_required'));
      return;
    }
    // Mock: just close
    onSuccess();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="bg-[#F5F5E6] dark:bg-[#1A1A18] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
          <div className="w-14 h-14 rounded-full bg-lavo-error/15 flex items-center justify-center mx-auto">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </div>

          <h3 className="text-[18px] font-black text-lavo-error text-center">{t('delete_title')}</h3>
          <p className="text-[14px] text-[#555] dark:text-[#B0B0A0] text-center leading-relaxed">
            {t('delete_warning')}
          </p>

          <div>
            <label className="block text-[13px] font-bold text-[#555] dark:text-[#B0B0A0] mb-1">{t('confirm_with_password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder={t('password_placeholder')}
              className="w-full px-4 py-2.5 bg-[#F5F5E6] dark:bg-[#0F0F0D] border border-lavo-error/30 rounded-lg text-[14px] text-[#0A0A14] dark:text-white focus:outline-none focus:border-lavo-error transition-colors"
            />
          </div>

          {error && <p className="text-[13px] text-lavo-error font-semibold">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className={[
                'flex-1 py-3 rounded-xl text-[14px] font-bold text-white transition-colors',
                canDelete ? 'bg-lavo-error hover:bg-lavo-error/90 cursor-pointer' : 'bg-[#D0D0C0] dark:bg-[#2A2A28] text-[#999] cursor-not-allowed',
              ].join(' ')}
            >
              {t('delete_confirm')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
