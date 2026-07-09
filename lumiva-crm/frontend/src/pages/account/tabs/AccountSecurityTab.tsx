import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeMyPassword } from '../../../api/users';

export const AccountSecurityTab: React.FC = () => {
  const { t } = useTranslation();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setPassError(null);
    setPassSuccess(null);
    if (!oldPassword || !newPassword) {
      setPassError(t('crm.account.security.errors.required'));
      return;
    }
    if (newPassword !== newPassword2) {
      setPassError(t('crm.account.security.errors.mismatch'));
      return;
    }
    setPassSaving(true);
    try {
      await changeMyPassword(oldPassword, newPassword);
      setPassSuccess(t('crm.account.security.success'));
      setOldPassword('');
      setNewPassword('');
      setNewPassword2('');
    } catch (e: any) {
      setPassError(e.message || t('crm.account.security.errors.failed'));
    } finally {
      setPassSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t('crm.account.security.title')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('crm.account.security.subtitle')}</p>
      </div>

      {passError && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {passError}
        </div>
      )}
      {passSuccess && (
        <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          {passSuccess}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-[11px] text-slate-500">{t('crm.account.security.current')}</label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#222222]/40"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500">{t('crm.account.security.new')}</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#222222]/40"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500">{t('crm.account.security.confirm')}</label>
          <input
            type="password"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            autoComplete="new-password"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#222222]/40"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleChangePassword()}
        disabled={passSaving}
        className="btn-primary btn-primary-lg"
      >
        {passSaving ? t('crm.account.security.saving') : t('crm.account.security.save')}
      </button>
    </div>
  );
};
