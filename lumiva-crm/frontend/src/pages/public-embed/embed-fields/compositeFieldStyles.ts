import type React from 'react';

/** Shared inline-style helpers for the composite embed fields (Hotel/Service/Product).
 * Every value is derived from the form's own `design` record so these stay consistent
 * with whatever preset/colors the tenant picked in the builder's "Дизайн" tab. */

export function dnum(d: Record<string, unknown>, k: string, def: number): number {
  const n = Number(d[k]);
  return Number.isFinite(n) ? n : def;
}

export function dstr(d: Record<string, unknown>, k: string, def: string): string {
  const v = d[k];
  return v != null && String(v).trim() !== '' ? String(v) : def;
}

export function compositeTokens(d: Record<string, unknown>) {
  return {
    text: dstr(d, 'textColor', '#111827'),
    field: dstr(d, 'fieldBackground', '#f9fafb'),
    border: dstr(d, 'borderColor', '#e5e7eb'),
    accent: dstr(d, 'accentColor', '#2563eb'),
    radius: dnum(d, 'borderRadiusPx', 8),
    pad: dnum(d, 'fieldPaddingPx', 12),
    labelWeight: dnum(d, 'labelWeight', 600),
  };
}

export function inputStyle(d: Record<string, unknown>): React.CSSProperties {
  const t = compositeTokens(d);
  return {
    width: '100%',
    background: t.field,
    border: `1px solid ${t.border}`,
    color: t.text,
    borderRadius: t.radius,
    padding: t.pad,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    fontSize: 13,
  };
}

export function pillButtonStyle(d: Record<string, unknown>, active: boolean): React.CSSProperties {
  const t = compositeTokens(d);
  return {
    borderRadius: 999,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    border: `1px solid ${active ? t.accent : t.border}`,
    background: active ? t.accent : 'transparent',
    color: active ? '#fff' : t.text,
    cursor: 'pointer',
    transition: 'border-color .15s, background .15s',
    fontFamily: 'inherit',
  };
}

export function primaryButtonStyle(d: Record<string, unknown>, disabled: boolean): React.CSSProperties {
  const t = compositeTokens(d);
  return {
    borderRadius: 999,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    background: t.accent,
    color: '#fff',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  };
}

export function optionCardStyle(d: Record<string, unknown>, selected: boolean): React.CSSProperties {
  const t = compositeTokens(d);
  return {
    textAlign: 'left',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    border: `1.5px solid ${selected ? t.accent : t.border}`,
    borderRadius: t.radius + 4,
    padding: '12px 14px',
    background: selected ? t.field : 'transparent',
    boxShadow: selected ? '0 8px 22px rgba(15,23,42,.07)' : undefined,
    cursor: 'pointer',
    transition: 'border-color .15s, background .15s, box-shadow .15s',
    fontFamily: 'inherit',
  };
}

export function checkMark(d: Record<string, unknown>, selected: boolean): React.CSSProperties {
  const t = compositeTokens(d);
  return {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: `1.5px solid ${selected ? t.accent : t.border}`,
    background: selected ? t.accent : 'transparent',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    flex: '0 0 auto',
  };
}

export function fieldLabelStyle(d: Record<string, unknown>): React.CSSProperties {
  const t = compositeTokens(d);
  return { fontWeight: t.labelWeight, fontSize: 13, marginBottom: 8, color: t.text };
}

export function hintStyle(d: Record<string, unknown>): React.CSSProperties {
  return { fontSize: 12, color: '#94a3b8', marginTop: 6, marginBottom: 6 };
}
