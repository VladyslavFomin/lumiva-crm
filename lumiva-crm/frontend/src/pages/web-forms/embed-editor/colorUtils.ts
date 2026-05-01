/** Парсинг и запись цветов для редактора embed: #RGB, #RRGGBB, #RRGGBBAA, rgba() */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function clamp255(n: number) {
  return Math.min(255, Math.max(0, Math.round(n)));
}

export function parseColorToRgba(input: string | undefined | null): Rgba {
  const s = String(input || '').trim();
  if (!s) return { r: 17, g: 24, b: 39, a: 1 };
  if (s.startsWith('#')) {
    const h = s.slice(1);
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return { r, g, b, a: 1 };
    }
    if (h.length === 6) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: 1,
      };
    }
    if (h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: parseInt(h.slice(6, 8), 16) / 255,
      };
    }
  }
  const m = s.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );
  if (m) {
    return {
      r: clamp255(Number(m[1])),
      g: clamp255(Number(m[2])),
      b: clamp255(Number(m[3])),
      a: m[4] !== undefined ? clamp01(Number(m[4])) : 1,
    };
  }
  return { r: 17, g: 24, b: 39, a: 1 };
}

export function rgbaToCss(c: Rgba): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

export function rgbaToHex8(c: Rgba): string {
  const to2 = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  const a = Math.round(clamp01(c.a) * 255);
  return `#${to2(c.r)}${to2(c.g)}${to2(c.b)}${a.toString(16).padStart(2, '0')}`;
}

export function rgbaToBestString(c: Rgba): string {
  if (c.a >= 0.999) {
    const to2 = (n: number) => clamp255(n).toString(16).padStart(2, '0');
    return `#${to2(c.r)}${to2(c.g)}${to2(c.b)}`;
  }
  return rgbaToCss(c);
}

/** HSL 0..360, 0..1, 0..1 → RGB 0..255 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const H = ((h % 360) + 360) % 360;
  const S = clamp01(s);
  const L = clamp01(l);
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  let rp = 0,
    gp = 0,
    bp = 0;
  if (H < 60) {
    rp = c;
    gp = x;
  } else if (H < 120) {
    rp = x;
    gp = c;
  } else if (H < 180) {
    gp = c;
    bp = x;
  } else if (H < 240) {
    gp = x;
    bp = c;
  } else if (H < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  return {
    r: clamp255((rp + m) * 255),
    g: clamp255((gp + m) * 255),
    b: clamp255((bp + m) * 255),
  };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === R) h = 60 * (((G - B) / d) % 6);
    else if (max === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
  }
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}
