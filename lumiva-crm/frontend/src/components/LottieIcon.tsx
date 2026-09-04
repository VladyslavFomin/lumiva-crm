import React, { Suspense, lazy, useEffect, useState } from 'react';

const Lottie = lazy(() => import('lottie-react').then((m) => ({ default: m.LottieLight })));

/** Каждый файл — отдельный динамический импорт, так что грузится только реально используемая анимация. */
const REGISTRY = {
  'add-plus': () => import('../assets/lottie/add-plus.json'),
  'ai-sparkle-orbit': () => import('../assets/lottie/ai-sparkle-orbit.json'),
  'approval-stamp': () => import('../assets/lottie/approval-stamp.json'),
  'automation-flow': () => import('../assets/lottie/automation-flow.json'),
  'checklist-progress': () => import('../assets/lottie/checklist-progress.json'),
  'confetti-burst': () => import('../assets/lottie/confetti-burst.json'),
  'data-extraction': () => import('../assets/lottie/data-extraction.json'),
  'delete-trash': () => import('../assets/lottie/delete-trash.json'),
  'drag-reorder': () => import('../assets/lottie/drag-reorder.json'),
  'empty-pulse': () => import('../assets/lottie/empty-pulse.json'),
  'empty-state-folder': () => import('../assets/lottie/empty-state-folder.json'),
  'error-alert': () => import('../assets/lottie/error-alert.json'),
  'gantt-bars': () => import('../assets/lottie/gantt-bars.json'),
  'goal-progress-ring': () => import('../assets/lottie/goal-progress-ring.json'),
  'integration-connect': () => import('../assets/lottie/integration-connect.json'),
  'invoice-check': () => import('../assets/lottie/invoice-check.json'),
  'kanban-flow': () => import('../assets/lottie/kanban-flow.json'),
  'link-share': () => import('../assets/lottie/link-share.json'),
  'loader-spinner': () => import('../assets/lottie/loader-spinner.json'),
  'mini-dashboard': () => import('../assets/lottie/mini-dashboard.json'),
  'notification-toast': () => import('../assets/lottie/notification-toast.json'),
  'priority-flag': () => import('../assets/lottie/priority-flag.json'),
  'sales-funnel': () => import('../assets/lottie/sales-funnel.json'),
  'status-pill-switch': () => import('../assets/lottie/status-pill-switch.json'),
  'success-check': () => import('../assets/lottie/success-check.json'),
  'sync-refresh': () => import('../assets/lottie/sync-refresh.json'),
  'table-rows': () => import('../assets/lottie/table-rows.json'),
  'team-connect': () => import('../assets/lottie/team-connect.json'),
  'timeline-steps': () => import('../assets/lottie/timeline-steps.json'),
  'upload-cloud': () => import('../assets/lottie/upload-cloud.json'),
  'welcome': () => import('../assets/lottie/welcome.json'),
  'workload-bars': () => import('../assets/lottie/workload-bars.json'),
} as const;

export type LottieIconName = keyof typeof REGISTRY;

type Props = {
  name: LottieIconName;
  size?: number;
  loop?: boolean;
  /** false — заморозить на первом кадре вместо проигрывания (например, если анимация заканчивается растворением). */
  autoplay?: boolean;
  /** Ограничить проигрывание (и зацикливание) диапазоном кадров [first, last] — например, чтобы не доходить до финального растворения/затухания. */
  segment?: readonly [number, number];
  className?: string;
};

/** Единая точка входа для всех Lottie-анимаций приложения — по имени, лениво, без раздувания общего бандла. */
export const LottieIcon: React.FC<Props> = ({ name, size = 96, loop = true, autoplay = true, segment, className }) => {
  const [data, setData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    REGISTRY[name]().then((mod) => {
      if (!cancelled) setData(mod.default as object);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  const box = { width: size, height: size };

  if (!data) return <div style={box} className={className} />;

  return (
    <Suspense fallback={<div style={box} className={className} />}>
      <div style={box} className={className}>
        <Lottie src={data} loop={loop} autoplay={autoplay} segment={segment} style={box} />
      </div>
    </Suspense>
  );
};
