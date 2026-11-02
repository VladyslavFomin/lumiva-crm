// src/pages/instagram-crm/InstagramPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  disconnectInstagramAccount,
  fetchInstagramAccounts,
  startInstagramOAuth,
  updateInstagramAccount,
  type InstagramAccount,
} from '../../api/instagram-crm';
import { IntegrationHealthPill, formatAgo } from '../../components/integrations/IntegrationHealthBadge';

const CALLBACK_RESULTS = ['connected', 'denied', 'invalid_state', 'missing_oauth', 'oauth_error', 'no_accounts', 'subscribe_error'] as const;

const Toggle: React.FC<{ checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string; hint: string }> = ({
  checked,
  disabled,
  onChange,
  label,
  hint,
}) => (
  <label className="flex items-start gap-3 py-2.5 cursor-pointer select-none">
    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#222]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <span className="min-w-0">
      <span className="block text-[13px] font-medium text-[#222]">{label}</span>
      <span className="block text-[11.5px] text-[#888] leading-snug mt-0.5">{hint}</span>
    </span>
  </label>
);

const AccountCard: React.FC<{ acc: InstagramAccount; onChanged: (a: InstagramAccount) => void; onDisconnect: (a: InstagramAccount) => void }> = ({
  acc,
  onChanged,
  onDisconnect,
}) => {
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [kw, setKw] = useState((acc.settings?.commentKeywords || []).join(', '));
  const [err, setErr] = useState('');
  const s = acc.settings || {};
  const off = acc.status === 'disconnected';

  const save = async (patch: Parameters<typeof updateInstagramAccount>[1]) => {
    setSaving(true);
    setErr('');
    try {
      onChanged(await updateInstagramAccount(acc.id, patch));
    } catch (e) {
      setErr((e as Error)?.message || t('crm.instagram.errors.save'));
    } finally {
      setSaving(false);
    }
  };
  const commitKeywords = () => {
    const list = kw.split(',').map((x) => x.trim()).filter(Boolean);
    if (list.join(',') === (s.commentKeywords || []).join(',')) return;
    void save({ commentKeywords: list });
  };
  const ago = formatAgo(acc.lastEventAt, (i18n.language || 'ru').slice(0, 2));

  return (
    <div className="rounded-[14px] border border-[#e7e7e7] bg-white overflow-hidden">
      <div className="flex items-center gap-3.5 px-[18px] py-4 flex-wrap">
        {acc.profilePictureUrl ? (
          <img src={acc.profilePictureUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#E1306C] text-white flex items-center justify-center font-bold shrink-0">IG</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[15px] text-[#222] truncate">@{acc.igUsername || acc.igUserId}</span>
            {off ? (
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] px-2 py-[3px] rounded-full border text-[#888] border-[#e7e7e7] bg-[#fafafa]">
                {t('crm.instagram.status.disconnected')}
              </span>
            ) : (
              <IntegrationHealthPill status={acc.status === 'error' ? 'error' : 'ok'} />
            )}
          </div>
          <div className="text-[11.5px] text-[#888] mt-0.5">
            {acc.pageName ? t('crm.instagram.viaPage', { page: acc.pageName }) : null}
            {ago ? ` · ${t('crm.instagram.lastEvent', { ago })}` : ` · ${t('crm.instagram.noEventsYet')}`}
          </div>
          {acc.status === 'error' && acc.lastError && <div className="text-[11.5px] text-[#b42318] mt-1 break-words">{acc.lastError}</div>}
        </div>
        {!off && (
          <button
            type="button"
            onClick={() => onDisconnect(acc)}
            className="rounded-lg border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#555] hover:border-[#b42318] hover:text-[#b42318] transition-colors"
          >
            {t('crm.instagram.disconnect')}
          </button>
        )}
      </div>
      {!off && (
        <div className="border-t border-[#f0f0f0] px-[18px] py-2 grid gap-x-8 sm:grid-cols-2">
          <Toggle
            checked={s.dmToLead !== false}
            disabled={saving}
            onChange={(v) => void save({ dmToLead: v })}
            label={t('crm.instagram.settings.dmToLead')}
            hint={t('crm.instagram.settings.dmToLeadHint')}
          />
          <div>
            <Toggle
              checked={s.commentsToLead !== false}
              disabled={saving}
              onChange={(v) => void save({ commentsToLead: v })}
              label={t('crm.instagram.settings.commentsToLead')}
              hint={t('crm.instagram.settings.commentsToLeadHint')}
            />
            {s.commentsToLead !== false && (
              <div className="pl-7 pb-2.5">
                <input
                  value={kw}
                  disabled={saving}
                  onChange={(e) => setKw(e.target.value)}
                  onBlur={commitKeywords}
                  onKeyDown={(e) => e.key === 'Enter' && commitKeywords()}
                  placeholder={t('crm.instagram.settings.keywordsPlaceholder')}
                  className="w-full border border-[#e7e7e7] rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] text-[#222] outline-none focus:border-[#222]"
                />
                <div className="text-[11px] text-[#888] mt-1">{t('crm.instagram.settings.keywordsHint')}</div>
              </div>
            )}
          </div>
          {err && <div className="sm:col-span-2 text-[12px] text-[#b42318] pb-2">{err}</div>}
        </div>
      )}
    </div>
  );
};

const InstagramPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const [params, setParams] = useSearchParams();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await fetchInstagramAccounts());
    } catch (e) {
      setNotice({ ok: false, text: (e as Error)?.message || t('crm.instagram.errors.load') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const r = params.get('ig');
    if (!r) return;
    const key = (CALLBACK_RESULTS as readonly string[]).includes(r) ? r : 'oauth_error';
    setNotice({ ok: key === 'connected', text: t(`crm.instagram.callback.${key}`) });
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.delete('ig');
      return n;
    }, { replace: true });
  }, [params, setParams, t]);

  const connect = async () => {
    setConnecting(true);
    try {
      const { url } = await startInstagramOAuth();
      window.location.href = url;
    } catch (e) {
      setConnecting(false);
      showAlert((e as Error)?.message || t('crm.instagram.errors.connect'), { variant: 'error' });
    }
  };

  const disconnect = async (acc: InstagramAccount) => {
    const ok = await showConfirm(t('crm.instagram.disconnectConfirm', { name: `@${acc.igUsername || acc.igUserId}` }), { danger: true });
    if (!ok) return;
    try {
      await disconnectInstagramAccount(acc.id);
      await load();
    } catch (e) {
      showAlert((e as Error)?.message || t('crm.instagram.errors.save'), { variant: 'error' });
    }
  };

  const active = accounts.filter((a) => a.status !== 'disconnected');
  const disconnected = accounts.filter((a) => a.status === 'disconnected');

  return (
    <MainLayout>
      <div>
        <div className="flex items-end justify-between gap-5 pb-5 border-b border-[#e7e7e7] mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E1306C]" />
              <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#888]">Instagram</span>
            </div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[#222] leading-tight">{t('crm.instagram.title')}</h1>
            <p className="text-[13px] text-[#888] mt-1.5 max-w-[560px] leading-[1.45]">{t('crm.instagram.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {active.length > 0 && (
              <Link
                to="/instagram/inbox"
                className="inline-flex items-center px-3 py-[7px] border border-[#e7e7e7] rounded-lg text-[12.5px] font-medium text-[#222] bg-white hover:border-[#222] transition-colors"
              >
                {t('crm.instagram.openInbox')}
              </Link>
            )}
            <button
              type="button"
              onClick={() => void connect()}
              disabled={connecting}
              className="inline-flex items-center px-3.5 py-[7px] rounded-lg text-[12.5px] font-medium text-white bg-[#222] hover:bg-black disabled:opacity-50 transition-colors"
            >
              {connecting ? t('crm.instagram.connecting') : active.length ? t('crm.instagram.connectMore') : t('crm.instagram.connect')}
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={`mb-5 rounded-[12px] border px-4 py-3 text-[13px] ${
              notice.ok ? 'border-[#c5e3d2] bg-[#eaf4ee] text-[#1f6b4a]' : 'border-[#f4c7c3] bg-[#fdecea] text-[#8f1d14]'
            }`}
          >
            {notice.text}
          </div>
        )}

        {loading && <p className="text-xs text-[#888]">{t('crm.instagram.loading')}</p>}

        {!loading && !active.length && (
          <div className="rounded-[14px] border border-dashed border-[#d9d9d9] bg-[#fafafa] px-5 py-6">
            <div className="text-[14px] font-semibold text-[#222]">{t('crm.instagram.empty.title')}</div>
            <ol className="mt-2 text-[12.5px] text-[#555] leading-relaxed list-decimal pl-5 space-y-1">
              <li>{t('crm.instagram.empty.step1')}</li>
              <li>{t('crm.instagram.empty.step2')}</li>
              <li>{t('crm.instagram.empty.step3')}</li>
            </ol>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {active.map((a) => (
            <AccountCard key={a.id} acc={a} onChanged={(n) => setAccounts((l) => l.map((x) => (x.id === n.id ? { ...x, ...n } : x)))} onDisconnect={disconnect} />
          ))}
        </div>

        {disconnected.length > 0 && (
          <div className="mt-7">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#888] font-medium whitespace-nowrap">
                {t('crm.instagram.disconnectedHeading')}
              </span>
              <div className="flex-1 h-px bg-[#f0f0f0]" />
            </div>
            <div className="flex flex-col gap-3 opacity-70">
              {disconnected.map((a) => (
                <AccountCard key={a.id} acc={a} onChanged={() => undefined} onDisconnect={() => undefined} />
              ))}
            </div>
            <p className="text-[11.5px] text-[#888] mt-2">{t('crm.instagram.reconnectHint')}</p>
          </div>
        )}

        <p className="text-[11.5px] text-[#888] mt-6 leading-relaxed">{t('crm.instagram.rulesNote')}</p>
      </div>
    </MainLayout>
  );
};

export default InstagramPage;
