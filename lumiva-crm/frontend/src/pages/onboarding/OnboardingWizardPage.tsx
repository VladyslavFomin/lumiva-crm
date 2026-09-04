// src/pages/onboarding/OnboardingWizardPage.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  completeOnboarding,
  seedSampleData,
  type OnboardingStateDto,
} from '../../api/onboarding';
import { getSession } from '../../auth/session';
import { LottieIcon } from '../../components/LottieIcon';

type Step = 'welcome' | 'team' | 'sample' | 'done';

const STEP_ORDER: Step[] = ['welcome', 'team', 'sample', 'done'];

/**
 * Renders as an overlay on top of the real CRM (the dashboard/whatever page the user landed
 * on renders normally underneath) rather than bouncing to a separate blank `/onboarding` page —
 * see ProtectedRoute in AppRouter.tsx, which mounts this and supplies onComplete.
 */
export const OnboardingWizardPage: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { t } = useTranslation();
  const ob = (key: string, opts?: Record<string, unknown>) => t(`crm.onboarding.${key}`, opts as any) as string;
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
      onComplete();
    } catch (e: any) {
      setError(e?.message || ob('finishError'));
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
      setError(e?.message || ob('seedError'));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9500] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 overflow-y-auto">
      <div className="w-full max-w-xl my-auto">
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
              {ob('skipAllBtn')}
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-[0_24px_70px_rgba(17,24,39,0.12)] p-6 md:p-8">
          {step === 'welcome' && (
            <>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                {ob('welcome.kicker')}
              </div>
              <h1 className="text-2xl font-semibold text-lumiva-accent mb-3">
                {ob('welcome.titleFormat', { tenantName: session?.tenantName || ob('welcome.tenantFallback') })}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {ob('welcome.body')}
              </p>
              <button
                type="button"
                onClick={goNext}
                className="w-full inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(34,34,34,0.18)]"
              >
                {ob('welcome.startBtn')}
              </button>
            </>
          )}

          {step === 'team' && (
            <>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                {ob('team.kicker')}
              </div>
              <h1 className="text-2xl font-semibold text-lumiva-accent mb-3">{ob('team.title')}</h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {ob('team.body')}
              </p>
              <div className="flex gap-2">
                <a
                  href="/staff"
                  className="flex-1 inline-flex items-center justify-center rounded-xl border border-slate-200 hover:border-lumiva-accent transition-all px-3 py-2.5 text-sm font-medium text-lumiva-accent"
                >
                  {ob('team.openStaffBtn')}
                </a>
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white"
                >
                  {ob('team.nextBtn')}
                </button>
              </div>
            </>
          )}

          {step === 'sample' && (
            <>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                {ob('sample.kicker')}
              </div>
              <h1 className="text-2xl font-semibold text-lumiva-accent mb-3">
                {ob('sample.title')}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {ob('sample.body')}
              </p>
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
                  {error}
                </div>
              )}
              {seeded ? (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-4">
                  {ob('sample.seededMsg')}
                </div>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 inline-flex items-center justify-center rounded-xl border border-slate-200 hover:border-lumiva-accent transition-all px-3 py-2.5 text-sm font-medium text-lumiva-accent disabled:opacity-60"
                  disabled={seeding}
                >
                  {ob('sample.startCleanBtn')}
                </button>
                <button
                  type="button"
                  onClick={seeded ? goNext : handleSeed}
                  disabled={seeding}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {seeding ? ob('sample.seedingBtn') : seeded ? ob('sample.nextBtn') : ob('sample.fillWithSamplesBtn')}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <>
              <div className="flex justify-center mb-1">
                <LottieIcon name="checklist-progress" size={72} loop={false} />
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 text-center">
                {ob('done.kicker')}
              </div>
              <h1 className="text-2xl font-semibold text-lumiva-accent mb-3 text-center">{ob('done.title')}</h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {ob('done.body')}
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
                {finishing ? ob('done.openingBtn') : ob('done.goToCrmBtn')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizardPage;
