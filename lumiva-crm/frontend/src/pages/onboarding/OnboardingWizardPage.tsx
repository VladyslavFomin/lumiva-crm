// src/pages/onboarding/OnboardingWizardPage.tsx
import React, { useState } from 'react';
import {
  completeOnboarding,
  seedSampleData,
  type OnboardingStateDto,
} from '../../api/onboarding';
import { getSession } from '../../auth/session';

type Step = 'welcome' | 'team' | 'sample' | 'done';

const STEP_ORDER: Step[] = ['welcome', 'team', 'sample', 'done'];

export const OnboardingWizardPage: React.FC = () => {
  const session = getSession();
  const [step, setStep] = useState<Step>('welcome');
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState<OnboardingStateDto | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step);

  const goNext = () => {
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  };

  const finish = async () => {
    setFinishing(true);
    setError(null);
    try {
      await completeOnboarding();
      // Hard navigation, not react-router's navigate(): ProtectedRoute caches the onboarding
      // check for the lifetime of the page load, so a client-side route change here would still
      // see the stale "needs onboarding" result and bounce straight back to this page.
      window.location.href = '/dashboard';
    } catch (e: any) {
      setError(e?.message || 'Не удалось завершить настройку');
      setFinishing(false);
    }
  };

  const skipAll = () => {
    void finish();
  };

  const handleSeed = async () => {
    setSeeding(true);
    setError(null);
    try {
      const result = await seedSampleData();
      setSeeded(result);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить примеры данных');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1.5">
            {STEP_ORDER.map((s, i) => (
              <span
                key={s}
                className={
                  'h-1.5 w-10 rounded-full transition-colors ' +
                  (i <= stepIndex ? 'bg-black' : 'bg-slate-200')
                }
              />
            ))}
          </div>
          {step !== 'done' && (
            <button
              type="button"
              onClick={skipAll}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Пропустить настройку →
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-[0_24px_70px_rgba(17,24,39,0.12)] p-6 md:p-8">
          {step === 'welcome' && (
            <>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                Добро пожаловать
              </div>
              <h1 className="text-2xl font-semibold text-lumiva-accent mb-3">
                {session?.tenantName || 'Ваш аккаунт'} готов к работе
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Это займёт меньше минуты. Мы поможем пригласить команду и покажем, как выглядит
                CRM с реальными данными — прежде чем вы начнёте вносить свои.
              </p>
              <button
                type="button"
                onClick={goNext}
                className="w-full inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(34,34,34,0.18)]"
              >
                Начать
              </button>
            </>
          )}

          {step === 'team' && (
            <>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                Шаг 2 из 4
              </div>
              <h1 className="text-2xl font-semibold text-lumiva-accent mb-3">Пригласите команду</h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Добавьте коллег, которые будут работать с лидами, продажами или бронированиями.
                Это можно сделать и позже, в любой момент, в разделе «Сотрудники».
              </p>
              <div className="flex gap-2">
                <a
                  href="/staff"
                  className="flex-1 inline-flex items-center justify-center rounded-xl border border-slate-200 hover:border-lumiva-accent transition-all px-3 py-2.5 text-sm font-medium text-lumiva-accent"
                >
                  Открыть «Сотрудники»
                </a>
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white"
                >
                  Далее
                </button>
              </div>
            </>
          )}

          {step === 'sample' && (
            <>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                Шаг 3 из 4
              </div>
              <h1 className="text-2xl font-semibold text-lumiva-accent mb-3">
                Заполнить примерами данных?
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Мы добавим пару лидов, контакт, компанию и товары с пометкой «[Пример]», чтобы вы
                сразу увидели, как работает CRM — воронку, карточки, аналитику. Всё это можно
                удалить одной кнопкой в любой момент из настроек.
              </p>
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
                  {error}
                </div>
              )}
              {seeded ? (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-4">
                  Готово — примеры данных добавлены.
                </div>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 inline-flex items-center justify-center rounded-xl border border-slate-200 hover:border-lumiva-accent transition-all px-3 py-2.5 text-sm font-medium text-lumiva-accent disabled:opacity-60"
                  disabled={seeding}
                >
                  Начать с чистого листа
                </button>
                <button
                  type="button"
                  onClick={seeded ? goNext : handleSeed}
                  disabled={seeding}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {seeding ? 'Добавляем…' : seeded ? 'Далее' : 'Заполнить примерами'}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                Готово
              </div>
              <h1 className="text-2xl font-semibold text-lumiva-accent mb-3">Всё настроено</h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Можно приступать. Этот гид больше не будет показываться — вернуться к нему нельзя,
                но всё, что вы здесь сделали (приглашения, примеры данных), останется доступно в
                обычных разделах CRM.
              </p>
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={finish}
                disabled={finishing}
                className="w-full inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(34,34,34,0.18)] disabled:opacity-60"
              >
                {finishing ? 'Открываем…' : 'Перейти в CRM'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizardPage;
