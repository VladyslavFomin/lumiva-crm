import React, { useRef } from 'react';
import { hslToRgb, parseColorToRgba, rgbToHsl, rgbaToBestString } from './colorUtils';

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
};

const WHEEL = 108;

function clampA(a: number) {
  return Math.min(1, Math.max(0, a));
}

export const EmbedColorField: React.FC<Props> = ({ label, value, onChange }) => {
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef(false);
  const base = parseColorToRgba(value);
  const hsl = rgbToHsl(base.r, base.g, base.b);
  const { h: hue, s: sat, l: light } = hsl;

  const setRgba = (r: number, g: number, b: number, a: number) => {
    onChange(rgbaToBestString({ r, g, b, a: clampA(a) }));
  };

  const pickHue = (clientX: number, clientY: number) => {
    const el = wheelRef.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const dx = clientX - (b.left + b.width / 2);
    const dy = clientY - (b.top + b.height / 2);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const h = (ang + 90 + 360) % 360;
    const cur = parseColorToRgba(value);
    const { s, l } = rgbToHsl(cur.r, cur.g, cur.b);
    const { r, g, b: bl } = hslToRgb(h, s, l);
    setRgba(r, g, bl, cur.a);
  };

  const wheelBg = `conic-gradient(
    hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%),
    hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%)
  )`;

  return (
    <div className="lv-embed-color-field">
      <span className="lv-embed-color-field__label">{label}</span>
      <div className="lv-embed-color-field__row">
        <div className="lv-embed-color-field__wheel-wrap">
          <div
            ref={wheelRef}
            className="lv-embed-color-field__wheel"
            style={{ background: wheelBg }}
            onPointerDown={(e) => {
              drag.current = true;
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              pickHue(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              drag.current = false;
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              pickHue(e.clientX, e.clientY);
            }}
            onPointerCancel={() => {
              drag.current = false;
            }}
          />
          <div
            className="lv-embed-color-field__knob"
            style={knobAtHue(hue, WHEEL)}
            aria-hidden
          />
        </div>
        <div className="lv-embed-color-field__sliders">
          <label className="lv-embed-color-field__sl">
            <span>S</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(sat * 100)}
              onChange={(e) => {
                const t = parseColorToRgba(value);
                const { h, l } = rgbToHsl(t.r, t.g, t.b);
                const S = Number(e.target.value) / 100;
                const { r, g, b } = hslToRgb(h, S, l);
                setRgba(r, g, b, t.a);
              }}
            />
          </label>
          <label className="lv-embed-color-field__sl">
            <span>L</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(light * 100)}
              onChange={(e) => {
                const t = parseColorToRgba(value);
                const { h, s } = rgbToHsl(t.r, t.g, t.b);
                const L = Number(e.target.value) / 100;
                const { r, g, b } = hslToRgb(h, s, L);
                setRgba(r, g, b, t.a);
              }}
            />
          </label>
          <label className="lv-embed-color-field__sl">
            <span>α</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(base.a * 100)}
              onChange={(e) => {
                const t = parseColorToRgba(value);
                setRgba(t.r, t.g, t.b, Number(e.target.value) / 100);
              }}
            />
          </label>
        </div>
        <div
          className="lv-embed-color-field__swatch"
          style={{
            background: rgbaToBestString({ ...hslToRgb(hue, sat, light), a: base.a }),
          }}
        />
      </div>
      <input
        type="text"
        className="lv-embed-color-field__hex"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
};

function knobAtHue(deg: number, size: number) {
  const r = (size / 2) * 0.8;
  const rad = ((deg - 90) * Math.PI) / 180;
  const x = r * Math.cos(rad) + size / 2;
  const y = r * Math.sin(rad) + size / 2;
  return { left: x - 5, top: y - 5 } as React.CSSProperties;
}
