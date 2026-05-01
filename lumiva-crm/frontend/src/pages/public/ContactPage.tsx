import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from './PublicPageLayout';

type FormState = 'idle' | 'loading' | 'success' | 'error';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', message: '', teamSize: '' });
  const [state, setState] = useState<FormState>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setState('loading');
    try {
      const res = await fetch('/v1/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setState(res.ok ? 'success' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <PublicPageLayout
      pageKey="contact"
      title="Запросить демо"
      subtitle="Оставьте заявку и мы свяжемся с вами в течение рабочего дня. Покажем как Lumiva CRM решает задачи вашего бизнеса."
    >
      <div className="mt-10 grid lg:grid-cols-5 gap-8 items-start">

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-3"
        >
          {state === 'success' ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-card">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Заявка отправлена!</h3>
              <p className="text-sm text-slate-500 mb-6">Мы свяжемся с вами в течение одного рабочего дня.</p>
              <button
                onClick={() => { setState('idle'); setForm({ name: '', email: '', company: '', phone: '', message: '', teamSize: '' }); }}
                className="px-5 py-2.5 rounded-xl bg-black text-white text-xs font-semibold"
              >
                Отправить ещё
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-card flex flex-col gap-4">
              <h3 className="text-base font-semibold text-slate-900 mb-2">Расскажите о вашем бизнесе</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="form-label">Имя <span className="text-status-error">*</span></label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Иван Петров"
                    required
                    className="base-input"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="form-label">Email <span className="text-status-error">*</span></label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="ivan@company.ru"
                    required
                    className="base-input"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="form-label">Компания</label>
                  <input
                    name="company"
                    value={form.company}
                    onChange={handleChange}
                    placeholder="ООО «Пример»"
                    className="base-input"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="form-label">Телефон</label>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+7 (999) 000-00-00"
                    className="base-input"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="form-label">Размер команды</label>
                <select name="teamSize" value={form.teamSize} onChange={handleChange} className="base-select">
                  <option value="">Выберите...</option>
                  <option value="1-5">1–5 человек</option>
                  <option value="6-20">6–20 человек</option>
                  <option value="21-50">21–50 человек</option>
                  <option value="50+">Более 50</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="form-label">Расскажите о задаче</label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Что вы хотите автоматизировать? Какие есть сложности?"
                  className="base-textarea"
                />
              </div>

              {state === 'error' && (
                <div className="rounded-xl bg-status-error-bg border border-red-200 px-3 py-2 text-xs text-status-error">
                  Ошибка при отправке. Попробуйте снова или напишите нам напрямую.
                </div>
              )}

              <button
                type="submit"
                disabled={state === 'loading'}
                className="w-full py-3 rounded-xl bg-black text-white text-xs font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.25)] hover:bg-black-hover disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {state === 'loading' ? 'Отправляем...' : 'Запросить демо →'}
              </button>

              <p className="text-[10px] text-slate-400 text-center">
                Нажимая кнопку, вы соглашаетесь с{' '}
                <Link to="/privacy" className="underline hover:text-slate-900">политикой конфиденциальности</Link>
              </p>
            </form>
          )}
        </motion.div>

        {/* Info sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-2 flex flex-col gap-4"
        >
          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">Что вы получите на демо</h4>
            <div className="flex flex-col gap-3">
              {[
                'Полный обзор платформы под вашу задачу',
                'Настройка воронок и рабочих областей',
                'Демонстрация ключевых интеграций',
                'Ответы на все технические вопросы',
                'Персональный план внедрения',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs text-slate-500">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] shrink-0 mt-0.5">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Другие способы связи</h4>
            <div className="flex flex-col gap-3">
              <a href="mailto:hello@lumiva.agency" className="flex items-center gap-2.5 text-xs text-slate-500 hover:text-slate-900 transition-colors">
                <span className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                </span>
                <div>
                  <div className="font-medium text-slate-900">Email</div>
                  <div>hello@lumiva.agency</div>
                </div>
              </a>
              <a href="https://t.me/lumiva_crm" className="flex items-center gap-2.5 text-xs text-slate-500 hover:text-slate-900 transition-colors">
                <span className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                </span>
                <div>
                  <div className="font-medium text-slate-900">Telegram</div>
                  <div>@lumiva_crm</div>
                </div>
              </a>
            </div>
          </div>

          <div className="rounded-2xl bg-black text-white p-5">
            <div className="text-xs font-semibold mb-1">Ответим за 24 часа</div>
            <div className="text-[11px] opacity-70">Работаем по будням с 9:00 до 18:00 МСК</div>
          </div>
        </motion.div>
      </div>
    </PublicPageLayout>
  );
}
