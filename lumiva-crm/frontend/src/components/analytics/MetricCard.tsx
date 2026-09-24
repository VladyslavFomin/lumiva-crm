import React, { useId, useMemo, useRef, useState } from 'react';

/** Общая карточка блока-метрики для страниц аналитики (Проекты/Workspace, Лиды, Продажи).
 * График — сверху и занимает всё свободное место блока (растёт/сжимается вместе с ним),
 * число — под ним и подгоняет кегль под ширину блока, чтобы не обрезаться на телефоне.
 * При наведении/касании графика внизу (вместо подписи) показывается значение точки мелким шрифтом. */

interface MetricCardProps {
  value: string;
  suffix?: string;
  /** Подпись под числом (период, дельта…) — показывается, пока график не под курсором. */
  caption?: React.ReactNode;
  spark: number[];
  /** Подписи точек графика (например диапазон дат корзины) — для строки при наведении. */
  sparkLabels?: string[];
  color?: string;
  locale?: string;
}

const NUM_W = 0.58; // средняя ширина цифры в em при tracking -0.04em
const MAX_FONT_PX = 40;
const MIN_FONT_PX = 16;

/** Монотонная кубическая интерполяция (Fritsch–Carlson): гладкая линия без «перелётов» за пределы данных. */
function monotonePath(points: Array<[number, number]>): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${points[0][0]},${points[0][1]}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1][0] - points[i][0]);
    slope.push((points[i + 1][1] - points[i][1]) / (dx[i] || 1));
  }
  const tan: number[] = new Array(n);
  tan[0] = slope[0];
  tan[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    tan[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tan[i] = 0;
      tan[i + 1] = 0;
      continue;
    }
    const a = tan[i] / slope[i];
    const b = tan[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      tan[i] = k * a * slope[i];
      tan[i + 1] = k * b * slope[i];
    }
  }
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    d += ` C${points[i][0] + h},${points[i][1] + tan[i] * h} ${points[i + 1][0] - h},${points[i + 1][1] - tan[i + 1] * h} ${points[i + 1][0]},${points[i + 1][1]}`;
  }
  return d;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  value,
  suffix,
  caption,
  spark,
  sparkLabels,
  color = '#222222',
  locale = 'ru-RU',
}) => {
  const gradientId = `mc-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const plotRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const data = spark.length >= 2 ? spark : [spark[0] ?? 0, spark[0] ?? 0];
  const last = data.length - 1;

  const { linePath, areaPath, ys } = useMemo(() => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    // вертикальные отступы, чтобы линия и маркер не прилипали к краям
    const yOf = (v: number) => (range === 0 ? 50 : 90 - ((v - min) / range) * 80);
    const pts: Array<[number, number]> = data.map((v, i) => [(i / last) * 100, yOf(v)]);
    const line = monotonePath(pts);
    return { linePath: line, areaPath: `${line} L100,100 L0,100 Z`, ys: pts.map((p) => p[1]) };
  }, [data, last]);

  const fmt = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);

  const pick = (clientX: number) => {
    const el = plotRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(ratio * last));
  };

  const fontChars = value.length + (suffix ? suffix.length * 0.5 + 0.4 : 0);
  const valueFontSize = `clamp(${MIN_FONT_PX}px, calc(100cqw / ${(fontChars * NUM_W).toFixed(2)}), ${MAX_FONT_PX}px)`;

  const hovered = hoverIndex !== null;
  const hoverLabel = hovered ? sparkLabels?.[hoverIndex] : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2" style={{ containerType: 'inline-size' }}>
      <div
        ref={plotRef}
        className="relative min-h-[20px] flex-1 cursor-crosshair select-none"
        style={{ touchAction: 'pan-y' }}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setHoverIndex(null)}
        onPointerCancel={() => setHoverIndex(null)}
      >
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hovered && (
            <line x1={(hoverIndex / last) * 100} x2={(hoverIndex / last) * 100} y1={0} y2={100} stroke={color} strokeOpacity={0.25} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {hovered && (
          <span
            className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${(hoverIndex / last) * 100}%`, top: `${ys[hoverIndex]}%`, background: color }}
          />
        )}
      </div>

      <div className="min-w-0 leading-none">
        <div
          className="whitespace-nowrap font-semibold tracking-[-0.04em] text-[#222] tabular-nums"
          style={{ fontSize: valueFontSize }}
        >
          {value}
          {suffix && <span className="ml-1.5 text-[0.45em] font-medium tracking-normal text-neutral-400">{suffix}</span>}
        </div>
      </div>

      <div className="min-h-[15px] min-w-0 text-[11px] font-medium leading-[15px] text-neutral-400">
        {hovered ? (
          <span className="block truncate text-[10px] tabular-nums text-neutral-500">
            {hoverLabel ? `${hoverLabel} · ` : ''}
            <span className="font-semibold text-[#222]">{fmt.format(data[hoverIndex])}</span>
          </span>
        ) : (
          caption
        )}
      </div>
    </div>
  );
};
