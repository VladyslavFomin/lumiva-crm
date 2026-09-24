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

  const apiBaseForWebhook = API_BASE.startsWith('http')
    ? API_BASE.replace(/\/$/, '')
    : `${window.location.origin.replace(/\/$/, '')}${API_BASE.replace(/\/$/, '')}`;
  const webhookUrl = `${apiBaseForWebhook}/telegram-crm/webhook`;
  const webhookPreviewUrl = `${webhookUrl}/{bot-id}`;
  const stepDescriptions = [
    t('crm.telegram.connect.tokenHint'),
    preview ? `@${preview.username}` : t('crm.telegram.connect.verifiedNote'),
    t('crm.telegram.connect.webhookHint'),
  ];
  const previewInitials = (preview?.first_name || preview?.username || 'TG').slice(0, 2).toUpperCase();

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

  const handlePrimary = () => {
    if (step === 0) {
      void verify();
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    void finish();
  };

  return (
    <div className="tg-modal-back" onClick={onClose}>
      <div className="tg-modal tg-connect-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tg-modal-head tg-connect-head">
          <div className="tg-connect-title">
            <span className="tg-connect-mark"><Ic d={TG_ICON.bot} size={18} /></span>
            <div>
              <h3>{t('crm.telegram.connect.title')}</h3>
              <div className="sub">{t('crm.telegram.connect.subtitle')}</div>
            </div>
          </div>
          <button type="button" className="btn btn-sm tg-connect-close" onClick={onClose} aria-label={t('crm.telegram.connect.cancel')}>
            <Ic d={TG_ICON.x} size={15} />
          </button>
        </div>
        <div className="tg-modal-body">
          <div className="tg-connect-layout">
            <aside className="tg-connect-aside">
              <div className="tg-connect-steps" aria-label={t('crm.telegram.connect.steps.webhook')}>
                {steps.map((s, i) => (
                  <div key={s} className={`tg-connect-step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}>
                    <span className="n">{i < step ? <Ic d={TG_ICON.check} size={12} /> : i + 1}</span>
                    <span className="b">
                      <span className="t">{s}</span>
                      <span className="d">{stepDescriptions[i]}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="tg-connect-note">
                <span className="ic"><Ic d={TG_ICON.shield} size={15} /></span>
                <span>{t('crm.telegram.connect.tokenNote')}</span>
              </div>
            </aside>

            <section className="tg-connect-panel">
              <div className="tg-connect-panel-head">
                <div>
                  <div className="tg-label">{step + 1} / {steps.length}</div>
                  <h4>{steps[step]}</h4>
                </div>
                <span className="tg-connect-panel-ic">
                  <Ic d={step === 0 ? TG_ICON.shield : step === 1 ? TG_ICON.check : TG_ICON.link} size={16} />
                </span>
              </div>

              {error && (
                <div className="tg-alert" style={{ marginBottom: 14 }}>
                  <Ic d={TG_ICON.flag} size={14} />
                  <div>{error}</div>
                </div>
              )}

              {step === 0 && (
                <form
                  className="tg-connect-form"
                  onSubmit={(e: React.FormEvent) => {
                    e.preventDefault();
                    if (!busy && token.trim()) void verify();
                  }}
                >
                  <div className="tg-field">
                    <span className="tg-label">{t('crm.telegram.connect.tokenLabel')}</span>
                    <input
                      className="tg-input mono tg-connect-token"
                      type="password"
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="8129047562:AAH...AaZ"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                    />
                    <div className="hint">{t('crm.telegram.connect.tokenHint')}</div>
                  </div>
                  <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
                </form>
              )}

              {step === 1 && preview && (
                <div className="tg-connect-verify">
                  <div className="tg-connect-bot">
                    <div className="tg-bot-ava">{previewInitials}</div>
                    <div>
                      <div className="name">{preview.first_name}</div>
                      <div className="user mono">@{preview.username}</div>
                    </div>
                    <span className="bk-badge confirmed">{t('crm.telegram.status.active')}</span>
                  </div>
                  <div className="tg-connect-kv">
                    <div className="tg-kv"><span className="k">{t('crm.telegram.connect.fields.name')}</span><span className="v">{preview.first_name}</span></div>
                    <div className="tg-kv"><span className="k">{t('crm.telegram.connect.fields.username')}</span><span className="v mono">@{preview.username}</span></div>
                    <div className="tg-kv"><span className="k">ID</span><span className="v mono">{preview.id}</span></div>
                  </div>
                  <div className="tg-alert info">
                    <Ic d={TG_ICON.check} size={14} />
                    <div>{t('crm.telegram.connect.verifiedNote')}</div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="tg-connect-webhook">
                  <div className="tg-field">
                    <span className="tg-label">{t('crm.telegram.connect.webhookLabel')}</span>
                    <div className="tg-copy mono">{webhookPreviewUrl}</div>
                    <div className="hint">{t('crm.telegram.connect.webhookHint')}</div>
                  </div>
                  <div className="tg-connect-checks">
                    <div className="tg-check"><span className="ic"><Ic d={TG_ICON.check} size={14} /></span>{t('crm.telegram.connect.checks.https')}</div>
                    <div className="tg-check"><span className="ic"><Ic d={TG_ICON.check} size={14} /></span>{t('crm.telegram.connect.checks.noConflict')}</div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
        <div className="tg-modal-foot tg-connect-foot">
          <button type="button" className="btn btn-sm" onClick={() => (step === 0 ? onClose() : setStep(step - 1))} disabled={busy}>
            {step === 0 ? t('crm.telegram.connect.cancel') : t('crm.telegram.connect.back')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy || (step === 0 && !token.trim())}
            onClick={handlePrimary}
          >
            {busy ? t('crm.telegram.connect.working') : step === 2 ? (<><Ic d={TG_ICON.check} size={13} />{t('crm.telegram.connect.finish')}</>) : (<>{t('crm.telegram.connect.next')}<Ic d={TG_ICON.chevR} size={13} /></>)}
          </button>
        </div>
      </div>
    </div>
  );
};
