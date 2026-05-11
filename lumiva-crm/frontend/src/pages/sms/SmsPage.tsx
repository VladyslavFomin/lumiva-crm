import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchSmsMessages,
  fetchSmsConfig,
  sendSms,
  type SmsMessage,
  type SmsConfigDto,
} from '../../api/sms';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'В очереди',  cls: 'badge-warning' },
  sent:      { label: 'Отправлено', cls: 'badge-info'    },
  delivered: { label: 'Доставлено', cls: 'badge-active'  },
  failed:    { label: 'Ошибка',     cls: 'badge-error'   },
};

const PROVIDER_LABELS: Record<string, string> = {
  twilio: 'Twilio',
  smsc:   'SMSC.ru',
  smsru:  'SMS.ru',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('ru', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtCost(cost: number | null, unit: string | null) {
  if (cost == null) return '—';
  const sym = unit === 'USD' ? '$' : unit === 'EUR' ? '€' : (unit ?? '');
  if (unit === 'USD' || unit === 'EUR') return `${sym}${cost.toFixed(4)}`;
  return `${cost.toFixed(2)} ${sym}`;
}

const LIMIT = 50;

interface SendModalProps {
  onClose: () => void;
  onSent: (msg: SmsMessage) => void;
}

const SendModal: React.FC<SendModalProps> = ({ onClose, onSent }) => {
  const [phone, setPhone] = useState('');
  const [body, setBody]   = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const remaining = 160 - body.length;

  const handleSend = async () => {
    if (!phone.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendSms({ to: phone.trim(), body: body.trim() });
      onSent(msg);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h2 className="text-base font-semibold text-[#111827]">Новое SMS</h2>
          <button onClick={onClose} className="btn-icon text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Номер получателя</label>
            <input
              type="tel"
              className="input w-full"
              placeholder="+7 999 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Текст сообщения
              <span className={`ml-2 font-normal ${remaining < 0 ? 'text-status-error' : 'text-text-tertiary'}`}>
                {remaining} симв.
              </span>
            </label>
            <textarea
              className="input w-full resize-none"
              rows={4}
              placeholder="Текст SMS…"
              maxLength={1600}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void handleSend(); }
              }}
            />
            <p className="text-[11px] text-text-tertiary mt-1">Ctrl+Enter — отправить</p>
          </div>
          {error && (
            <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="px-6 pb-5 flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Отмена</button>
          <button
            onClick={handleSend}
            disabled={sending || !phone.trim() || !body.trim() || remaining < 0}
            className="btn-primary"
          >
            {sending ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const SmsPage: React.FC = () => {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [offset, setOffset]     = useState(0);
  const [config, setConfig]     = useState<SmsConfigDto | null | undefined>(undefined);
  const [sendOpen, setSendOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ items, total: t }, cfg] = await Promise.all([
        fetchSmsMessages({ limit: LIMIT, offset }),
        config === undefined ? fetchSmsConfig() : Promise.resolve(config),
      ]);
      setMessages(items);
      setTotal(t);
      if (config === undefined) setConfig(cfg);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => { void load(); }, [load]);

  const totalCost = messages.reduce((s, m) => s + (m.cost ?? 0), 0);
  const costUnit  = messages.find((m) => m.costUnit)?.costUnit ?? null;

  const handleSent = (msg: SmsMessage) => {
    setSendOpen(false);
    setMessages((prev) => [msg, ...prev]);
    setTotal((t) => t + 1);
  };

  return (
    <MainLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="page-header mb-0">
          <div>
            <h1 className="page-title">SMS</h1>
            <p className="page-subtitle">История входящих и исходящих сообщений</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/app/sms/settings" className="btn-secondary">Настройка провайдера</Link>
            <button onClick={() => setSendOpen(true)} className="btn-primary">+ Новое SMS</button>
          </div>
        </div>

        {/* Provider status bar */}
        {config !== undefined && (
          <div className={`card p-3 flex items-center gap-3 ${!config ? 'border-amber-200 bg-amber-50' : ''}`}>
            {config ? (
              <>
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${config.isEnabled ? 'bg-status-success' : 'bg-text-tertiary'}`} />
                <span className="text-sm text-[#111827]">
                  <span className="font-medium">{PROVIDER_LABELS[config.provider] ?? config.provider}</span>
                  {' '}—{' '}
                  <span className="text-text-secondary">{config.isEnabled ? 'подключено и активно' : 'подключено, но отключено'}</span>
                  {config.senderName && (
                    <span className="text-text-tertiary"> · отправитель: {config.senderName}</span>
                  )}
                </span>
                {messages.length > 0 && costUnit && (
                  <span className="ml-auto text-xs text-text-secondary">
                    Сумма на этой странице: <span className="font-medium text-[#111827]">{fmtCost(totalCost, costUnit)}</span>
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-status-warning flex-shrink-0" />
                <span className="text-sm text-text-secondary flex-1">
                  Провайдер не настроен — SMS не будут отправляться
                </span>
                <Link to="/app/sms/settings" className="btn-primary text-xs px-3 py-1.5 flex-shrink-0">
                  Настроить
                </Link>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div className="text-sm text-text-secondary py-10 text-center">Загрузка…</div>
        )}

        {/* Empty */}
        {!loading && !error && messages.length === 0 && (
          <div className="card p-12 text-center">
            <div className="text-3xl mb-3">📱</div>
            <div className="text-sm font-medium text-[#111827] mb-1">Сообщений пока нет</div>
            <div className="text-xs text-text-secondary mb-5 max-w-xs mx-auto">
              Отправьте SMS отсюда или со страницы контакта/лида — оно появится здесь
            </div>
            <button onClick={() => setSendOpen(true)} className="btn-primary">
              Отправить первое SMS
            </button>
          </div>
        )}

        {/* Table */}
        {!loading && !error && messages.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-secondary">
                Показано {offset + 1}–{Math.min(offset + LIMIT, total)} из {total}
              </p>
            </div>

            <div className="table-wrapper">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header-cell">Направление</th>
                    <th className="table-header-cell">Номер</th>
                    <th className="table-header-cell">Сообщение</th>
                    <th className="table-header-cell">Статус</th>
                    <th className="table-header-cell">Стоимость</th>
                    <th className="table-header-cell">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {messages.map((msg) => {
                    const st = STATUS_MAP[msg.status] ?? { label: msg.status, cls: 'badge-inactive' };
                    return (
                      <tr key={msg.id} className="hover:bg-surface-hover transition-colors">
                        <td className="px-4 py-3">
                          <span className={`badge ${msg.direction === 'outbound' ? 'badge-info' : 'badge-inactive'}`}>
                            {msg.direction === 'outbound' ? '↑ Исх.' : '↓ Вх.'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[#111827] whitespace-nowrap">
                          {msg.direction === 'outbound' ? msg.toPhone : (msg.fromPhone ?? '—')}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary max-w-xs">
                          <span className="line-clamp-2">{msg.body}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={st.cls}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap font-mono">
                          {fmtCost(msg.cost, msg.costUnit)}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">
                          {fmt(msg.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {total > LIMIT && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                  disabled={offset === 0}
                  className="btn-secondary disabled:opacity-40"
                >
                  ← Назад
                </button>
                <span className="text-xs text-text-secondary">
                  Стр. {Math.floor(offset / LIMIT) + 1} / {Math.ceil(total / LIMIT)}
                </span>
                <button
                  onClick={() => setOffset(offset + LIMIT)}
                  disabled={offset + LIMIT >= total}
                  className="btn-secondary disabled:opacity-40"
                >
                  Вперёд →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {sendOpen && <SendModal onClose={() => setSendOpen(false)} onSent={handleSent} />}
    </MainLayout>
  );
};
