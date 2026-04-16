import React from 'react';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../../i18n';

export const AccountPreferencesTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ru').slice(0, 2);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t('crm.account.preferences.title')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('crm.account.preferences.subtitle')}</p>
      </div>

      <div>
        <label className="text-[11px] text-slate-500">{t('crm.account.preferences.language')}</label>
        <select
          value={lang === 'en' ? 'en' : lang === 'tr' ? 'tr' : 'ru'}
          onChange={(e) => setAppLanguage(e.target.value as 'ru' | 'en' | 'tr')}
          className="mt-2 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#222222]/40"
        >
          <option value="ru">Русский</option>
          <option value="en">English</option>
          <option value="tr">Türkçe</option>
        </select>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">{t('crm.account.preferences.hint')}</p>
    </div>
  );
};
