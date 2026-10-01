/**
 * «Запись в Бронирования» для ИИ-консультантов (сайт и мессенджеры): галочка, какие услуги ИИ может
 * записывать, можно ли клиенту отменять/переносить, и готовность модуля (локации, услуги, пояс).
 * Сама запись — бэкенд BookingsAiService: слоты по графику и броням, бронь через ReservationsService.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fetchAiBookingSettings, updateAiBookingSettings, type AiBookingConfig, type AiBookingSettings } from '../../api/aiEmployees';

export function AiBookingPanel({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.aiEmployees.aiBooking.${key}`, o) as string;
  const [data, setData] = useState<AiBookingSettings | null>(null);
  const [cfg, setCfg] = useState<AiBookingConfig | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (d: AiBookingSettings) => {
    setData(d);
    setCfg(d.config);
    setSaved(JSON.stringify(d.config));
  };

  useEffect(() => {
    fetchAiBookingSettings(agentId)
      .then(apply)
      .catch((e) => setMsg({ ok: false, text: e?.message || k('loadError') }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  if (!data || !cfg) return <div className="e2-panel" style={{ padding: 18 }}>{msg?.text || '…'}</div>;

  const st = data.status;
  const dirty = JSON.stringify(cfg) !== saved;
  const onlySelected = cfg.serviceIds.length > 0;
  const toggleService = (id: string) =>
    setCfg({ ...cfg, serviceIds: cfg.serviceIds.includes(id) ? cfg.serviceIds.filter((x) => x !== id) : [...cfg.serviceIds, id] });

  const save = async () => {
    if (onlySelected && !cfg.serviceIds.some((id) => st.services.some((s) => s.id === id))) {
      setMsg({ ok: false, text: k('pickService') });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      apply(await updateAiBookingSettings(agentId, cfg));
      setMsg({ ok: true, text: k('saved') });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error)?.message || k('saveError') });
    } finally {
      setBusy(false);
    }
  };

  const reasonLink: Record<string, string> = { no_locations: '/bookings/locations', no_services: '/bookings/services' };
  const mode = !cfg.enabled ? 'off' : st.ready ? 'auto' : 'draft';
  const money = (n: number, c: string) => (n > 0 ? `${n.toLocaleString()} ${c}` : k('priceOnRequest'));

  return (
    <div className="e2-panel">
      <div className="e2-panel-hd">
        <div className="h">{k('title')}</div>
      </div>
      <div className="ai-analyst-form">
        <p className="e2-hint" style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-3)' }}>{k('hint')}</p>
        <label className="ai-analyst-row">
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
          {k('enable')}
        </label>

        <div className={`ai-chatop-mode ${mode}`}>
          {!cfg.enabled ? (
            <>
              <b>{k('state.off.t')}</b>
              <span>{k('state.off.d')}</span>
            </>
          ) : st.ready ? (
            <>
              <b>{k('state.on.t')}</b>
              <span>
                {k(st.confirmationMode === 'auto' ? 'state.on.auto' : 'state.on.manual', { tz: st.timezone || '—' })}{' '}
                <Link to="/bookings/settings">{k('settingsLink')}</Link>
              </span>
            </>
          ) : (
            <>
              <b>{k('state.notReady.t')}</b>
              <span>
                {k(`reason.${st.reason || 'unavailable'}`)}{' '}
                {st.reason && reasonLink[st.reason] ? <Link to={reasonLink[st.reason]}>{k(`reasonLink.${st.reason}`)}</Link> : null}
              </span>
            </>
          )}
        </div>

        {st.services.length ? (
          <div>
            <div className="lbl">{k('servicesTitle')}</div>
            <label className="ai-analyst-row">
              <input type="radio" checked={!onlySelected} onChange={() => setCfg({ ...cfg, serviceIds: [] })} />
              {k('servicesAll', { count: st.services.length })}
            </label>
            <label className="ai-analyst-row">
              <input
                type="radio"
                checked={onlySelected}
                onChange={() => !onlySelected && setCfg({ ...cfg, serviceIds: st.services.slice(0, 1).map((s) => s.id) })}
              />
              {k('servicesSelected')}
            </label>
            {onlySelected ? (
              <div style={{ display: 'grid', gap: 4, margin: '4px 0 0 22px' }}>
                {st.services.map((s) => (
                  <label key={s.id} className="ai-analyst-row" style={{ alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={cfg.serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} />
                    <span>
                      {s.name}
                      <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>
                        {' '}
                        · {k('minutes', { n: s.minutes })} · {money(s.price, s.currency)} ·{' '}
                        {s.staffCount ? k('masters', { count: s.staffCount }) : k('noMasters')}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <label className="ai-analyst-row">
          <input type="checkbox" checked={cfg.allowChanges} onChange={(e) => setCfg({ ...cfg, allowChanges: e.target.checked })} />
          {k('allowChanges')}
        </label>

        <p className="e2-hint" style={{ margin: 0, fontSize: 12, color: 'var(--fg-3)' }}>{k('howItWorks')}</p>
        {msg ? <div className={msg.ok ? 'ai-analyst-ok' : 'ai-analyst-err'}>{msg.text}</div> : null}
        <div className="ai-analyst-actions">
          <button className="e2b sm" disabled={!dirty || busy} onClick={() => void save()}>
            {busy ? k('saving') : k('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Под ответом «Проверить ответ»: какие шаги записи ИИ сделал (в тесте бронь не создаётся). */
export function AiBookingTrace({ trace }: { trace?: string[] }) {
  const { t } = useTranslation();
  if (!trace?.length) return null;
  const label = (line: string) => {
    const name = /"name"\s*:\s*"(\w+)"/.exec(line)?.[1] || '';
    const ok = /=>\s*\{"ok":true/.test(line);
    const key = ['find_slots', 'book', 'my_bookings', 'cancel', 'reschedule'].includes(name) ? name : 'other';
    return `${ok ? '✓' : '✕'} ${t(`crm.aiEmployees.aiBooking.trace.${key}`)}`;
  };
  return (
    <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6, display: 'grid', gap: 2 }}>
      {trace.map((l, i) => (
        <span key={i}>{label(l)}</span>
      ))}
      <span>{t('crm.aiEmployees.aiBooking.trace.testNote')}</span>
    </div>
  );
}
