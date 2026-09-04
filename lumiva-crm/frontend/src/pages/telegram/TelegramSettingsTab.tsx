import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, TG_ICON } from './TelegramIcons';
import {
  updateTelegramBot,
  fetchTelegramWebhookInfo,
  saveTelegramCommands,
  fetchTelegramLog,
  fetchTelegramBotRecipients,
  createTelegramBotRecipient,
  deleteTelegramBotRecipient,
  type TelegramBot,
  type TelegramCapabilities,
  type TelegramBotCommand,
  type TelegramStaffRecipient,
} from '../../api/telegram-crm';
import { fetchStaff, type StaffUser } from '../../api/staff';

const CAP_KEYS: Array<keyof TelegramCapabilities> = [
  'aiAutoReply', 'humanHandoff', 'leadCreation', 'bookingIntegration', 'payments', 'files', 'broadcast', 'staffNotifications', 'offHours', 'dailyDigest',
];
const CAP_DEFAULT_ON = new Set<keyof TelegramCapabilities>(['aiAutoReply', 'humanHandoff', 'leadCreation', 'bookingIntegration', 'files', 'staffNotifications']);
const CAP_IN_DEVELOPMENT = new Set<keyof TelegramCapabilities>(['payments', 'broadcast']);

interface Props { bot: TelegramBot; onBotChange: (bot: TelegramBot) => void }

export const TelegramSettingsTab: React.FC<Props> = ({ bot, onBotChange }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();

  const [caps, setCaps] = useState<TelegramCapabilities>(bot.meta?.capabilities || {});
  const [commands, setCommands] = useState<TelegramBotCommand[]>(bot.meta?.commands || []);
  const [log, setLog] = useState<Array<{ t: string; k: string; m: string }>>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'errors' | 'ai'>('all');
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [recipients, setRecipients] = useState<TelegramStaffRecipient[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [newRecipientStaffId, setNewRecipientStaffId] = useState('');
  const [newRecipientChatId, setNewRecipientChatId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCaps(bot.meta?.capabilities || {});
    setCommands(bot.meta?.commands || []);
    fetchTelegramLog(bot.id, logFilter).then(setLog).catch(() => setLog([]));
    fetchTelegramWebhookInfo(bot.id).then(setWebhookInfo).catch(() => setWebhookInfo(null));
    fetchTelegramBotRecipients(bot.id).then(setRecipients).catch(() => setRecipients([]));
    fetchStaff().then(setStaff).catch(() => setStaff([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.id]);

  useEffect(() => {
    fetchTelegramLog(bot.id, logFilter).then(setLog).catch(() => setLog([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logFilter]);

  const isCapOn = (key: keyof TelegramCapabilities): boolean => (caps[key] !== undefined ? !!caps[key] : CAP_DEFAULT_ON.has(key));

  const toggleCap = async (key: keyof TelegramCapabilities) => {
    const next = { ...caps, [key]: !isCapOn(key) };
    setCaps(next);
    try {
      const updated = await updateTelegramBot(bot.id, { meta: { capabilities: next } });
      onBotChange(updated);
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    }
  };

  const saveCommands = async () => {
    setBusy(true);
    try {
      const saved = await saveTelegramCommands(bot.id, commands);
      setCommands(saved);
      showAlert(t('crm.telegram.settings.commandsSaved'), { variant: 'success' });
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const addRecipient = async () => {
    const s = staff.find((x) => x.id === newRecipientStaffId);
    if (!s || !newRecipientChatId.trim()) return;
    try {
      const r = await createTelegramBotRecipient(bot.id, { staffUserId: s.id, staffUserName: s.fullName, telegramChatId: newRecipientChatId.trim() });
      setRecipients((prev) => [...prev, r]);
      setNewRecipientStaffId('');
      setNewRecipientChatId('');
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    }
  };

  const removeRecipient = async (id: string) => {
    try {
      await deleteTelegramBotRecipient(bot.id, id);
      setRecipients((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    }
  };

  return (
    <div className="tg-split">
      <div>
        <div className="tg-card" style={{ marginBottom: 16 }}>
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.bolt} size={15} />{t('crm.telegram.settings.capabilitiesTitle')}</h3><div className="sub">{t('crm.telegram.settings.capabilitiesSubtitle')}</div></div></div>
          <div className="tg-card-body">
            {CAP_KEYS.map((key) => (
              <div key={key} className="tg-toggle-row">
                <div style={{ flex: 1 }}>
                  <div className="t">{t(`crm.telegram.settings.capabilities.${key}.title`)}</div>
                  <div className="d">{t(`crm.telegram.settings.capabilities.${key}.desc`)}{CAP_IN_DEVELOPMENT.has(key) ? ` ${t('crm.telegram.settings.inDevelopment')}` : ''}</div>
                </div>
                <div className={`tg-switch ${isCapOn(key) ? 'on' : ''}`} onClick={() => toggleCap(key)}><i /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="tg-card" style={{ marginBottom: 16 }}>
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.msg} size={15} />{t('crm.telegram.settings.commandsTitle')}</h3><div className="sub">{t('crm.telegram.settings.commandsSubtitle')}</div></div><button className="btn btn-sm" onClick={() => setCommands((prev) => [...prev, { command: '', description: '' }])}><Ic d={TG_ICON.plus} size={12} />{t('crm.telegram.settings.addCommand')}</button></div>
          <div className="tg-card-body">
            {commands.map((c, i) => (
              <div key={i} className="tg-cmd">
                <input className="tg-input mono" style={{ padding: '6px 8px' }} value={c.command} onChange={(e) => setCommands((prev) => prev.map((x, j) => (j === i ? { ...x, command: e.target.value.replace(/^\//, '') } : x)))} placeholder="start" />
                <input className="tg-input" style={{ padding: '6px 8px' }} value={c.description} onChange={(e) => setCommands((prev) => prev.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder={t('crm.telegram.settings.commandDescPlaceholder') || ''} />
                <button className="tg-node-del" onClick={() => setCommands((prev) => prev.filter((_, j) => j !== i))}><Ic d={TG_ICON.trash} size={13} /></button>
              </div>
            ))}
            <button className="btn btn-sm btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={saveCommands}><Ic d={TG_ICON.check} size={13} />{t('crm.telegram.settings.saveCommands')}</button>
          </div>
        </div>

        <div className="tg-card">
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.doc} size={15} />{t('crm.telegram.settings.logTitle')}</h3><div className="sub">{t('crm.telegram.settings.logSubtitle')}</div></div><div className="tg-seg"><button className={logFilter === 'all' ? 'on' : ''} onClick={() => setLogFilter('all')}>{t('crm.telegram.settings.logAll')}</button><button className={logFilter === 'errors' ? 'on' : ''} onClick={() => setLogFilter('errors')}>{t('crm.telegram.settings.logErrors')}</button><button className={logFilter === 'ai' ? 'on' : ''} onClick={() => setLogFilter('ai')}>{t('crm.telegram.settings.logAi')}</button></div></div>
          <div className="tg-card-body">
            {log.length === 0 ? <div className="tg-empty">{t('crm.telegram.settings.logEmpty')}</div> : (
              <div className="tg-log">
                {log.map((l, i) => <div key={i}><span className="t">{l.t}</span><span className={l.k}>{l.m}</span></div>)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="tg-card" style={{ marginBottom: 16 }}>
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.users} size={15} />{t('crm.telegram.settings.recipientsTitle')}</h3><div className="sub">{t('crm.telegram.settings.recipientsSubtitle')}</div></div></div>
          <div className="tg-card-body">
            {recipients.map((r) => (
              <div key={r.id} className="tg-kv">
                <span className="k" style={{ color: 'var(--ink)', fontWeight: 500 }}>{r.staffUserName}<span style={{ display: 'block', fontSize: 11, color: 'var(--fg-3)', fontWeight: 400, marginTop: 2 }}>{r.telegramUsername ? `@${r.telegramUsername}` : r.telegramChatId}</span></span>
                <button className="tg-node-del" onClick={() => removeRecipient(r.id)}><Ic d={TG_ICON.trash} size={13} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <select className="tg-select" style={{ flex: 1, minWidth: 120 }} value={newRecipientStaffId} onChange={(e) => setNewRecipientStaffId(e.target.value)}>
                <option value="">{t('crm.telegram.settings.pickStaff')}</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
              <input className="tg-input mono" style={{ flex: 1, minWidth: 120 }} placeholder={t('crm.telegram.settings.chatIdPlaceholder') || ''} value={newRecipientChatId} onChange={(e) => setNewRecipientChatId(e.target.value)} />
              <button className="btn btn-sm" onClick={addRecipient}><Ic d={TG_ICON.plus} size={12} /></button>
            </div>
            <div className="hint" style={{ marginTop: 8 }}>{t('crm.telegram.settings.recipientsHint')}</div>
          </div>
        </div>

        <div className="tg-card" style={{ marginBottom: 16 }}>
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.refresh} size={15} />{t('crm.telegram.settings.diagnosticsTitle')}</h3><div className="sub">getWebhookInfo</div></div></div>
          <div className="tg-card-body">
            {webhookInfo ? (
              <>
                <div className="tg-kv"><span className="k">URL</span><span className="v mono">{webhookInfo.url ? webhookInfo.url.replace(/^https?:\/\//, '') : t('crm.telegram.bots.notSet')}</span></div>
                <div className="tg-kv"><span className="k">{t('crm.telegram.settings.pendingUpdates')}</span><span className="v mono">{webhookInfo.pending_update_count ?? 0}</span></div>
                <div className="tg-kv"><span className="k">{t('crm.telegram.settings.lastError')}</span><span className="v mono">{webhookInfo.last_error_message || t('crm.telegram.settings.noneShort')}</span></div>
                <div className="tg-kv"><span className="k">IP</span><span className="v mono">{webhookInfo.ip_address || '—'}</span></div>
              </>
            ) : <div className="tg-empty">{t('crm.telegram.loading')}</div>}
          </div>
        </div>

        <div className="tg-card">
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.shield} size={15} />{t('crm.telegram.settings.privacyTitle')}</h3><div className="sub">{t('crm.telegram.settings.privacySubtitle')}</div></div></div>
          <div className="tg-card-body">
            <div className="tg-check"><span className="ic"><Ic d={TG_ICON.check} size={14} /></span>{t('crm.telegram.settings.privacy.masked')}</div>
            <div className="tg-check"><span className="ic"><Ic d={TG_ICON.check} size={14} /></span>{t('crm.telegram.settings.privacy.stop')}</div>
            <div className="tg-check"><span className="ic"><Ic d={TG_ICON.check} size={14} /></span>{t('crm.telegram.settings.privacy.retention')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
