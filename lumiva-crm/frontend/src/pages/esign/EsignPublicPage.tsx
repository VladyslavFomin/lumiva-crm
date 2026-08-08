// src/pages/esign/EsignPublicPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE } from '../../api/client';

interface PublicDoc {
  id: string;
  title: string;
  bodyText: string;
  status: string;
  signerEmail: string | null;
  signerName: string | null;
  signedAt: string | null;
}

async function esignFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const EsignPublicPage: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<PublicDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    esignFetch<PublicDoc>(`/esign/public/${token}`)
      .then((d) => {
        setDoc(d);
        if (d.status === 'signed') setSigned(true);
      })
      .catch((e: any) => setError(e?.message || 'Документ не найден или ссылка истекла'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed || !signerName.trim()) return;
    setSigning(true);
    setError(null);
    try {
      await esignFetch(`/esign/public/${token}/sign`, { method: 'POST', body: JSON.stringify({ signerName: signerName.trim() }) });
      setSigned(true);
    } catch (e: any) {
      setError(e?.message || 'Не удалось подписать документ');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Загрузка…</div>;
  }

  if (error && !doc) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md bg-white border border-slate-200 rounded-3xl p-6 text-sm text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-2xl font-semibold text-lumiva-accent">{doc?.title}</h1>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-sm text-slate-700 whitespace-pre-wrap">{doc?.bodyText}</div>
        </div>

        {signed ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-sm text-emerald-800">
            Документ подписан{doc?.signerName ? ` — ${doc.signerName}` : ''}. Спасибо!
          </div>
        ) : doc?.status === 'declined' ? (
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 text-sm text-slate-600">Документ был отклонён и больше не может быть подписан.</div>
        ) : (
          <form onSubmit={handleSign} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Ваше полное имя"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
              <span>Я прочитал(а) документ и согласен(на) с его условиями. Понимаю, что нажатие кнопки ниже является моей электронной подписью.</span>
            </label>
            <button
              type="submit"
              disabled={!agreed || !signerName.trim() || signing}
              className="w-full inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {signing ? 'Подписываем…' : 'Подписать'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default EsignPublicPage;
