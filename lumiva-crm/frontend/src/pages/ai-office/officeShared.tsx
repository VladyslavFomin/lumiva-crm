import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  siCanva,
  siGithub,
  siGmail,
  siGoogleads,
  siGooglecalendar,
  siGooglesheets,
  siHubspot,
  siJira,
  siMailchimp,
  siMeta,
  siNotion,
  siSlack,
  siTelegram,
  siWhatsapp,
} from 'simple-icons';
import { aiOfficeApi, type OfficeConnector, type OfficeEvent, type OfficeIssue, type OfficeLive, type OfficeOverview, type OfficeTask } from '../../api/aiOffice';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import './ai-office.css';

/** Знаки сервисов (Simple Icons — те же, что в дизайне). */
const ICONS: Record<string, { path: string }> = {
  email: siGmail,
  telegram: siTelegram,
  whatsapp: siWhatsapp,
  meta_ads: siMeta,
  google_ads: siGoogleads,
  canva: siCanva,
  notion: siNotion,
  jira: siJira,
  slack: siSlack,
  github: siGithub,
  hubspot: siHubspot,
  mailchimp: siMailchimp,
  google_sheets: siGooglesheets,
  google_calendar: siGooglecalendar,
};

type LogoSrc = Pick<OfficeConnector, 'key' | 'color' | 'letter' | 'name'>;

/** Плитка цвета бренда с белым знаком сервиса; без знака — буква. */
export function OfficeLogo({ c, size = 28, off }: { c: LogoSrc; size?: number; off?: boolean }) {
  const icon = ICONS[c.key];
  const ic = Math.round(size * 0.56);
  return (
    <span className={'of-applogo' + (off ? ' off' : '')} style={{ width: size, height: size, background: c.color, fontSize: Math.round(size * 0.42) }} title={c.name}>
      {icon ? (
        <svg viewBox="0 0 24 24" width={ic} height={ic} aria-hidden="true">
          <path d={icon.path} />
        </svg>
      ) : (
        c.letter
      )}
    </span>
  );
}

export function OfficeShell({ title, sub, right, children, plan }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; plan?: string }) {
  const { t } = useTranslation();
  return (
    <MainLayout>
      <div className="ofp">
        <div className="ofp-main">
          <div className="ofp-head">
            <div>
              <div className="kicker">
                <span className="dot" />
                {t('aiOffice.common.kicker')}
                {plan ? ` · ${t(`aiOffice.plans.${plan}`, plan)}` : ''}
              </div>
              <h1>{title}</h1>
              {sub && <p>{sub}</p>}
            </div>
            {right && <div className="ofp-head-r">{right}</div>}
          </div>
          {children}
        </div>
      </div>
    </MainLayout>
  );
}

export const ISSUE_COLOR: Record<string, string> = { error: '#cc2f47', data: '#c08319', access: '#7b5cc4', trust: '#2c8a5a' };

export function fixHref(i: OfficeIssue): string {
  if (i.fix === 'upload') return `/ai-office/brain?folder=${encodeURIComponent(i.target && i.target !== 'common' ? i.departmentId : 'common')}&req=${i.id}`;
  if (i.fix === 'access') return `/ai-office/brain?tab=access&req=${i.id}${i.target ? `&connector=${encodeURIComponent(i.target)}` : ''}&dept=${i.departmentId}`;
  if (i.fix === 'reconnect') return '/ai-office/connect';
  if (i.fix === 'connect') return '/integrations-hub?tab=marketing';
  if (i.fix === 'billing') return '/billing';
  return `/ai-office/departments/${i.departmentId}/edit#engine`;
}

/** Кнопка решения проблемы: «Предоставить доступ» срабатывает сразу, остальное ведёт на нужную страницу. */
export function IssueFix({ issue, className, onDone }: { issue: Pick<OfficeIssue, 'id' | 'fix' | 'target' | 'departmentId' | 'kind'>; className?: string; onDone?: () => void }) {
  const { t } = useTranslation();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  if (issue.fix === 'autonomy') {
    return (
      <button
        className={className}
        disabled={busy}
        onClick={async (e) => {
          e.stopPropagation();
          setBusy(true);
          try {
            await aiOfficeApi.grantAutonomy(issue.departmentId);
            notify.success(t('aiOffice.fix.autonomyDone'));
            onDone?.();
          } catch (err) {
            notify.error(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t('aiOffice.fix.autonomy')}
      </button>
    );
  }
  if (issue.fix === 'grant') {
    return (
      <button
        className={className}
        disabled={busy}
        onClick={async (e) => {
          e.stopPropagation();
          setBusy(true);
          try {
            const r = await aiOfficeApi.grantData(issue.departmentId, issue.target || 'ads');
            if (r.status === 'ok') notify.success(t('aiOffice.fix.granted'));
            else notify.error(t('aiOffice.fix.grantFailed'));
            onDone?.();
          } catch (err) {
            notify.error(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t('aiOffice.fix.grant')}
      </button>
    );
  }
  return (
    <Link className={className} to={fixHref(issue as OfficeIssue)} onClick={(e) => e.stopPropagation()}>
      {t(`aiOffice.fix.${issue.fix}`)}
    </Link>
  );
}

export function useAgo() {
  const { t } = useTranslation();
  return useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return '';
      const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
      if (s < 45) return t('aiOffice.common.now');
      const m = Math.round(s / 60);
      if (m < 60) return t('aiOffice.common.minAgo', { n: m });
      const h = Math.round(m / 60);
      if (h < 24) return t('aiOffice.common.hAgo', { n: h });
      return t('aiOffice.common.dAgo', { n: Math.round(h / 24) });
    },
    [t],
  );
}

export const fmtEur = (cents: number) => `${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function apiErrorText(e: unknown): string {
  const any = e as any;
  return any?.payload?.message || any?.message || String(e);
}

/**
 * Данные офиса + живое обновление: полный снимок раз при открытии, дальше лёгкий опрос /live
 * каждые 4 с (изменившиеся задачи, новые события журнала, счётчики отделов, проблемы).
 */
export function useOfficeLive(onEvents?: (events: OfficeEvent[]) => void) {
  const [data, setData] = useState<OfficeOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const since = useRef<string | null>(null);
  const evRef = useRef(onEvents);
  evRef.current = onEvents;

  const reload = useCallback(async () => {
    try {
      const o = await aiOfficeApi.overview();
      since.current = o.serverTime;
      setData(o);
      setError(null);
    } catch (e) {
      setError(apiErrorText(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (!alive || document.hidden || !since.current) return;
      try {
        const l: OfficeLive = await aiOfficeApi.live(since.current);
        if (!alive) return;
        since.current = l.serverTime;
        setData((prev) => {
          if (!prev) return prev;
          const byId = new Map(prev.tasks.map((x) => [x.id, x]));
          l.tasks.forEach((x) => byId.set(x.id, x));
          const tasks = [...byId.values()].sort(taskOrder).slice(0, 200);
          const known = new Set(prev.events.map((e) => e.id));
          const fresh = l.events.filter((e) => !known.has(e.id));
          return {
            ...prev,
            departments: prev.departments.map((d) => {
              const u = l.departments.find((x) => x.id === d.id);
              return u ? { ...d, status: u.status, pausedReason: u.pausedReason, live: u.live } : d;
            }),
            tasks,
            issues: l.issues,
            events: [...fresh, ...prev.events].slice(0, 80),
            brainFiles: l.brainFiles,
          };
        });
        if (l.events.length) evRef.current?.(l.events);
        // появился/исчез отдел — перечитываем целиком
        if (l.departments.length !== (dataRef.current?.departments.length ?? l.departments.length)) void reload();
      } catch {
        /* следующий тик */
      }
    };
    const id = window.setInterval(poll, 4000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [reload]);

  const dataRef = useRef(data);
  dataRef.current = data;
  return { data, setData, error, reload };
}

const ORDER: Record<string, number> = { progress: 0, waiting: 1, blocked: 2, backlog: 3, failed: 4, done: 5, rejected: 6, foreign: 6 };
export function taskOrder(a: OfficeTask, b: OfficeTask) {
  return (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || +new Date(b.updatedAt) - +new Date(a.updatedAt);
}

/** Ошибки — модальным окном, успехи — тостом (как во всей CRM). */
export function useNotify() {
  const { showAlert, showConfirm, showPrompt } = useAlertModal();
  return {
    error: (e: unknown) => showAlert(apiErrorText(e), { variant: 'error' }),
    success: (m: string) => showAlert(m, { variant: 'success' }),
    confirm: showConfirm,
    prompt: showPrompt,
  };
}

/** Что агент «говорит» в офисе: его реальное состояние — задача, шаг, последнее событие. */
export function agentPhrases(
  t: (k: string, o?: Record<string, unknown>) => string,
  tasks: OfficeTask[],
  events: OfficeEvent[],
  agentId: string,
  isLead: boolean,
): string[] {
  const short = (s: string) => (s.length > 34 ? s.slice(0, 33) + '…' : s);
  const out: string[] = [];
  const cur = tasks.find((x) => x.agentId === agentId && x.status === 'progress');
  const wait = tasks.find((x) => x.agentId === agentId && x.status === 'waiting');
  if (cur) out.push(short(cur.title), t(`aiOffice.step.${cur.step}`) + '…');
  if (wait) out.push(t('aiOffice.life.waitingYou'));
  events
    .filter((e) => e.agentId === agentId && Date.now() - new Date(e.createdAt).getTime() < 3 * 3_600_000)
    .slice(0, 3)
    .forEach((e) => out.push(short(e.text)));
  if (!out.length) out.push(isLead ? t('aiOffice.life.leadIdle') : t('aiOffice.life.idle'), t('aiOffice.life.ready'));
  return out;
}
