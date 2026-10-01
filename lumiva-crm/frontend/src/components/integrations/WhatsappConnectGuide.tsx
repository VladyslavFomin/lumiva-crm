import React from 'react';
import type { TFunction } from 'i18next';

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const FIELDS = ['token', 'phoneNumberId', 'wabaId', 'verifyToken', 'appSecret', 'label'] as const;

/**
 * Пошаговая инструкция для клиента прямо в форме подключения WhatsApp: где в Meta взять каждое
 * значение формы и что сделать после сохранения (вебхук, публикация). Названия пунктов меню Meta —
 * как в русском интерфейсе на сентябрь 2026.
 */
export const WhatsappConnectGuide: React.FC<{ t: TFunction }> = ({ t }) => {
  const k = (key: string) => t(`crm.automations.panel.integrations.waGuide.${key}`);
  return (
    <details className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-[11px] text-slate-800">
      <summary className="cursor-pointer select-none font-semibold text-emerald-950">{k('title')}</summary>
      <div className="mt-2 space-y-3 border-t border-emerald-100 pt-2">
        <p className="leading-relaxed text-slate-700">{k('intro')}</p>

        <div>
          <div className="mb-1 font-semibold text-slate-900">{k('fieldsTitle')}</div>
          <ul className="space-y-1">
            {FIELDS.map((f) => (
              <li key={f} className="leading-snug text-slate-700">
                • {k(`fields.${f}`)}
              </li>
            ))}
            <li className="leading-snug text-slate-500">• {k('fields.notNeeded')}</li>
          </ul>
        </div>

        <ol className="list-none space-y-2.5">
          {STEPS.map((n) => (
            <li key={n} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                {n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{k(`step${n}Title`)}</div>
                <p className="mt-0.5 whitespace-pre-line leading-relaxed text-slate-600">{k(`step${n}Body`)}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="rounded-lg bg-white/80 px-2 py-1.5 leading-snug text-slate-600">{k('pricing')}</p>
      </div>
    </details>
  );
};
