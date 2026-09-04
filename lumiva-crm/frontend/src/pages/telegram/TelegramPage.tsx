import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, TG_ICON } from './TelegramIcons';
import {
  fetchTelegramBots,
  fetchTelegramContacts,
  updateTelegramBot,
  setWebhook,
  deleteTelegramBot,
  type TelegramBot,
  type TelegramContactWithPreview,
} from '../../api/telegram-crm';
import { TelegramConnectModal } from './TelegramConnectModal';
import { TelegramFlowTab } from './TelegramFlowTab';
import { TelegramFunnelTab } from './TelegramFunnelTab';
import { TelegramAiTab } from './TelegramAiTab';
import { TelegramSettingsTab } from './TelegramSettingsTab';
import './telegram-design.css';

type TabId = 'bots' | 'flow' | 'funnel' | 'ai' | 'settings';

const Sw: React.FC<{ on: boolean; onClick: () => void }> = ({ on, onClick }) => (
  <div className={`tg-switch ${on ? 'on' : ''}`} onClick={onClick}><i /></div>
);

export const TelegramPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();

  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [contacts, setContacts] = useState<TelegramContactWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('bots');
  const [botId, setBotId] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [greeting, setGreeting] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [botsData, contactsData] = await Promise.all([fetchTelegramBots(), fetchTelegramContacts()]);
      setBots(botsData);
      setContacts(contactsData);
      if (!botId && botsData.length) setBotId(botsData[0].id);
    } catch (e: any) {
      setError(e.message || t('crm.telegram.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const bot = useMemo(() => bots.find((b) => b.id === botId) || bots[0] || null, [bots, botId]);
  useEffect(() => { setGreeting(bot?.welcomeMessage || ''); }, [bot?.id, bot?.welcomeMessage]);

  const kpis = useMemo(() => {
    const activeBots = bots.filter((b) => b.status === 'active').length;
    const withPhone = contacts.filter((c) => c.telegramUsername || c.telegramFirstName).length;
    const leftContact = contacts.filter((c: any) => c.telegramPhone).length;
    const leads = contacts.filter((c) => c.leadId).length;
    return [
      { l: t('crm.telegram.kpis.totalBots'), v: String(bots.length) },
      { l: t('crm.telegram.kpis.activeBots'), v: String(activeBots) },
      { l: t('crm.telegram.kpis.contacts'), v: String(contacts.length) },
      { l: t('crm.telegram.kpis.leftContact'), v: String(leftContact) },
      { l: t('crm.telegram.kpis.leads'), v: String(leads) },
    ];
  }, [bots, contacts, t]);

  const statusMeta = (status: string): { dot: string; badge: string; label: string } => {
    if (status === 'active') return { dot: 'ok', badge: 'confirmed', label: t('crm.telegram.status.active') };
    if (status === 'error') return { dot: 'err', badge: 'cancelled', label: t('crm.telegram.status.error') };
    if (status === 'inactive') return { dot: 'off', badge: 'noshow', label: t('crm.telegram.status.paused') };
    return { dot: 'warn', badge: 'pending', label: t('crm.telegram.status.pending') };
  };

  const handleCreated = (newBot: TelegramBot) => {
    setConnectOpen(false);
    setBots((prev) => [newBot, ...prev]);
    setBotId(newBot.id);
    showAlert(t('crm.telegram.connect.success'), { variant: 'success' });
  };

  const saveGreeting = async () => {
    if (!bot) return;
    setBusy(true);
    try {
      const updated = await updateTelegramBot(bot.id, { welcomeMessage: greeting });
      setBots((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      showAlert(t('crm.telegram.bots.saved'), { variant: 'success' });
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const toggleAutoReply = async () => {
    if (!bot) return;
    try {
      const updated = await updateTelegramBot(bot.id, { autoReply: !bot.autoReply });
      setBots((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    }
  };

  const togglePause = async () => {
    if (!bot) return;
    try {
      const updated = await updateTelegramBot(bot.id, { isActive: bot.status !== 'active' });
      setBots((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    }
  };

  const reinstallWebhook = async () => {
    if (!bot?.webhookUrl) return;
    setBusy(true);
    try {
      await setWebhook(bot.id, bot.webhookUrl);
      await load();
      showAlert(t('crm.telegram.bots.webhookReinstalled'), { variant: 'success' });
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const removeBot = async () => {
    if (!bot) return;
    const ok = await showConfirm(t('crm.telegram.bots.deleteConfirm', { name: bot.botName || bot.botUsername }), {
      title: t('crm.telegram.bots.deleteTitle'),
      confirmLabel: t('crm.telegram.bots.delete'),
      cancelLabel: t('crm.telegram.connect.cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTelegramBot(bot.id);
      setBots((prev) => prev.filter((b) => b.id !== bot.id));
      setBotId(null);
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    }
  };

  const TABS: Array<{ id: TabId; l: string; n?: string }> = [
    { id: 'bots', l: t('crm.telegram.tabs.bots'), n: bots.length ? String(bots.length) : undefined },
    { id: 'flow', l: t('crm.telegram.tabs.flow') },
    { id: 'funnel', l: t('crm.telegram.tabs.funnel') },
    { id: 'ai', l: t('crm.telegram.tabs.ai') },
    { id: 'settings', l: t('crm.telegram.tabs.settings') },
  ];

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="tg-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.telegram.kicker')}</div>
            <h1>{t('crm.telegram.title')}</h1>
            <p className="sub">{t('crm.telegram.subtitle')}</p>
          </div>
          <div className="tg-hero-r">
            <button className="btn btn-sm" onClick={() => navigate('/app/telegram/inbox')}>{t('crm.telegram.dialogsButton')}</button>
            <button className="btn btn-sm btn-primary" onClick={() => setConnectOpen(true)}><Ic d={TG_ICON.plus} size={13} />{t('crm.telegram.connectButton')}</button>
          </div>
        </div>

        <div className="tg-tabs">
          {TABS.map((tb) => (
            <div key={tb.id} className={`tg-tab ${tab === tb.id ? 'active' : ''}`} onClick={() => setTab(tb.id)}>
              {tb.l}{tb.n && <span className="n">{tb.n}</span>}
            </div>
          ))}
        </div>

        {error && <div className="tg-alert" style={{ marginBottom: 16 }}><Ic d={TG_ICON.flag} size={14} /><div>{error}</div></div>}
        {loading && !error && <div className="tg-empty">{t('crm.telegram.loading')}</div>}

        {!loading && !error && bots.length === 0 && (
          <div className="tg-card">
            <div className="tg-empty">
              <div style={{ marginBottom: 10 }}>{t('crm.telegram.bots.empty')}</div>
              <button className="btn btn-sm btn-primary" onClick={() => setConnectOpen(true)}><Ic d={TG_ICON.plus} size={13} />{t('crm.telegram.connectButton')}</button>
            </div>
          </div>
        )}

        {!loading && !error && bots.length > 0 && tab === 'bots' && (
          <>
            <div className="tg-kpis">
              {kpis.map((k, i) => (
                <div key={i} className="tg-kpi">
                  <div className="l">{k.l}</div>
                  <div className="v">{k.v}</div>
                </div>
              ))}
            </div>

            <div className="tg-split">
              <div className="tg-card">
                <div className="tg-card-head">
                  <div>
                    <h3><Ic d={TG_ICON.bot} size={15} />{t('crm.telegram.bots.listTitle')}</h3>
                    <div className="sub">{t('crm.telegram.bots.listSubtitle')}</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => setConnectOpen(true)}><Ic d={TG_ICON.plus} size={13} />{t('crm.telegram.connectButton')}</button>
                </div>
                <div className="tg-card-body tight">
                  {bots.map((b) => {
                    const st = statusMeta(b.status);
                    const botContacts = contacts.filter((c) => c.botId === b.id);
                    const leads = botContacts.filter((c) => c.leadId).length;
                    return (
                      <div key={b.id} className={`tg-bot ${b.id === bot?.id ? 'sel' : ''}`} onClick={() => setBotId(b.id)}>
                        <div className={`tg-bot-ava ${b.status !== 'active' ? 'off' : ''}`}>{(b.botName || b.botUsername || '??').slice(0, 2).toUpperCase()}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="tg-bot-name"><span className={`tg-dot ${st.dot}`} />{b.botName || b.botUsername}</div>
                          <div className="tg-bot-user">@{b.botUsername}</div>
                        </div>
                        <div className="tg-bot-metric"><b>{botContacts.length}</b>{t('crm.telegram.bots.contactsMetric')}</div>
                        <div className="tg-bot-metric"><b>{leads}</b>{t('crm.telegram.bots.leadsMetric')}</div>
                        <div><span className={`bk-badge ${st.badge}`}>{st.label}</span></div>
                        <Ic d={TG_ICON.chevR} size={14} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {bot && (
                <div className="tg-card">
                  <div className="tg-card-head">
                    <div>
                      <h3><span className={`tg-dot ${statusMeta(bot.status).dot}`} />{bot.botName || bot.botUsername}</h3>
                      <div className="sub">{t('crm.telegram.bots.createdAt', { date: new Date(bot.createdAt).toLocaleDateString() })}</div>
                    </div>
                    <button className="btn btn-sm" onClick={() => navigate(`/app/telegram/inbox?botId=${bot.id}`)}>{t('crm.telegram.bots.openChat')}</button>
                  </div>
                  <div className="tg-card-body">
                    {bot.lastError && (
                      <div className="tg-alert" style={{ marginBottom: 14 }}>
                        <Ic d={TG_ICON.flag} size={14} /><div><b>{t('crm.telegram.bots.webhookErrorTitle')}</b> {bot.lastError}</div>
                      </div>
                    )}
                    <div className="tg-kv"><span className="k">Username</span><span className="v mono">@{bot.botUsername}</span></div>
                    <div className="tg-kv"><span className="k">{t('crm.telegram.bots.fields.status')}</span><span className="v">{statusMeta(bot.status).label}</span></div>
                    <div className="tg-kv"><span className="k">{t('crm.telegram.bots.fields.token')}</span><span className="v mono">{bot.botToken}</span></div>
                    <div className="tg-kv"><span className="k">{t('crm.telegram.bots.fields.webhook')}</span><span className="v mono">{bot.webhookUrl ? bot.webhookUrl.replace('https://', '') : t('crm.telegram.bots.notSet')}</span></div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0 4px', borderTop: '1px solid var(--line-3)', marginTop: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{t('crm.telegram.bots.autoReply')}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 3 }}>{t('crm.telegram.bots.autoReplyHint')}</div>
                      </div>
                      <Sw on={bot.autoReply} onClick={toggleAutoReply} />
                    </div>

                    <div className="tg-field" style={{ marginTop: 14 }}>
                      <span className="tg-label">{t('crm.telegram.bots.greeting')}</span>
                      <textarea className="tg-area" value={greeting} onChange={(e) => setGreeting(e.target.value)} />
                      <div className="hint">{t('crm.telegram.bots.greetingHint')}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-primary" disabled={busy} onClick={saveGreeting}><Ic d={TG_ICON.check} size={13} />{t('crm.telegram.bots.save')}</button>
                      <button className="btn btn-sm" disabled={busy || !bot.webhookUrl} onClick={reinstallWebhook}><Ic d={TG_ICON.refresh} size={13} />{t('crm.telegram.bots.reinstallWebhook')}</button>
                      <button className="btn btn-sm" onClick={togglePause}>{bot.status === 'active' ? t('crm.telegram.bots.pause') : t('crm.telegram.bots.resume')}</button>
                      <button className="btn btn-sm" style={{ color: '#cc2f47' }} onClick={removeBot}><Ic d={TG_ICON.trash} size={13} />{t('crm.telegram.bots.delete')}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!loading && !error && bots.length > 0 && bot && tab === 'flow' && <TelegramFlowTab bot={bot} onBotChange={(u) => setBots((prev) => prev.map((b) => (b.id === u.id ? u : b)))} />}
        {!loading && !error && bots.length > 0 && bot && tab === 'funnel' && <TelegramFunnelTab bot={bot} />}
        {!loading && !error && bots.length > 0 && bot && tab === 'ai' && <TelegramAiTab bot={bot} onBotChange={(u) => setBots((prev) => prev.map((b) => (b.id === u.id ? u : b)))} />}
        {!loading && !error && bots.length > 0 && bot && tab === 'settings' && <TelegramSettingsTab bot={bot} onBotChange={(u) => setBots((prev) => prev.map((b) => (b.id === u.id ? u : b)))} />}
      </div>
      {connectOpen && <TelegramConnectModal onClose={() => setConnectOpen(false)} onCreated={handleCreated} />}
    </MainLayout>
  );
};
