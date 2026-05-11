import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchSmsConfig,
  saveSmsConfig,
  deleteSmsConfig,
  type SmsConfigDto,
  type SmsProvider,
} from '../../api/sms';

interface ProviderDef {
  value: SmsProvider;
  label: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
}

const PROVIDERS: ProviderDef[] = [
  {
    value: 'twilio',
    label: 'Twilio',
    description: 'Глобальный провайдер, работает по всему миру',
    fields: [
      { key: 'accountSid',  label: 'Account SID',       placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'authToken',   label: 'Auth Token',         placeholder: '••••••••••••••••••••••••••••••••', secret: true },
      { key: 'fromPhone',   label: 'Номер отправителя',  placeholder: '+19998887766' },
    ],
  },
  {
    value: 'smsc',
    label: 'SMSC.ru',
    description: 'Российский провайдер, поддерживает именной отправитель',
    fields: [
      { key: 'login',    label: 'Логин',                           placeholder: 'my_login' },
      { key: 'password', label: 'Пароль',                          placeholder: '••••••••', secret: true },
      { key: 'sender',   label: 'Имя отправителя (необязательно)', placeholder: 'MyBrand' },
    ],
  },
  {
    value: 'smsru',
    label: 'SMS.ru',
    description: 'Российский провайдер с простым API',
    fields: [
      { key: 'apiId', label: 'API ID',                           placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', secret: true },
      { key: 'from',  label: 'Имя отправителя (необязательно)', placeholder: 'MyBrand' },
    ],
  },
];

export const SmsSettingsPage: React.FC = () => {
  const [config, setConfig]         = useState<SmsConfigDto | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  const [provider, setProvider]         = useState<SmsProvider>('twilio');
  const [credentials, setCredentials]   = useState<Record<string, string>>({});
  const [senderName, setSenderName]     = useState('');
  const [isEnabled, setIsEnabled]       = useState(true);

  useEffect(() => { void loadConfig(); }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await fetchSmsConfig();
      setConfig(data);
      if (data) {
        setProvider(data.provider);
        setSenderName(data.senderName ?? '');
        setIsEnabled(data.isEnabled);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await saveSmsConfig({ provider, credentials, senderName: senderName || undefined, isEnabled });
      setSuccess(true);
      setCredentials({});
      await loadConfig();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить настройки SMS? Отправка сообщений станет недоступна.')) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSmsConfig();
      setConfig(null);
      setCredentials({});
      setSuccess(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const providerDef = PROVIDERS.find((p) => p.value === provider)!;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-2xl">

        {/* Header */}
        <div className="page-header mb-0">
          <div>
            <h1 className="page-title">Настройка SMS</h1>
            <p className="page-subtitle">
              Подключите провайдера для отправки SMS контактам и лидам
            </p>
          </div>
          <Link to="/app/sms" className="btn-secondary">
            ← История сообщений
          </Link>
        </div>

        {loading ? (
          <div className="text-sm text-text-secondary py-10 text-center">Загрузка…</div>
        ) : (
          <>
            {/* Current status */}
            {config && (
              <div className="card p-4 flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${config.isEnabled ? 'bg-status-success' : 'bg-text-tertiary'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111827]">
                    {PROVIDERS.find((p) => p.value === config.provider)?.label ?? config.provider}
                    {' '}
                    <span className="font-normal text-text-secondary">
                      — {config.isEnabled ? 'подключено и активно' : 'подключено, но отключено'}
                    </span>
                  </p>
                  {config.senderName && (
                    <p className="text-xs text-text-secondary mt-0.5">Отправитель: {config.senderName}</p>
                  )}
                </div>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn-danger flex-shrink-0"
                >
                  {deleting ? 'Удаление…' : 'Отключить'}
                </button>
              </div>
            )}

            {/* Provider selection */}
            <div className="card p-5 space-y-5">
              <div>
                <p className="section-label">Провайдер</p>
                <div className="grid grid-cols-3 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => { setProvider(p.value); setCredentials({}); }}
                      className={`text-left rounded-xl border px-3 py-3 transition-all ${
                        provider === p.value
                          ? 'border-[#111827] bg-surface-subtle ring-1 ring-[#111827]'
                          : 'border-border-default hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className={`h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${provider === p.value ? 'border-[#111827]' : 'border-border-strong'}`}>
                          {provider === p.value && <div className="h-1.5 w-1.5 rounded-full bg-[#111827]" />}
                        </div>
                        <span className="text-sm font-semibold text-[#111827]">{p.label}</span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-tight pl-5">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Credentials */}
              <div>
                <p className="section-label">Данные подключения</p>
                {config?.hasCredentials && (
                  <div className="mb-3 text-xs text-text-secondary bg-status-warning-bg border border-amber-200 rounded-xl px-3 py-2.5">
                    Учётные данные уже сохранены. Заполните поля ниже только если хотите их обновить.
                  </div>
                )}
                <div className="space-y-3">
                  {providerDef.fields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        {field.label}
                      </label>
                      <input
                        type={field.secret ? 'password' : 'text'}
                        className="input w-full"
                        placeholder={field.placeholder}
                        value={credentials[field.key] ?? ''}
                        onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Sender name */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Глобальное имя отправителя
                  <span className="font-normal text-text-tertiary"> (необязательно)</span>
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Lumiva"
                  maxLength={64}
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
                <p className="text-[11px] text-text-tertiary mt-1.5">
                  Отображается вместо номера, если провайдер и страна это поддерживают
                </p>
              </div>

              {/* Enable toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-[#111827]">SMS активны</p>
                  <p className="text-xs text-text-secondary mt-0.5">Разрешить отправку SMS через этот провайдер</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-border-strong rounded-full peer peer-checked:bg-[#111827] transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 shadow-sm" />
                </label>
              </div>

              {/* Feedback */}
              {error && (
                <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2.5">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-xs text-status-success bg-status-success-bg border border-green-200 rounded-xl px-3 py-2.5">
                  Настройки успешно сохранены
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1 border-t border-border-default">
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? 'Сохраняем…' : 'Сохранить настройки'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};
