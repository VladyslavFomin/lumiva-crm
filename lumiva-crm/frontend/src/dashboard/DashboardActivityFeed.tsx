import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DashboardHomeDto } from '../api/dashboard';

export type ActivityFeedTask = {
  id: string;
  projectId: string;
  projectName: string;
  taskTitle: string;
  due: string;
};

export type ActivityFeedLead = {
  id: string;
  name: string;
  channel: string;
  createdAt: string;
};

type Props = {
  locale: string;
  todayLeads: number;
  tasksOverdue: number;
  tasksToday: number;
  recentLeads: ActivityFeedLead[];
  urgentTasks: ActivityFeedTask[];
  crmActivity?: DashboardHomeDto['leadActivityStream'];
};

export const DashboardActivityFeed: React.FC<Props> = ({
  locale,
  todayLeads,
  tasksOverdue,
  tasksToday,
  recentLeads,
  urgentTasks,
  crmActivity,
}) => {
  const { t } = useTranslation();
  const sliceCrm = (crmActivity || []).slice(0, 10);
  const sliceLeads = recentLeads.slice(0, 5);
  const sliceTasks = urgentTasks.slice(0, 4);

  const hasTimeline = sliceCrm.length > 0;
  const hasLeads = sliceLeads.length > 0;
  const hasTasks = sliceTasks.length > 0;

  return (
    <div className="space-y-5">
      {/* Quick stats */}
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-700">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          <span>{t('crm.dashboard.activity.todayLeads') || 'Сегодня лидов'}</span>
          <span className="font-mono font-medium text-slate-900 text-[12px]">{todayLeads}</span>
          <Link to="/leads" className="text-[10px] font-medium text-slate-500 hover:text-slate-900 transition-colors ml-0.5 underline underline-offset-2">
            →
          </Link>
        </div>
        {tasksOverdue > 0 && (
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-800">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span>{t('crm.dashboard.activity.overdue') || 'Просрочено'}</span>
            <span className="font-mono font-medium text-[12px]">{tasksOverdue}</span>
          </div>
        )}
        {tasksToday > 0 && (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{t('crm.dashboard.activity.dueToday') || 'На сегодня'}</span>
            <span className="font-mono font-medium text-[12px]">{tasksToday}</span>
          </div>
        )}
      </div>

      {/* CRM Activity Timeline — act-list design */}
      {hasTimeline && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
            {t('crm.dashboard.activity.crmTimeline') || 'Лента событий'}
          </div>
          <div className="relative pl-[14px] max-h-64 overflow-y-auto pr-0.5 [scrollbar-gutter:stable]">
            {/* Vertical timeline line */}
            <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-slate-200" aria-hidden />
            {sliceCrm.map((e, idx) => {
              const typeVerb = (() => {
                switch (e.type) {
                  case 'created': return t('crm.dashboard.activity.types.created') || 'добавлен';
                  case 'status_changed': return t('crm.dashboard.activity.types.status_changed') || 'сменил статус';
                  case 'assignee_changed': return t('crm.dashboard.activity.types.assignee_changed') || 'переназначен';
                  case 'comment': return t('crm.dashboard.activity.types.comment') || 'оставил комментарий в';
                  case 'meeting': return t('crm.dashboard.activity.types.meeting') || 'встреча по';
                  default: return e.type;
                }
              })();
              const at = new Date(e.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
              const isDim = idx > 4;
              return (
                <Link
                  key={e.id}
                  to={`/leads/${e.leadId}`}
                  className="relative block pl-[14px] pb-3.5 last:pb-0 hover:bg-slate-50/60 rounded transition-colors"
                >
                  {/* Timeline dot */}
                  <span
                    className={`absolute left-[-9px] top-[13px] w-[7px] h-[7px] rounded-full bg-white border-[1.5px] transition-colors ${isDim ? 'border-slate-200' : 'border-slate-800'}`}
                    aria-hidden
                  />
                  <div className="text-[12.5px] text-slate-600 leading-snug">
                    <span className="font-medium text-slate-900">{e.leadName || t('crm.dashboard.activity.unnamedLead')}</span>
                    {' '}
                    <span className="text-slate-500">{typeVerb}</span>
                    {e.summary && (
                      <>
                        {' '}
                        <span className="text-slate-900 underline underline-offset-[2px] decoration-slate-200 decoration-1">{e.summary}</span>
                      </>
                    )}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-[10px] text-slate-400 uppercase tracking-[0.06em] mt-0.5">
                    {at}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Two-column: recent leads + urgent tasks */}
      {(hasLeads || hasTasks) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Recent leads */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
              {t('crm.dashboard.activity.recentLeads') || 'Новые лиды'}
            </div>
            {!hasLeads ? (
              <p className="text-[11px] text-slate-500 italic">{t('crm.dashboard.activity.noRecentLeads')}</p>
            ) : (
              <div className="flex flex-col gap-1">
                {sliceLeads.map((l) => (
                  <Link
                    key={l.id}
                    to={`/leads/${l.id}`}
                    className="flex flex-col gap-0.5 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 text-[11px] hover:border-slate-200 hover:bg-slate-50/70 transition-colors"
                  >
                    <span className="font-medium text-slate-900 truncate">{l.name}</span>
                    <span className="text-slate-500 truncate font-mono text-[10px]">
                      {l.channel} · {new Date(l.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Urgent tasks */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
              {t('crm.dashboard.activity.focusTasks') || 'Срочные задачи'}
            </div>
            {!hasTasks ? (
              <p className="text-[11px] text-slate-500 italic">{t('crm.dashboard.activity.noUrgentTasks')}</p>
            ) : (
              <div className="flex flex-col gap-1">
                {sliceTasks.map((task) => (
                  <Link
                    key={task.id}
                    to={`/projects/${task.projectId}`}
                    className="flex flex-col gap-0.5 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 text-[11px] hover:border-violet-200 hover:bg-violet-50/30 transition-colors"
                  >
                    <span className="font-medium text-slate-900 truncate">{task.taskTitle}</span>
                    <span className="text-slate-500 truncate font-mono text-[10px]">
                      {task.projectName} · {task.due}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!hasTimeline && !hasLeads && !hasTasks && todayLeads === 0 && (
        <div className="text-center py-4">
          <p className="text-[11px] text-slate-400 italic">{t('crm.dashboard.activity.empty') || 'Активности пока нет'}</p>
        </div>
      )}
    </div>
  );
};
