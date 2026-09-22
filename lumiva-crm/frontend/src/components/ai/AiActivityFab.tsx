import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { fetchAiActivity, type AiActivityItem } from '../../api/aiEmployees';
import { AiAvatar, deriveAvatarAccent, deriveAvatarStyle, type AiAvatarAccent, type AiAvatarStyle } from '../../pages/ai-employees/AiAvatar';
import './ai-activity-fab.css';

const SEEN_KEY = 'lumiva_ai_activity_seen';
const POLL_MS = 30_000;

function readSeen(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}
function writeSeen(ts: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(ts));
  } catch {
    /* localStorage недоступен — счётчик просто не запомнится */
  }
}

function targetPath(item: AiActivityItem): string {
  if (item.targetId && item.targetType === 'lead') return `/leads/${item.targetId}`;
  if (item.targetId && item.targetType === 'project') return `/projects/${item.targetId}`;
  return item.agent ? `/ai-employees/${item.agent.id}` : '/ai-employees';
}

/**
 * Яркая иконка внизу CRM: последние действия ИИ-сотрудников (что сделали по триггерам, кому назначили,
 * что ждёт согласования). Опрос раз в 30 с; «новое» считается от времени последнего открытия панели.
 */
export function AiActivityFab() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AiActivityItem[]>([]);
  const [pending, setPending] = useState(0);
  const [seen, setSeen] = useState<number | null>(() => readSeen());
  // Разные ИИ раньше валились в одну ленту вперемешку — непонятно, от кого что. Показываем
  // сперва "папки" по сотрудникам, конкретную ленту — только после выбора одного из них.
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      // Лимит увеличен с 30 до максимума бэкенда (60) — при группировке по сотрудникам (см. groups
      // ниже) 30 общих записей на несколько ИИ давали слишком короткую ленту на каждого.
      const res = await fetchAiActivity({ limit: 60 });
      setAvailable(res.agentsCount > 0);
      setItems(res.items);
      setPending(res.pendingApprovals);
      // Первый визит: всё, что было до сих пор, считаем просмотренным — иначе счётчик стартует с «30».
      if (readSeen() === null) {
        const now = new Date(res.serverTime).getTime();
        writeSeen(now);
        setSeen(now);
      }
    } catch {
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node) && !(e.target as HTMLElement).closest('.ai-fab')) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const groups = useMemo(() => {
    const byAgent = new Map<string, { agent: AiActivityItem['agent']; items: AiActivityItem[] }>();
    for (const it of items) {
      const key = it.agent?.id || '__none__';
      const g = byAgent.get(key);
      if (g) g.items.push(it);
      else byAgent.set(key, { agent: it.agent, items: [it] });
    }
    return [...byAgent.entries()]
      .map(([id, g]) => ({ id, agent: g.agent, items: g.items }))
      .sort((a, b) => new Date(b.items[0].createdAt).getTime() - new Date(a.items[0].createdAt).getTime());
  }, [items]);
  const showFolders = groups.length > 1 && selectedAgentId === null;
  const activeGroup = selectedAgentId ? groups.find((g) => g.id === selectedAgentId) ?? null : null;
  const visibleItems = showFolders ? [] : activeGroup ? activeGroup.items : items;

  if (!available) return null;

  const fresh = items.filter((i) => seen !== null && new Date(i.createdAt).getTime() > seen).length;
  const badge = fresh + pending;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const now = Date.now();
      // Подсветку «новых» строк оставляем на время открытия, а отметку «просмотрено» ставим сейчас
      writeSeen(now);
      window.setTimeout(() => setSeen(now), 4000);
    }
  };

  const ago = (iso: string) => {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const min = Math.floor(diff / 60000);
    if (min < 1) return t('crm.aiEmployees.activity.ago.now');
    if (min < 60) return t('crm.aiEmployees.activity.ago.min', { count: min });
    const h = Math.floor(min / 60);
    if (h < 24) return t('crm.aiEmployees.activity.ago.hour', { count: h });
    return new Date(iso).toLocaleDateString(i18n.language);
  };

  return (
    <>
      <button
        type="button"
        className={`ai-fab${badge > 0 ? ' live' : ''}`}
        onClick={toggle}
        title={t('crm.aiEmployees.activity.title')}
        aria-label={t('crm.aiEmployees.activity.title')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" />
          <path d="M19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15z" opacity=".85" />
        </svg>
        {badge > 0 ? <span className="ai-fab-badge">{badge > 99 ? '99+' : badge}</span> : null}
      </button>

      {open ? (
        <div className="ai-fab-panel" ref={panelRef} role="dialog" aria-label={t('crm.aiEmployees.activity.title')}>
          <div className="ai-fab-head">
            {activeGroup ? (
              <button type="button" className="ai-fab-back" onClick={() => setSelectedAgentId(null)}>
                ‹
              </button>
            ) : null}
            {activeGroup ? (
              (() => {
                const agent = activeGroup.agent;
                const st = (agent?.settings || {}) as Record<string, unknown>;
                const accent = ((st.avatarAccent as AiAvatarAccent) || deriveAvatarAccent(agent?.id || activeGroup.id)) as AiAvatarAccent;
                const avStyle = ((st.avatarStyle as AiAvatarStyle) || deriveAvatarStyle(agent?.id || activeGroup.id)) as AiAvatarStyle;
                return <AiAvatar name={agent?.name || t('crm.aiEmployees.activity.unknownAgent')} accent={accent} avStyle={avStyle} size="sm" />;
              })()
            ) : null}
            <div>
              <h4>{activeGroup ? activeGroup.agent?.name || t('crm.aiEmployees.activity.unknownAgent') : t('crm.aiEmployees.activity.title')}</h4>
              <div className="sub">
                {showFolders
                  ? t('crm.aiEmployees.activity.chooseAgent')
                  : activeGroup
                    ? t('crm.aiEmployees.activity.eventsCount', { count: activeGroup.items.length })
                    : t('crm.aiEmployees.activity.subtitle')}
              </div>
            </div>
          </div>
          <div className="ai-fab-list">
            {items.length === 0 ? (
              <div className="ai-fab-empty">{t('crm.aiEmployees.activity.empty')}</div>
            ) : showFolders ? (
              groups.map((g) => {
                const agent = g.agent;
                const st = (agent?.settings || {}) as Record<string, unknown>;
                const accent = ((st.avatarAccent as AiAvatarAccent) || deriveAvatarAccent(agent?.id || g.id)) as AiAvatarAccent;
                const avStyle = ((st.avatarStyle as AiAvatarStyle) || deriveAvatarStyle(agent?.id || g.id)) as AiAvatarStyle;
                const groupFresh = g.items.filter((i) => seen !== null && new Date(i.createdAt).getTime() > seen).length;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="ai-fab-item ai-fab-folder"
                    onClick={() => setSelectedAgentId(g.id)}
                  >
                    <AiAvatar name={agent?.name || t('crm.aiEmployees.activity.unknownAgent')} accent={accent} avStyle={avStyle} size="sm" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="who">
                        {agent?.name || t('crm.aiEmployees.activity.unknownAgent')}
                        {groupFresh > 0 ? <span className="ai-fab-chip warn">{groupFresh}</span> : null}
                      </div>
                      <div className="what">{t('crm.aiEmployees.activity.eventsCount', { count: g.items.length })}</div>
                      <div className="when">{ago(g.items[0].createdAt)}</div>
                    </div>
                    <span className="ai-fab-folder-arrow">›</span>
                  </button>
                );
              })
            ) : (
              visibleItems.map((it) => {
                const agent = it.agent;
                const st = (agent?.settings || {}) as Record<string, unknown>;
                const accent = ((st.avatarAccent as AiAvatarAccent) || deriveAvatarAccent(agent?.id || it.id)) as AiAvatarAccent;
                const avStyle = ((st.avatarStyle as AiAvatarStyle) || deriveAvatarStyle(agent?.id || it.id)) as AiAvatarStyle;
                const isNew = seen !== null && new Date(it.createdAt).getTime() > seen;
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`ai-fab-item${isNew ? ' fresh' : ''}`}
                    onClick={() => {
                      setOpen(false);
                      navigate(targetPath(it));
                    }}
                  >
                    <AiAvatar name={agent?.name || 'AI'} accent={accent} avStyle={avStyle} size="sm" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="who">
                        {agent?.name || 'AI'}
                        <span className={`ai-fab-chip${it.status === 'warning' ? ' warn' : it.status === 'error' ? ' err' : ''}`}>
                          {t(`crm.aiEmployees.activity.types.${it.type}`, { defaultValue: it.type })}
                        </span>
                      </div>
                      <div className="what">{it.title || it.detail || ''}</div>
                      <div className="when">{ago(it.createdAt)}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="ai-fab-foot">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/ai-employees/logs');
              }}
            >
              {t('crm.aiEmployees.activity.allActions')}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setOpen(false);
                navigate('/ai-employees/approvals');
              }}
            >
              {t('crm.aiEmployees.activity.approvals', { count: pending })}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
