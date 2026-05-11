import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  applyDashboardLayoutTemplate,
  type DashboardLayoutTemplateId,
} from './dashboardLayoutTemplates';
import type { DashboardLayoutState } from './dashboardLayout';
import { DASHBOARD_LAYOUT_CHANGED_EVENT, saveDashboardLayout } from './dashboardLayout';

const ORDER: DashboardLayoutTemplateId[] = ['sales', 'marketing', 'operations'];

type Props = {
  onClose: () => void;
  /** Текущий layout — клонируем и сохраняем */
  getLayout: () => DashboardLayoutState;
  onApplied: (next: DashboardLayoutState) => void;
};

export const DashboardLayoutTemplateModal: React.FC<Props> = ({
  onClose,
  getLayout,
  onApplied,
}) => {
  const { t } = useTranslation();

  const apply = (id: DashboardLayoutTemplateId) => {
    const prev = getLayout();
    const next = applyDashboardLayoutTemplate(id, prev);
    saveDashboardLayout(next);
    onApplied(next);
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_LAYOUT_CHANGED_EVENT, { detail: { addedWidget: false } }),
    );
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10090] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        className="w-full max-w-md rounded-[18px] border border-neutral-200/90 bg-white p-5 shadow-2xl text-[#222]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-[#222]">
          {t('crm.dashboard.layoutTemplate.title')}
        </h2>
        <p className="mt-1.5 text-[12px] text-neutral-500 leading-relaxed">
          {t('crm.dashboard.layoutTemplate.hint')}
        </p>
        <ul className="mt-4 space-y-2">
          {ORDER.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => apply(id)}
                className="w-full text-left rounded-xl border border-neutral-200 bg-neutral-50/50 px-3.5 py-3 transition hover:border-neutral-300 hover:bg-white"
              >
                <div className="text-[12.5px] font-semibold text-[#222]">
                  {t(`crm.dashboard.layoutTemplate.options.${id}.title`)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  {t(`crm.dashboard.layoutTemplate.options.${id}.desc`)}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {t('crm.common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
