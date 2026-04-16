import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
};

export const DashboardActivityFeed: React.FC<Props> = ({
  locale,
  todayLeads,
  tasksOverdue,
  tasksToday,
  recentLeads,
  urgentTasks,
}) => {
  const { t } = useTranslation();
  const sliceLeads = recentLeads.slice(0, 6);
  const sliceTasks = urgentTasks.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-[11px] text-sky-950">
          <span className="font-semibold">{t('crm.dashboard.activity.todayLeads')}</span>
          <span className="ml-2 text-lg font-bold tabular-nums">{todayLeads}</span>
          <Link to="/leads" className="ml-2 text-sky-700 underline font-medium">
            {t('crm.dashboard.activity.openLeads')}
          </Link>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-[11px] text-rose-950">
          <span className="font-semibold">{t('crm.dashboard.activity.overdue')}</span>
          <span className="ml-2 text-lg font-bold tabular-nums">{tasksOverdue}</span>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-950">
          <span className="font-semibold">{t('crm.dashboard.activity.dueToday')}</span>
          <span className="ml-2 text-lg font-bold tabular-nums">{tasksToday}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            {t('crm.dashboard.activity.recentLeads')}
          </div>
          {sliceLeads.length === 0 ? (
            <p className="text-[11px] text-slate-500">{t('crm.dashboard.activity.noRecentLeads')}</p>
          ) : (
            <ul className="space-y-1.5">
              {sliceLeads.map((l) => (
                <li key={l.id}>
                  <Link
                    to={`/leads/${l.id}`}
                    className="flex flex-col rounded-xl border border-slate-100 bg-white px-2.5 py-1.5 text-[11px] hover:border-teal-200 hover:bg-teal-50/30"
                  >
                    <span className="font-medium text-slate-900 truncate">{l.name}</span>
                    <span className="text-slate-500 truncate">
                      {l.channel} · {new Date(l.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            {t('crm.dashboard.activity.focusTasks')}
          </div>
          {sliceTasks.length === 0 ? (
            <p className="text-[11px] text-slate-500">{t('crm.dashboard.activity.noUrgentTasks')}</p>
          ) : (
            <ul className="space-y-1.5">
              {sliceTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    to={`/projects/${task.projectId}`}
                    className="flex flex-col rounded-xl border border-slate-100 bg-white px-2.5 py-1.5 text-[11px] hover:border-violet-200 hover:bg-violet-50/30"
                  >
                    <span className="font-medium text-slate-900 truncate">{task.taskTitle}</span>
                    <span className="text-slate-500 truncate">
                      {task.projectName} · {task.due}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
