import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, TG_ICON } from './TelegramIcons';
import { fetchTelegramFunnel, updateTelegramBot, type TelegramBot } from '../../api/telegram-crm';

interface Props { bot: TelegramBot }

export const TelegramFunnelTab: React.FC<Props> = ({ bot }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [stages, setStages] = useState<Array<{ nm: string; cnt: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(bot.meta?.crmLink?.stage || 'new');
  const [source, setSource] = useState(bot.meta?.crmLink?.source || 'telegram');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchTelegramFunnel(bot.id).then(setStages).catch(() => setStages([])).finally(() => setLoading(false));
    setStage(bot.meta?.crmLink?.stage || 'new');
    setSource(bot.meta?.crmLink?.source || 'telegram');
  }, [bot.id]);

  const max = Math.max(1, ...stages.map((s) => s.cnt));

  const save = async () => {
    setBusy(true);
    try {
      await updateTelegramBot(bot.id, { meta: { crmLink: { stage, source } } });
      showAlert(t('crm.telegram.funnel.saved'), { variant: 'success' });
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tg-split">
      <div className="tg-card">
        <div className="tg-card-head">
          <div>
            <h3><Ic d={TG_ICON.crm} size={15} />{t('crm.telegram.funnel.title')}</h3>
            <div className="sub">{t('crm.telegram.funnel.subtitle')}</div>
          </div>
        </div>
        <div className="tg-card-body">
          {loading ? (
            <div className="tg-empty">{t('crm.telegram.loading')}</div>
          ) : (
            <div className="tg-funnel">
              {stages.map((s, i) => (
                <div key={i} className="tg-fstage">
                  <div className="nm">{s.nm}</div>
                  <div className="tg-fbar"><i style={{ width: `${(s.cnt / max) * 100}%` }} /></div>
                  <div className="cnt">{s.cnt.toLocaleString()}</div>
                  <div className="pc">{stages[0]?.cnt ? `${Math.round((s.cnt / stages[0].cnt) * 100)}%` : '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="tg-card">
          <div className="tg-card-head"><div><h3><Ic d={TG_ICON.link} size={15} />{t('crm.telegram.funnel.linkTitle')}</h3><div className="sub">{t('crm.telegram.funnel.linkSubtitle')}</div></div></div>
          <div className="tg-card-body">
            <div className="tg-field"><span className="tg-label">{t('crm.telegram.funnel.initialStage')}</span><input className="tg-input mono" value={stage} onChange={(e) => setStage(e.target.value)} placeholder="new" /></div>
            <div className="tg-field" style={{ marginBottom: 0 }}><span className="tg-label">{t('crm.telegram.funnel.source')}</span><input className="tg-input mono" value={source} onChange={(e) => setSource(e.target.value)} placeholder="telegram" /></div>
            <button className="btn btn-sm btn-primary" style={{ marginTop: 14 }} disabled={busy} onClick={save}><Ic d={TG_ICON.check} size={13} />{t('crm.telegram.funnel.save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
