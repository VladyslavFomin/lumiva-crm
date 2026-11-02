import React from 'react';
import type { BookingZoneDecor } from '../../api/bookingVerticals';

export const TABLE_SHAPES = ['round', 'square', 'rect', 'booth', 'bar'] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];
export const DECOR_KINDS: BookingZoneDecor['kind'][] = ['wall', 'bar', 'entrance', 'window', 'kitchen', 'plant', 'stage', 'label'];

/** Размер по умолчанию для новой фигуры стола под число мест. */
export function defaultTableSize(shape: TableShape, seats: number): { w: number; h: number } {
  if (shape === 'round') {
    const d = Math.max(60, Math.min(160, 44 + seats * 10));
    return { w: d, h: d };
  }
  if (shape === 'square') return { w: 76, h: 76 };
  if (shape === 'booth') return { w: 110, h: 80 };
  if (shape === 'bar') return { w: 160, h: 44 };
  const len = Math.max(110, Math.min(360, 40 + Math.ceil(seats / 2) * 38));
  return { w: len, h: 72 };
}

/**
 * Координаты стульев вокруг стола (относительно левого верхнего угла стола, без поворота —
 * поворот применяется ко всей группе). Круглый — по окружности; прямоугольный — по длинным
 * сторонам, остаток на торцы; диван — только с одной стороны; барная стойка — вдоль одной стороны.
 */
export function seatPositions(shape: string, w: number, h: number, seats: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const n = Math.max(0, Math.min(40, seats));
  const gap = 10;
  if (!n) return out;
  if (shape === 'round') {
    const r = Math.max(w, h) / 2 + gap;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      out.push({ x: w / 2 + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r });
    }
    return out;
  }
  if (shape === 'bar' || shape === 'booth') {
    for (let i = 0; i < n; i++) out.push({ x: ((i + 0.5) / n) * w, y: shape === 'bar' ? h + gap : -gap });
    return out;
  }
  if (shape === 'square') {
    const sides = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) sides[i % 4]++;
    const place = (count: number, fn: (t: number) => { x: number; y: number }) => {
      for (let i = 0; i < count; i++) out.push(fn((i + 0.5) / count));
    };
    place(sides[0], (t) => ({ x: t * w, y: -gap }));
    place(sides[2], (t) => ({ x: t * w, y: h + gap }));
    place(sides[1], (t) => ({ x: w + gap, y: t * h }));
    place(sides[3], (t) => ({ x: -gap, y: t * h }));
    return out;
  }
  const ends = n > 4 ? Math.min(2, n - 4) : 0;
  const long = n - ends;
  const top = Math.ceil(long / 2);
  const bottom = long - top;
  for (let i = 0; i < top; i++) out.push({ x: ((i + 0.5) / top) * w, y: -gap });
  for (let i = 0; i < bottom; i++) out.push({ x: ((i + 0.5) / bottom) * w, y: h + gap });
  if (ends >= 1) out.push({ x: -gap, y: h / 2 });
  if (ends >= 2) out.push({ x: w + gap, y: h / 2 });
  return out;
}

export const Seats: React.FC<{ shape: string; w: number; h: number; seats: number }> = ({ shape, w, h, seats }) => (
  <>
    {seatPositions(shape, w, h, seats).map((p, i) => (
      <span key={i} className="fl-seat" style={{ left: p.x - 6, top: p.y - 6 }} />
    ))}
  </>
);

export const DecorView: React.FC<{ d: BookingZoneDecor; label?: string }> = ({ d, label }) => (
  <div
    className={`fl-decor ${d.kind}`}
    style={{ left: d.x, top: d.y, width: d.w, height: d.h, transform: d.rotation ? `rotate(${d.rotation}deg)` : undefined }}
  >
    {d.kind !== 'wall' && d.kind !== 'window' && d.kind !== 'plant' ? d.label || label || '' : ''}
  </div>
);
