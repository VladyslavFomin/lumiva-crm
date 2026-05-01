import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProfileCompletionStepId } from '../api/dashboard';

type Props = {
  percent: number;
  steps: { id: ProfileCompletionStepId; done: boolean }[];
  /** When true renders the compact sidebar onboard-step list style */
  inSidebar?: boolean;
};

const STEP_ORDER: ProfileCompletionStepId[] = [
  'display_name',
  'phone',
  'avatar',
  'first_lead',
  'team_invited',
];

export const DashboardProfileCompletion: React.FC<Props> = ({ percent, steps, inSidebar }) => {
  const { t } = useTranslation();
  const map = new Map(steps.map((s) => [s.id, s.done]));
  const presentSteps = STEP_ORDER.filter((id) => steps.some((s) => s.id === id));

  if (inSidebar) {
    return (
      <>
        <div className="flex flex-col gap-px">
          {presentSteps.map((id) => {
            const done = map.get(id) ?? false;
            return (
              <div
                key={id}
                className={`flex items-center gap-2.5 px-1 py-[7px] rounded-md cursor-pointer transition-colors hover:bg-slate-50 text-[12.5px] ${done ? 'text-slate-500' : 'text-slate-900'}`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold leading-none transition-all ${
                    done
                      ? 'border-[#222222] bg-[#222222] text-white'
                      : 'border-slate-300 bg-white text-transparent'
                  }`}
                  aria-hidden
                >
                  {done ? '✓' : ''}
                </span>
                <span className={`flex-1 leading-snug ${done ? 'line-through decoration-slate-300 decoration-[1px]' : ''}`}>
                  {t(`crm.dashboard.profileCompletion.steps.${id}.label`)}
                </span>
                <svg className={`w-2.5 h-2.5 text-slate-300 transition-opacity ${done ? 'opacity-0' : 'opacity-100'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
          <Link
            to="/profile/overview"
            className="inline-flex items-center justify-center rounded-[7px] bg-[#222222] px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-95 transition-opacity"
          >
            {t('crm.dashboard.profileCompletion.openProfile')}
          </Link>
          <Link
            to="/leads/new"
            className="inline-flex items-center justify-center rounded-[7px] border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 hover:border-slate-300 transition-colors"
          >
            {t('crm.dashboard.profileCompletion.createLead')}
          </Link>
        </div>
      </>
    );
  }

  // Full widget style (legacy, kept for compatibility if widget is ever re-added to grid)
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t('crm.dashboard.profileCompletion.kicker')}
          </div>
          <div
            className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums"
            style={{ fontFamily: "'Inter Tight', sans-serif" }}
          >
            {percent}%
          </div>
        </div>
        <div className="h-2 w-32 max-w-[40%] rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-500 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      </div>
      <ul className="space-y-2">
        {presentSteps.map((id) => {
          const done = map.get(id) ?? false;
          return (
            <li
              key={id}
              className={`flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-[12px] ${
                done ? 'border-emerald-200/80 bg-emerald-50/50 text-slate-700' : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done ? 'bg-emerald-500 text-white' : 'border border-slate-300 text-slate-400'
                }`}
                aria-hidden
              >
                {done ? '✓' : ''}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-snug">
                  {t(`crm.dashboard.profileCompletion.steps.${id}.label`)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {t(`crm.dashboard.profileCompletion.steps.${id}.hint`)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          to="/profile/overview"
          className="inline-flex items-center justify-center rounded-xl bg-[#222222] px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:opacity-95 transition-opacity"
        >
          {t('crm.dashboard.profileCompletion.openProfile')}
        </Link>
        <Link
          to="/leads/new"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-800 hover:border-slate-300 transition-colors"
        >
          {t('crm.dashboard.profileCompletion.createLead')}
        </Link>
      </div>
    </div>
  );
};
