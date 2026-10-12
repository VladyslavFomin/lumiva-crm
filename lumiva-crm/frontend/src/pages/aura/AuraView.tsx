import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { auraApi, auraPublicApi, auraShareUrl, AuraPublicError, type AuraApp, type AuraData, type AuraFilters, type AuraPeriod, type AuraPublicData, type AuraPublicInfo } from '../../api/aura';
import { AU_I, AuIc, AuraShell, useAuraAppData, useAuraDraft, useAuraPreview } from './auraShared';
import { AuraDash } from './AuraDash';
import { autoTitle } from './AuraWizard';
import './aura.css';

function toggleFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void el.requestFullscreen?.().catch(() => undefined);
}

/** Панель поверх приложения без меню: появляется при движении мыши, прячется через 2,6 с. */
function useAutoHide() {
  const [show, setShow] = useState(true);
  const tm = useRef<number | undefined>(undefined);
  const ping = useCallback(() => {
    setShow(true);
    window.clearTimeout(tm.current);
    tm.current = window.setTimeout(() => setShow(false), 2600);
  }, []);
  useEffect(() => {
    ping();
    return () => window.clearTimeout(tm.current);
  }, [ping]);
  return { show, ping };
}

function useApp(id: string | undefined) {
  const [app, setApp] = useState<AuraApp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!id || id === 'draft') return;
    auraApi
      .get(id)
      .then(setApp)
      .catch((e: Error) => setErr(e.message));
  }, [id]);
  return { app, err };
}

/** /aura/view/:id — приложение внутри CRM, с меню. */
export const AuraViewPage: React.FC = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { id } = useParams();
  const { app, err } = useApp(id);
  const [period, setPeriod] = useState<AuraPeriod | null>(null);
  const [filters, setFilters] = useState<AuraFilters>({});
  useEffect(() => {
    if (app) setPeriod(app.config.period);
  }, [app]);
  const res = useAuraAppData(app?.id || null, period, filters, app?.refreshSec);
  return (
    <AuraShell route="view" flush>
      {err ? (
        <div className="au-center">
          <p>{err}</p>
          <button type="button" className="btn" onClick={() => nav('/aura/apps')}>
            {t('crm.aura.nav.apps')}
          </button>
        </div>
      ) : (
        <>
          <div className="au-viewbar">
            <span className="au-viewbar-t">{app ? `${t(`crm.aura.access.${app.access}.name`)}${app.share.enabled ? ` · ${t('crm.aura.apps.public')}` : ''}` : ''}</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => res.reload()} title={t('crm.aura.view.refresh')}>
              <AuIc d={AU_I.refresh} size={13} />
              {t('crm.aura.view.refresh')}
            </button>
            {app?.share.enabled && (
              <button type="button" className="btn btn-sm" onClick={() => void navigator.clipboard?.writeText(auraShareUrl(app.share.shareKey))}>
                <AuIc d={AU_I.link} size={13} />
                {t('crm.aura.view.copyLink')}
              </button>
            )}
            {app?.canEdit && (
              <button type="button" className="btn btn-sm" onClick={() => nav(`/aura/build/${app.id}`)}>
                <AuIc d={AU_I.edit} size={13} />
                {t('crm.aura.apps.edit')}
              </button>
            )}
            {app && (
              <button type="button" className="btn btn-sm btn-primary" onClick={() => nav(`/aura/app/${app.id}`)}>
                <AuIc d={AU_I.full} size={13} />
                {t('crm.aura.view.noMenu')}
              </button>
            )}
          </div>
          {app && period && (
            <AuraDash
              title={app.name}
              sources={app.config.sources}
              widgets={app.config.widgets}
              theme={app.theme}
              density={app.density}
              data={res.data}
              error={res.error}
              period={period}
              onPeriod={setPeriod}
              breakdown={app.config.breakdown}
              custom={app.config.custom || []}
              style={app.config.style || null}
              filters={filters}
              onFilter={(k, v) => setFilters((f) => ({ ...f, [k]: v || undefined }))}
            />
          )}
        </>
      )}
    </AuraShell>
  );
};

/** /aura/app/:id — без меню CRM (ТВ, второй монитор). id=draft — превью черновика. */
export const AuraAppPage: React.FC = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { id } = useParams();
  const [sp] = useSearchParams();
  const [draft] = useAuraDraft();
  const useDraft = id === 'draft' || (sp.get('draft') === '1' && draft.appId === id);
  const { app, err } = useApp(useDraft ? undefined : id);
  const { show, ping } = useAutoHide();
  const [period, setPeriod] = useState<AuraPeriod | null>(useDraft ? draft.period : null);
  const [filters, setFilters] = useState<AuraFilters>({});
  useEffect(() => {
    if (app) setPeriod(app.config.period);
  }, [app]);
  const appRes = useAuraAppData(!useDraft ? app?.id || null : null, period, filters, app?.refreshSec);
  const draftRes = useAuraPreview(useDraft ? { widgets: draft.widgets, period: period || draft.period, breakdown: draft.breakdown, goals: draft.goals, custom: draft.custom || [] } : null, filters, 300);
  const res = useDraft ? draftRes : appRes;
  const spec = useDraft
    ? { title: autoTitle(draft, t), sources: draft.sources, widgets: draft.widgets, theme: draft.theme, density: draft.density, breakdown: draft.breakdown, custom: draft.custom || [], style: draft.style || null }
    : app
      ? { title: app.name, sources: app.config.sources, widgets: app.config.widgets, theme: app.theme, density: app.density, breakdown: app.config.breakdown, custom: app.config.custom || [], style: app.config.style || null }
      : null;
  const back = () => nav(useDraft ? (draft.appId ? `/aura/build/${draft.appId}` : '/aura/build') : app?.kiosk ? '/aura/apps' : `/aura/view/${id}`);
  return (
    <div className={'au-appview dsh-th-' + (spec?.theme || 'lumiva')} onMouseMove={ping} onTouchStart={ping}>
      <div className={'au-appbar' + (show ? ' show' : '')}>
        <button type="button" className="au-appbar-b" onClick={back}>
          <AuIc d={AU_I.back} size={14} />
          <span>{t('crm.aura.view.toCrm')}</span>
        </button>
        <span className="au-appbar-t">{spec ? spec.title : ''}{useDraft ? ` · ${t('crm.aura.view.draft')}` : ''}</span>
        <div style={{ flex: 1 }} />
        {(useDraft || app?.canEdit) && (
          <button type="button" className="au-appbar-b" onClick={() => nav(useDraft ? (draft.appId ? `/aura/build/${draft.appId}` : '/aura/build') : `/aura/build/${id}`)}>
            <AuIc d={AU_I.edit} size={14} />
            <span>{t('crm.aura.apps.edit')}</span>
          </button>
        )}
        <button type="button" className="au-appbar-b" onClick={toggleFullscreen}>
          <AuIc d={AU_I.full} size={14} />
          <span>{t('crm.aura.view.fullscreen')}</span>
        </button>
      </div>
      {err && <div className="au-center">{err}</div>}
      {spec && period && (
        <AuraDash
          {...spec}
          data={res.data}
          error={res.error}
          period={period}
          onPeriod={setPeriod}
          filters={filters}
          onFilter={(k, v) => setFilters((f) => ({ ...f, [k]: v || undefined }))}
        />
      )}
    </div>
  );
};

/** /aura/tv/:shareKey — публичная ссылка, без входа в CRM. */
export const PublicAuraPage: React.FC = () => {
  const { t } = useTranslation();
  const { shareKey = '' } = useParams();
  const tokenKey = `aura_share_token_${shareKey}`;
  const [info, setInfo] = useState<AuraPublicInfo | null>(null);
  const [pub, setPub] = useState<AuraPublicData | null>(null);
  const [data, setData] = useState<AuraData | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [period, setPeriod] = useState<AuraPeriod | null>(null);
  const [filters, setFilters] = useState<AuraFilters>({});
  const { show, ping } = useAutoHide();
  const token = () => {
    try {
      return sessionStorage.getItem(tokenKey);
    } catch {
      return null;
    }
  };

  const load = useCallback(
    async (p: AuraPeriod | null, f: AuraFilters) => {
      try {
        const r = await auraPublicApi.data(shareKey, token(), p || undefined, f);
        setPub(r);
        setData(r.data);
        setNeedPassword(false);
        if (!p) setPeriod(r.data.period.key);
      } catch (e) {
        const err = e as AuraPublicError;
        if (err.status === 401) {
          try {
            sessionStorage.removeItem(tokenKey);
          } catch {
            /* ignore */
          }
          setNeedPassword(true);
          return;
        }
        setError({ status: err.status || 0, message: err.message });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shareKey],
  );

  useEffect(() => {
    auraPublicApi
      .info(shareKey)
      .then((i) => {
        setInfo(i);
        document.title = `${i.name} · ${i.companyName}`;
        if (i.requiresPassword && !token()) setNeedPassword(true);
        else void load(null, {});
      })
      .catch((e: AuraPublicError) => setError({ status: e.status || 0, message: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareKey]);

  // автообновление с частотой, выбранной владельцем
  useEffect(() => {
    if (!pub || !period) return;
    const id = window.setInterval(() => document.visibilityState === 'visible' && void load(period, filters), Math.max(60, pub.app.refreshSec) * 1000);
    return () => window.clearInterval(id);
  }, [pub, period, filters, load]);

  const unlock = async () => {
    setPwError(null);
    try {
      const r = await auraPublicApi.unlock(shareKey, password);
      try {
        if (r.token) sessionStorage.setItem(tokenKey, r.token);
      } catch {
        /* ignore */
      }
      setPassword('');
      await load(null, {});
    } catch (e) {
      setPwError((e as Error).message === 'Неверный пароль' || (e as AuraPublicError).status === 401 ? t('crm.aura.public.wrongPassword') : (e as Error).message);
    }
  };

  if (error) {
    return (
      <div className="au-public au-center" style={{ minHeight: '100vh' }}>
        <h2 style={{ fontFamily: 'var(--ff-display)' }}>{error.status === 410 ? t('crm.aura.public.expired') : t('crm.aura.public.unavailable')}</h2>
        <p className="au-muted">{t('crm.aura.public.askOwner')}</p>
      </div>
    );
  }
  if (needPassword) {
    return (
      <div className="au-public au-center" style={{ minHeight: '100vh', background: '#f5f5f6' }}>
        <form
          className="au-lock"
          onSubmit={(e) => {
            e.preventDefault();
            void unlock();
          }}
        >
          <h2>{info?.name || 'Aura'}</h2>
          <p className="au-muted" style={{ margin: 0 }}>
            {t('crm.aura.public.passwordNeeded', { company: info?.companyName || '' })}
          </p>
          <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('crm.aura.pub.password')} />
          {pwError && <div className="au-err">{pwError}</div>}
          <button type="submit" disabled={!password}>
            {t('crm.aura.public.open')}
          </button>
        </form>
      </div>
    );
  }
  if (!pub || !period) {
    return <div className="au-public au-center" style={{ minHeight: '100vh' }}>{t('crm.aura.dash.loading')}</div>;
  }
  const a = pub.app;
  return (
    <div className={'au-appview au-public dsh-th-' + a.theme} onMouseMove={ping} onTouchStart={ping}>
      <div className={'au-appbar' + (show ? ' show' : '')}>
        <span className="au-appbar-t">
          {a.name} · {a.companyName}
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" className="au-appbar-b" onClick={toggleFullscreen}>
          <AuIc d={AU_I.full} size={14} />
          <span>{t('crm.aura.view.fullscreen')}</span>
        </button>
      </div>
      <AuraDash
        title={a.name}
        sources={a.config.sources}
        widgets={a.config.widgets}
        theme={a.theme}
        density={a.density}
        data={data ? { ...data, own: false } : null}
        period={period}
        onPeriod={(p) => {
          setPeriod(p);
          void load(p, filters);
        }}
        breakdown={a.config.breakdown}
        custom={a.config.custom || []}
        style={a.config.style || null}
        filters={filters}
        onFilter={(k, v) => {
          const f = { ...filters, [k]: v || undefined };
          setFilters(f);
          void load(period, f);
        }}
      />
    </div>
  );
};
