import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  DASHBOARD_TEMPLATE_ORDER,
  DASHBOARD_TEMPLATES,
  type DashboardLayoutTemplateId,
} from './dashboardLayoutTemplates';

type Props = {
  onClose: () => void;
  onPick: (id: DashboardLayoutTemplateId) => void;
  /** Доступен ли блок пользователю — превью показывает ряды такими, какими они встанут. */
  allowed: (blockId: string) => boolean;
  widgetTitle: (id: string) => string;
};

/** Выбор шаблона главной v3 (стиль .a3-shell): превью — полоса KPI и ровные ряды блоков. */
export const DashboardLayoutTemplateModal: React.FC<Props> = ({ onClose, onPick, allowed, widgetTitle }) => {
  const { t } = useTranslation();

  return createPortal(
    <div
      className="lv-backdrop fixed inset-0 z-[10090] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        className="lv-dialog w-full max-w-[860px] max-h-[90vh] overflow-y-auto rounded-[30px] border border-white/80 bg-[#f4f4f4] p-6 md:p-8 shadow-2xl text-[#1d1d1d]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-['Inter_Tight'] text-[24px] font-semibold tracking-[-0.02em]">{t('crm.dashboard.layoutTemplate.title')}</h2>
            <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-[#858585]">{t('crm.dashboard.layoutTemplate.hint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('crm.common.close')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/5 bg-white/80 text-[18px] transition hover:bg-white"
          >
            ×
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {DASHBOARD_TEMPLATE_ORDER.map((id) => {
            const tpl = DASHBOARD_TEMPLATES[id];
            const rows = tpl.rows.map((r) => r.ids.filter(allowed)).filter((r) => r.length);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPick(id)}
                className="group flex flex-col rounded-[24px] border border-white/90 bg-white/75 p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_22px_40px_-26px_rgba(30,30,30,.4)] active:scale-[0.99]"
              >
                <div className="text-[16px] font-semibold tracking-[-0.01em]">{t(`crm.dashboard.layoutTemplate.options.${id}.title`)}</div>
                <div className="mt-1 text-[12.5px] leading-snug text-[#858585]">{t(`crm.dashboard.layoutTemplate.options.${id}.desc`)}</div>
                <div className="mt-4 flex flex-col gap-1.5 rounded-[16px] bg-black/[0.035] p-2.5" aria-hidden>
                  <div className="grid grid-cols-4 gap-1.5">
                    {tpl.home.kpis.map((k, i) => (
                      <span key={k} className={`h-5 rounded-[6px] ${i === 0 ? 'bg-[#1d1d1d]' : 'bg-white'}`} />
                    ))}
                  </div>
                  <div className="grid grid-cols-[1fr_34%] gap-1.5">
                    <span className="h-9 rounded-[8px] bg-white" />
                    <span className="row-span-2 rounded-[8px] bg-white" />
                    <span className="h-7 rounded-[8px] bg-white" />
                  </div>
                  {rows.map((r, i) => (
                    <div key={i} className={`grid gap-1.5 ${r.length === 1 ? 'grid-cols-1' : r.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {r.map((b) => (
                        <span key={b} className="truncate rounded-[8px] border border-dashed border-black/15 px-2 py-1.5 text-[10.5px] text-[#555]">
                          {widgetTitle(b)}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11.5px] text-[#adadad]">
                  {tpl.home.kpis.map((k) => t(`crm.home.metrics.${k}`)).join(' · ')}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
};
