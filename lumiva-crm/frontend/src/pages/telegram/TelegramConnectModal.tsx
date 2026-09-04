import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ic, TG_ICON } from './TelegramIcons';
import { previewTelegramBotToken, createTelegramBot, type TelegramBot } from '../../api/telegram-crm';
import { API_BASE } from '../../api/client';

interface Props {
  onClose: () => void;
  onCreated: (bot: TelegramBot) => void;
}

export const TelegramConnectModal: React.FC<Props> = ({ onClose, onCreated }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [token, setToken] = useState('');
  const [preview, setPreview] = useState<{ id: number; username: string; first_name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steps = [t('crm.telegram.connect.steps.token'), t('crm.telegram.connect.steps.verify'), t('crm.telegram.connect.steps.webhook')];

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const info = await previewTelegramBotToken(token.trim());
      setPreview(info);
      setStep(1);
    } catch (e: any) {
      setError(e.message || t('crm.telegram.connect.errors.invalidToken'));
    } finally {
      setBusy(false);
    }
  };

  const webhookUrl = `${API_BASE.replace(/\/$/, '')}/telegram-crm/webhook/${token.trim()}`;

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const bot = await createTelegramBot({ botToken: token.trim(), webhookUrl });
      onCreated(bot);
    } catch (e: any) {
      setError(e.message || t('crm.telegram.connect.errors.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tg-modal-back" onClick={onClose}>
      <div className="tg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tg-modal-head">
          <div>
            <h3>{t('crm.telegram.connect.title')}</h3>
            <div className="sub">{t('crm.telegram.connect.subtitle')}</div>
          </div>
          <button className="btn btn-sm" onClick={onClose}><Ic d={TG_ICON.x} size={15} /></button>
        </div>
        <div className="tg-modal-body">
          <div className="tg-steps">
            {steps.map((s, i) => (
              <div key={s} className={`tg-step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}>
                <div className="bar" /><span>{i + 1}. {s}</span>
              </div>
            ))}
          </div>

          {error && <div className="tg-alert" style={{ marginBottom: 14 }}><Ic d={TG_ICON.flag} size={14} /><div>{error}</div></div>}

          {step === 0 && (
            <>
              <div className="tg-field">
                <span className="tg-label">{t('crm.telegram.connect.tokenLabel')}</span>
                <input className="tg-input mono" placeholder="8129047562:AAH...AaZ" value={token} onChange={(e) => setToken(e.target.value)} />
                <div className="hint">{t('crm.telegram.connect.tokenHint')}</div>
              </div>
              <div className="tg-alert info"><Ic d={TG_ICON.shield} size={14} /><div>{t('crm.telegram.connect.tokenNote')}</div></div>
            </>
          )}

          {step === 1 && preview && (
            <>
              <div className="tg-alert info" style={{ marginBottom: 14 }}><Ic d={TG_ICON.check} size={14} /><div>{t('crm.telegram.connect.verifiedNote')}</div></div>
              <div className="tg-kv"><span className="k">{t('crm.telegram.connect.fields.name')}</span><span className="v">{preview.first_name}</span></div>
              <div className="tg-kv"><span className="k">{t('crm.telegram.connect.fields.username')}</span><span className="v mono">@{preview.username}</span></div>
              <div className="tg-kv"><span className="k">ID</span><span className="v mono">{preview.id}</span></div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="tg-field">
                <span className="tg-label">{t('crm.telegram.connect.webhookLabel')}</span>
                <div className="tg-copy mono">{webhookUrl}</div>
                <div className="hint">{t('crm.telegram.connect.webhookHint')}</div>
              </div>
              <div className="tg-check"><span className="ic"><Ic d={TG_ICON.check} size={14} /></span>{t('crm.telegram.connect.checks.https')}</div>
              <div className="tg-check"><span className="ic"><Ic d={TG_ICON.check} size={14} /></span>{t('crm.telegram.connect.checks.noConflict')}</div>
            </>
          )}
        </div>
        <div className="tg-modal-foot">
          <button className="btn btn-sm" onClick={() => (step === 0 ? onClose() : setStep(step - 1))} disabled={busy}>
            {step === 0 ? t('crm.telegram.connect.cancel') : t('crm.telegram.connect.back')}
          </button>
          <button
            className="btn btn-sm btn-primary"
            disabled={busy || (step === 0 && !token.trim())}
            onClick={() => (step === 0 ? verify() : step === 1 ? setStep(2) : finish())}
          >
            {busy ? t('crm.telegram.connect.working') : step === 2 ? (<><Ic d={TG_ICON.check} size={13} />{t('crm.telegram.connect.finish')}</>) : (<>{t('crm.telegram.connect.next')}<Ic d={TG_ICON.chevR} size={13} /></>)}
          </button>
        </div>
      </div>
    </div>
  );
};
