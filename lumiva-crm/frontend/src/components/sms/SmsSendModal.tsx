import React, { useState, useEffect } from 'react';
import { sendSms, fetchSmsMessages, type SmsMessage, type SmsEntityType } from '../../api/sms';

interface Props {
  phone: string;
  entityType: SmsEntityType;
  entityId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  sent: 'Отправлено',
  delivered: 'Доставлено',
  failed: 'Ошибка',
  pending: 'Ожидание',
};

const STATUS_COLORS: Record<string, string> = {
  sent: 'text-green-600',
  delivered: 'text-green-700',
  failed: 'text-red-500',
  pending: 'text-slate-400',
};

export const SmsSendModal: React.FC<Props> = ({ phone, entityType, entityId, onClose }) => {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SmsMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [entityId]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { items } = await fetchSmsMessages({ entityType, entityId, limit: 20 });
      setHistory(items);
    } catch {
      // non-critical
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendSms({ to: phone, body: body.trim(), entityType, entityId });
      setBody('');
      setHistory((prev) => [msg, ...prev]);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  const remaining = 160 - body.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="text-sm font-semibold text-slate-900">Отправить SMS</div>
            <div className="text-xs text-slate-500">{phone}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
          {historyLoading ? (
            <div className="text-xs text-slate-400 text-center py-4">Загрузка истории…</div>
          ) : history.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-4">История SMS пуста</div>
          ) : (
            history.map((msg) => (
              <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${msg.direction === 'outbound' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
                  <div className="text-sm leading-relaxed">{msg.body}</div>
                  <div className={`text-[10px] mt-1 flex items-center gap-1 ${msg.direction === 'outbound' ? 'text-white/50 justify-end' : 'text-slate-400'}`}>
                    <span>{new Date(msg.createdAt).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.direction === 'outbound' && (
                      <span className={STATUS_COLORS[msg.status]}>· {STATUS_LABELS[msg.status]}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Compose */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-3">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>
          )}
          <div className="relative">
            <textarea
              className="input w-full resize-none pr-16"
              rows={3}
              placeholder="Текст SMS…"
              maxLength={1600}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <span className={`absolute bottom-2 right-3 text-[10px] ${remaining < 0 ? 'text-red-500' : 'text-slate-400'}`}>
              {remaining}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Ctrl+Enter для отправки</span>
            <button
              onClick={handleSend}
              disabled={sending || !body.trim() || remaining < 0}
              className="btn-primary text-sm px-4 py-1.5"
            >
              {sending ? 'Отправка…' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
