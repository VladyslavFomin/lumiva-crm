import React from 'react';
import type { TFunction } from 'i18next';

function generateCf7Secret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += chars[bytes[i]! % chars.length];
  return s;
}

export { generateCf7Secret };

type Props = {
  label: string;
  onLabelChange: (v: string) => void;
  catalogPlaceholder: string;
  secret: string;
  onSecretChange: (v: string) => void;
  onRegenerateSecret: () => void;
  onClearSecret: () => void;
  t: TFunction;
};

export const WordpressCf7ConnectGuide: React.FC<Props> = ({
  label,
  onLabelChange,
  catalogPlaceholder,
  secret,
  onSecretChange,
  onRegenerateSecret,
  onClearSecret,
  t,
}) => {
  return (
    <div className="space-y-4">
      <ol className="list-none space-y-3 text-[11px] text-slate-800 leading-relaxed">
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
            1
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900">
              {t('crm.automations.panel.integrations.connectWordpressCf7Step1Title')}
            </div>
            <p className="mt-0.5 text-slate-600">
              {t('crm.automations.panel.integrations.connectWordpressCf7Step1Body')}
            </p>
            <label className="mt-2 mb-1 block text-[10px] font-medium text-slate-500">
              {t('crm.automations.panel.integrations.connectLabelField')}
            </label>
            <input
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              placeholder={catalogPlaceholder}
            />
          </div>
        </li>
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
            2
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900">
              {t('crm.automations.panel.integrations.connectWordpressCf7Step2Title')}
            </div>
            <p className="mt-0.5 text-slate-600">
              {t('crm.automations.panel.integrations.connectWordpressCf7Step2Body')}
            </p>
            <input
              type="text"
              autoComplete="off"
              value={secret}
              onChange={(e) => onSecretChange(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
              placeholder=""
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRegenerateSecret}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-800 hover:bg-slate-50"
              >
                {t('crm.automations.panel.integrations.connectWordpressCf7RegenerateSecret')}
              </button>
              <button
                type="button"
                onClick={onClearSecret}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('crm.automations.panel.integrations.connectWordpressCf7ClearSecret')}
              </button>
            </div>
          </div>
        </li>
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
            3
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900">
              {t('crm.automations.panel.integrations.connectWordpressCf7Step3Title')}
            </div>
            <p className="mt-0.5 text-slate-600">
              {t('crm.automations.panel.integrations.connectWordpressCf7Step3Body')}
            </p>
          </div>
        </li>
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
            4
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900">
              {t('crm.automations.panel.integrations.connectWordpressCf7Step4Title')}
            </div>
            <p className="mt-0.5 text-slate-600">
              {t('crm.automations.panel.integrations.connectWordpressCf7Step4Body')}
            </p>
            <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50/90 px-2.5 py-2 text-[10px] text-slate-600 leading-snug">
              {t('crm.automations.panel.integrations.connectWordpressCf7FieldMappingNote')}
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
};
