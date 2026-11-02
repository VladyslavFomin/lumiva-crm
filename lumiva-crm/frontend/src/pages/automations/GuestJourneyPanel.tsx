import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { fetchJourneyPresets, fetchJourneyReport, installJourneyPresets, type GuestJourneyReport } from '../../api/hotels';
import { getTriggerLabel } from './automationLabels';
import './automations-builder.css';

/**
 * Автоматизации → «Гости отеля»: готовые сценарии пути гостя (ставятся выключенными — проверить текст и включить),
 * отчёт по сценариям (запуски, ошибки) и по опросам гостей (ответы, средняя, недовольные, переходы на отзывы).
 */
export const GuestJourneyPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.automations.journeyPanel.${key}`, o);
  const lang = i18n.language?.startsWith('tr') ? 'tr' : i18n.language?.startsWith('en') ? 'en' : 'ru';
  const loc = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-US' : 'ru-RU';
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [presets, setPresets] = useState<Array<{ key: string; name: string; triggerEvent: string }>>([]);
  const [rep, setRep] = useState<GuestJourneyReport | null>(null);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    fetchJourneyPresets(lang).then(setPresets).catch(() => setPresets([]));
    fetchJourneyReport(days).then(setRep).catch(() => setRep(null));
  }, [lang, days]);
  useEffect(load, [load]);
  const installed = new Set((rep?.scenarios || []).map((s) => s.presetKey).filter(Boolean));
  const install = (keys?: string[]) => {
    setBusy(true);
    installJourneyPresets(lang, keys)
      .then((r) => { showAlert(r.created.length ? k('installed', { count: r.created.length }) : k('nothingNew'), { variant: 'success' }); load(); })
      .catch((e) => showAlert((e as Error).message, { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  const when = (s: GuestJourneyReport['scenarios'][number]) => (s.meta ? t(`crm.automations.form.journey.chip.${s.triggerEvent.replace('.', '_')}`, { count: s.meta.offsetDays, time: s.meta.sendTime }) : k('onEvent'));
  const fb = rep?.feedback;
  return (
    <div className="gj">
      <div className="gj-head">
        <div>
          <h2>{k('title')}</h2>
          <p>{k('subtitle')}</p>
        </div>
        <label className="gj-period">
          <span>{t('crm.automations.panel.usage.period')}</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 30, 90].map((d) => <option key={d} value={d}>{k('days', { count: d })}</option>)}
          </select>
        </label>
      </div>

      <div className="gj-sec">{k('presetsTitle')}</div>
      <div className="gj-presets">
        {presets.map((p) => {
          const has = installed.has(p.key);
          return (
            <div key={p.key} className={`gj-preset${has ? ' on' : ''}`}>
              <div className="gj-trig">{getTriggerLabel(p.triggerEvent, t)}</div>
              <b>{p.name}</b>
              <button type="button" className="gj-btn" disabled={busy || has} onClick={() => install([p.key])}>{has ? k('added') : k('add')}</button>
            </div>
          );
        })}
      </div>
      <div className="gj-row">
        <button type="button" className="gj-btn primary" disabled={busy} onClick={() => install()}>{k('addAll')}</button>
        <span className="gj-hint">{k('presetsHint')}</span>
      </div>

      <div className="gj-sec">{k('scenariosTitle')}</div>
      {!rep ? <div className="gj-hint">…</div> : !rep.scenarios.length ? <div className="gj-hint">{k('noScenarios')}</div> : (
        <div className="gj-table-wrap">
          <table className="gj-table">
            <thead><tr><th>{k('col.name')}</th><th>{k('col.when')}</th><th className="num">{k('col.runs')}</th><th className="num">{k('col.ok')}</th><th className="num">{k('col.errors')}</th><th>{k('col.last')}</th></tr></thead>
            <tbody>
              {rep.scenarios.map((s) => (
                <tr key={s.automationId} onClick={() => navigate(`/app/automations/${s.automationId}`)}>
                  <td><span className={`gj-dot${s.isActive ? ' on' : ''}`} /> <b>{s.name}</b>{!s.isActive && <span className="gj-off"> · {k('off')}</span>}</td>
                  <td>{when(s)}</td>
                  <td className="num">{s.runs}</td>
                  <td className="num">{s.success}</td>
                  <td className={`num${s.errors ? ' bad' : ''}`}>{s.errors}</td>
                  <td>{s.lastRunAt ? new Date(s.lastRunAt).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}{s.errors > 0 && s.lastError ? <div className="gj-err">{s.lastError}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="gj-sec">{k('feedbackTitle')}</div>
      {fb && (
        <>
          <div className="gj-kpis">
            <div><span>{k('fb.sent')}</span><b>{fb.sent}</b></div>
            <div><span>{k('fb.answered')}</span><b>{fb.answered}</b><em>{fb.sent ? `${Math.round((fb.answered / fb.sent) * 100)}%` : ''}</em></div>
            <div><span>{k('fb.avg')}</span><b>{fb.avg ?? '—'}</b><em>{fb.avg ? '★'.repeat(Math.round(fb.avg)) : ''}</em></div>
            <div><span>{k('fb.negative')}</span><b className={fb.negative ? 'bad' : ''}>{fb.negative}</b></div>
            <div><span>{k('fb.reviews')}</span><b>{fb.reviewClicks}</b></div>
          </div>
          {fb.answered > 0 && (
            <div className="gj-bars">
              {fb.byScore.map((n, i) => (
                <div key={i}><span>{i + 1}★</span><i style={{ width: `${fb.answered ? (n / fb.answered) * 100 : 0}%` }} /><em>{n}</em></div>
              )).reverse()}
            </div>
          )}
          {fb.recentNegative.length > 0 && (
            <div className="gj-neg">
              <div className="gj-hint">{k('recentNegative')}</div>
              {fb.recentNegative.map((x) => (
                <button key={x.reservationId + x.answeredAt} type="button" onClick={() => navigate(`/hotels/reservations?reservation=${x.reservationId}`)}>
                  <b>{x.guestName}</b> <span>{'★'.repeat(x.score)}{'☆'.repeat(5 - x.score)}</span>
                  {x.comment && <q>{x.comment}</q>}
                </button>
              ))}
            </div>
          )}
          {!fb.sent && <div className="gj-hint">{k('noFeedback', { token: '{{survey_link}}' })}</div>}
        </>
      )}
    </div>
  );
};
