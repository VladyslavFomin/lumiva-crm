import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { aiOfficeApi, type OfficeConnector, type OfficeDepartment, type OfficePlanPage } from '../../api/aiOffice';
import { OfficeLogo, OfficeShell, fmtEur, useNotify } from './officeShared';

const cnx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

/** Где подключается сервис, которого офис сам не подключает (почта, Telegram, интеграции CRM). */
const CONNECT_PATH: Record<string, string> = {
  email: '/email/accounts/new',
  telegram: '/telegram',
  whatsapp: '/integrations-hub',
  meta_ads: '/integrations-hub?tab=marketing',
  google_ads: '/integrations-hub?tab=marketing',
  slack: '/integrations-hub',
  jira: '/integrations-hub',
  hubspot: '/integrations-hub',
  amocrm: '/integrations-hub',
  bitrix: '/integrations-hub',
  mailchimp: '/integrations-hub',
  google_sheets: '/integrations-hub',
  google_calendar: '/integrations-hub',
};
const OAUTH = new Set(['notion', 'github', 'canva']);

function ConnSettings({ c, inst, onSaved }: { c: OfficeConnector; inst: OfficeConnector['instances'][number]; onSaved: () => void }) {
  const { t } = useTranslation();
  const notify = useNotify();
  const [opts, setOpts] = useState<Array<{ id: string; label: string }> | null>(null);
  const cur = c.key === 'github' ? inst.settings?.repo : inst.settings?.parentPageId;
  const [val, setVal] = useState(cur ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    aiOfficeApi.connectionOptions(inst.connectionId).then(setOpts).catch(() => setOpts([]));
  }, [inst.connectionId]);
  const save = async () => {
    setBusy(true);
    try {
      await aiOfficeApi.connectionSettings(inst.connectionId, c.key === 'github' ? { repo: val } : { parentPageId: val });
      notify.success(t('aiOffice.common.saved'));
      onSaved();
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cn-how" style={{ width: '100%' }}>
      <label className="ofp-lbl">
        <span>{c.key === 'github' ? t('aiOffice.connect.repo') : t('aiOffice.connect.notionPage')}</span>
        {opts && opts.length > 0 ? (
          <select className="ofp-sel" value={val} onChange={(e) => setVal(e.target.value)}>
            <option value="">{t('aiOffice.common.pick')}</option>
            {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        ) : (
          <input className="ofp-in" value={val} onChange={(e) => setVal(e.target.value)} placeholder={c.key === 'github' ? 'owner/repo' : 'https://www.notion.so/…'} />
        )}
        <em>{c.key === 'github' ? t('aiOffice.connect.repoHint') : t('aiOffice.connect.notionPageHint')}</em>
      </label>
      <button className="ofp-btn pri" disabled={busy || !val || val === cur} onClick={save}>{t('aiOffice.common.save')}</button>
    </div>
  );
}

function TokenForm({ c, depts, onDone }: { c: OfficeConnector; depts: OfficeDepartment[]; onDone: () => void }) {
  const { t } = useTranslation();
  const notify = useNotify();
  const [token, setToken] = useState('');
  const [extra, setExtra] = useState('');
  const [scope, setScope] = useState<string[]>(depts.filter((d) => d.connectors.includes(c.key)).map((d) => d.id));
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await aiOfficeApi.grant({
        connector: c.key,
        token,
        label: c.name,
        departmentIds: scope,
        settings: c.key === 'github' ? { repo: extra } : { parentPageId: extra },
      });
      notify.success(t('aiOffice.connect.connected', { name: c.name }));
      onDone();
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cn-how" style={{ width: '100%' }}>
      <p>{c.key === 'github' ? t('aiOffice.connect.githubTokenHelp') : t('aiOffice.connect.notionTokenHelp')}</p>
      <label className="ofp-lbl">
        <span>{t('aiOffice.connect.token')}</span>
        <input className="ofp-in" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <label className="ofp-lbl">
        <span>{c.key === 'github' ? t('aiOffice.connect.repo') : t('aiOffice.connect.notionPage')}</span>
        <input className="ofp-in" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={c.key === 'github' ? 'owner/repo' : 'https://www.notion.so/…'} />
      </label>
      {depts.length > 0 && (
        <div className="ofp-lbl">
          <span>{t('aiOffice.brain.whichDepts')}</span>
          <div className="br-scopes">
            {depts.map((d) => {
              const on = scope.includes(d.id);
              return (
                <button key={d.id} className={on ? 'on' : ''} onClick={() => setScope(on ? scope.filter((x) => x !== d.id) : [...scope, d.id])}>
                  <i style={{ background: d.color }} />
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button className="ofp-btn pri" disabled={busy || token.length < 10 || !extra} onClick={submit}>{busy ? t('aiOffice.connect.checking') : t('aiOffice.connect.connect')}</button>
    </div>
  );
}

export function AiOfficeConnectPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotify();
  const [conns, setConns] = useState<OfficeConnector[] | null>(null);
  const [depts, setDepts] = useState<OfficeDepartment[]>([]);
  const [engines, setEngines] = useState<Awaited<ReturnType<typeof aiOfficeApi.engines>> | null>(null);
  const [plan, setPlan] = useState<OfficePlanPage | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    aiOfficeApi.connectors().then(setConns).catch((e) => notify.error(e));
    aiOfficeApi.departments().then(setDepts).catch(() => undefined);
    aiOfficeApi.engines().then(setEngines).catch(() => undefined);
    aiOfficeApi.plan().then(setPlan).catch(() => undefined);
  };
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const p = q.get('oauth');
    if (p) {
      if (q.get('result') === 'connected') notify.success(t('aiOffice.connect.connected', { name: p }));
      else notify.error(t('aiOffice.connect.oauthFailed', { name: p }));
      navigate('/ai-office/connect', { replace: true });
      if (p === 'github' || p === 'notion') setOpen(p);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startOAuth = async (key: string) => {
    setBusy(key);
    try {
      const { url } = await aiOfficeApi.oauthStart(key as 'notion' | 'github' | 'canva');
      window.location.href = url;
    } catch (e) {
      notify.error(e);
      setBusy(null);
    }
  };

  const deptName = (id: string) => depts.find((d) => d.id === id);
  const platformDepts = depts.filter((d) => d.engine.mode === 'platform');
  const platformSpend = (plan?.departments ?? []).filter((d) => d.engine.mode === 'platform').reduce((s, d) => s + d.spendMonthCents, 0);
  const platformBudget = platformDepts.reduce((s, d) => s + d.monthlyBudgetCents, 0);
  const bad = (conns ?? []).filter((c) => c.status === 'expired' || c.status === 'error').length;
  const okCount = (conns ?? []).filter((c) => c.status === 'ok').length;

  return (
    <OfficeShell title={t('aiOffice.connect.title')} sub={t('aiOffice.connect.sub')} plan={plan?.plan}>
      <div className="ofp-k" style={{ marginBottom: -8 }}>{t('aiOffice.connect.engines')}</div>
      <div className="cn-engs">
        <div className="ofp-card cn-eng on">
          <div className="cn-eh">
            <span className="cn-el">AI</span>
            <div>
              <b>{t('aiOffice.engine.platform')}</b>
              <span>{t('aiOffice.engine.platformHint')}</span>
            </div>
            <span className="ofp-tag ok live"><i />{t('aiOffice.connect.works')}</span>
          </div>
          <div className="cn-use">
            <div className="l">
              <span className="ofp-k">{t('aiOffice.connect.spendMonth')}</span>
              <b>{fmtEur(platformSpend)}{platformBudget ? ` / ${fmtEur(platformBudget)}` : ''}</b>
            </div>
            <div className="ofp-prog"><i style={{ width: platformBudget ? Math.min(100, (platformSpend / platformBudget) * 100) + '%' : '0%', background: platformBudget && platformSpend / platformBudget > 0.8 ? 'var(--of-warn)' : 'var(--of-ink)' }} /></div>
            <div className="cn-deps">
              {platformDepts.map((d) => <span key={d.id} className="ofp-tag"><i style={{ background: d.color }} />{d.name}</span>)}
              {platformDepts.length === 0 && <span className="ofp-k">{t('aiOffice.connect.noDeptsYet')}</span>}
            </div>
          </div>
        </div>
        {(engines?.byok ?? []).map((k) => {
          const used = depts.filter((d) => d.engine.mode === 'byok' && d.engine.connectionId === k.connectionId);
          return (
            <div key={k.connectionId} className={cnx('ofp-card cn-eng', k.status === 'ok' && 'on')}>
              <div className="cn-eh">
                <span className="cn-el">{'{ }'}</span>
                <div>
                  <b>{k.label}</b>
                  <span>{k.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} · …{k.keyTail}{k.model ? ` · ${k.model}` : ''}</span>
                </div>
                <span className={cnx('ofp-tag', k.status === 'ok' ? 'ok live' : 'err')}><i />{k.status === 'ok' ? t('aiOffice.connect.works') : t('aiOffice.connStatus.error')}</span>
              </div>
              <div className="cn-use">
                <span className="ofp-k">{t('aiOffice.connect.byokBilling')}</span>
                <div className="cn-deps">{used.map((d) => <span key={d.id} className="ofp-tag"><i style={{ background: d.color }} />{d.name}</span>)}</div>
              </div>
            </div>
          );
        })}
        {(engines?.byok ?? []).length === 0 && (
          <div className="ofp-card cn-eng">
            <div className="cn-eh">
              <span className="cn-el">{'{ }'}</span>
              <div>
                <b>{t('aiOffice.engine.byok')}</b>
                <span>{t('aiOffice.engine.byokOnRequest')}</span>
              </div>
              <span className="ofp-tag"><i />{t('aiOffice.connStatus.off')}</span>
            </div>
            <div className="cn-how">
              <p>{t('aiOffice.connect.byokHow')}</p>
              <Link className="ofp-btn" to="/integrations-hub">{t('aiOffice.connect.openHub')}</Link>
            </div>
          </div>
        )}
      </div>

      <div className="ofp-card">
        <div className="ofp-card-h">
          <h2>
            {t('aiOffice.edit.sec.conns')}{' '}
            <small>
              {t('aiOffice.connect.connectedN', { count: okCount })}
              {bad ? ` · ${t('aiOffice.connect.attentionN', { count: bad })}` : ''}
            </small>
          </h2>
          <Link className="ofp-btn" to="/ai-office/brain?tab=access">{t('aiOffice.connect.accessInBrain')}</Link>
        </div>
        <div className="cn-grid">
          {(conns ?? []).map((c) => {
            const users = c.departmentIds.map(deptName).filter(Boolean) as OfficeDepartment[];
            const needsSettings = (c.key === 'github' || c.key === 'notion') && c.instances.some((i) => i.status === 'ok' && !(c.key === 'github' ? i.settings?.repo : i.settings?.parentPageId));
            const statusText =
              c.status === 'ok'
                ? needsSettings
                  ? t('aiOffice.connect.needsSettings')
                  : c.instances.length > 1
                    ? t('aiOffice.connect.instancesN', { count: c.instances.length })
                    : c.instances[0]?.label || t('aiOffice.connStatus.ok')
                : c.status === 'expired'
                  ? t('aiOffice.connect.expired')
                  : c.status === 'error'
                    ? c.instances.find((i) => i.detail)?.detail || t('aiOffice.connStatus.error')
                    : t('aiOffice.connStatus.off');
            const isOpen = open === c.key;
            return (
              <div key={c.key} className={cnx('cn-c', c.status)} id={c.key}>
                <OfficeLogo c={c} size={36} off={c.status === 'off'} />
                <div className="m">
                  <b>{c.name}</b>
                  <span>{statusText}</span>
                  {users.length > 0 && (
                    <span className="br-scope" style={{ marginTop: 4 }}>
                      {users.map((d) => <i key={d.id} title={d.name} style={{ background: d.color }} />)}
                    </span>
                  )}
                </div>
                {c.key === 'crm' ? (
                  <span className="cn-ok">●</span>
                ) : OAUTH.has(c.key) ? (
                  <>
                    {c.status === 'ok' && (c.key === 'github' || c.key === 'notion') && (
                      <button className={cnx('ofp-btn', needsSettings && 'pri')} onClick={() => setOpen(isOpen ? null : c.key)}>{t('aiOffice.connect.settings')}</button>
                    )}
                    {(c.status !== 'ok' || c.key === 'canva') && c.oauth && (
                      <button className={cnx('ofp-btn', c.status !== 'off' && 'pri')} disabled={busy === c.key} onClick={() => startOAuth(c.key)}>
                        {c.status === 'off' ? t('aiOffice.connect.connect') : t('aiOffice.connect.reconnect')}
                      </button>
                    )}
                    {c.status !== 'ok' && !c.oauth && c.tokenGrant && (
                      <button className="ofp-btn" onClick={() => setOpen(isOpen ? null : c.key)}>{t('aiOffice.connect.byToken')}</button>
                    )}
                    {c.status !== 'ok' && !c.oauth && !c.tokenGrant && <span className="ofp-tag">{t('aiOffice.connect.appNotConfigured')}</span>}
                  </>
                ) : c.status === 'ok' ? (
                  <span className="cn-ok">●</span>
                ) : (
                  <Link className={cnx('ofp-btn', c.status !== 'off' && 'pri')} to={CONNECT_PATH[c.key] ?? '/integrations-hub'}>
                    {c.status === 'off' ? t('aiOffice.connect.connect') : t('aiOffice.connect.reconnect')}
                  </Link>
                )}
                {isOpen && c.status === 'ok' && c.instances[0] && <ConnSettings c={c} inst={c.instances.find((i) => i.status === 'ok') ?? c.instances[0]} onSaved={load} />}
                {isOpen && c.status !== 'ok' && c.tokenGrant && <TokenForm c={c} depts={depts} onDone={() => { setOpen(null); load(); }} />}
              </div>
            );
          })}
          {!conns && <div className="of-none">{t('aiOffice.common.loading')}</div>}
        </div>
      </div>
      <p className="pl-foot">{t('aiOffice.connect.foot')}</p>
    </OfficeShell>
  );
}

export default AiOfficeConnectPage;
