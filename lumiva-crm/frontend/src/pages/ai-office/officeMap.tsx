/* Изометрическая карта ИИ-офиса (порт components/office-map.jsx из Claude Design).
 * Отличие от макета: никакой случайной «жизни». Реплики над столами — реальные события журнала,
 * «прогулки» — реальные передачи задачи от руководителя исполнителю, печатают только агенты с задачей. */
import React, { useEffect, useMemo, useRef, useState } from 'react';

export const U = 20;
const CS = 0.866, SN = 0.5, R = 8, SP = 13, BR = 6;
const OW = 1720, OH = 1180, OX = OW / 2, OY = 590;
export const P = (x: number, y: number, z = 0): [number, number] => [OX + (x - y) * CS * U, OY + (x + y) * SN * U - z * U];
const pts = (a: Array<[number, number]>) => a.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
const hx = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a: string, b: string, t: number) => {
  const A = hx(a), B = hx(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const slotXY = (s: [number, number]): [number, number] => [s[0] * SP - R / 2, s[1] * SP - R / 2];
const HAIR = ['#2b2420', '#5a3b28', '#1f1f22', '#8a5a3a', '#3a2a24', '#6b4a35'];
const SKIN = ['#e9c3a5', '#d8a883', '#f0d0b6', '#b98563', '#e2b896', '#c99572'];

export type MapDept = {
  id: string;
  name: string;
  color: string;
  slot: [number, number];
  agents: Array<{ id: string; title: string; isLead: boolean; busy: boolean }>;
  active: boolean;
};
export type MapIssue = { kind: 'error' | 'data' | 'access'; agentId: string | null; label: string; color: string } | undefined;
export type Bubble = { agentId: string; text: string } | null;
export type WalkerSpec = { key: string; deptId: string; fromAgentId: string; toAgentId: string; text: string };

function Seated({ x, y, i, did, delay, night }: { x: number; y: number; i: number; did: string; delay: number; night: boolean }) {
  const hair = HAIR[i % HAIR.length], skin = SKIN[i % SKIN.length];
  const sk2 = mix(skin, '#5a3020', 0.25), arm = `url(#ofg-${did})`;
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
      <ellipse cx="0" cy="7" rx="8" ry="3" fill="#000" opacity={night ? 0.3 : 0.14} />
      <g className="of-arm" style={{ animationDelay: delay + 's' }}><path d="M-5.2,-3.5 Q-6,-9 -1.5,-12.5" fill="none" stroke={arm} strokeWidth="3.4" strokeLinecap="round" /><circle cx="-1.3" cy="-12.6" r="1.6" fill={skin} /></g>
      <g className="of-arm b" style={{ animationDelay: delay + 0.21 + 's' }}><path d="M5.2,-3.5 Q7.5,-8 8.5,-11" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth="3.6" strokeLinecap="round" /><path d="M5.2,-3.5 Q7.5,-8 8.5,-11" fill="none" stroke={arm} strokeWidth="3.4" strokeLinecap="round" /><circle cx="8.6" cy="-11.2" r="1.6" fill={sk2} /></g>
      <path d="M-7,6.5 C-7.6,-.5 -6.6,-5.6 -3.8,-7.4 Q0,-8.6 3.8,-7.4 C6.6,-5.6 7.6,-.5 7,6.5 Q0,8.6 -7,6.5 Z" fill={`url(#ofg-${did})`} />
      <path d="M-1,-7.9 Q0,-1 -.4,6.8" stroke="#000" strokeOpacity=".12" strokeWidth=".8" fill="none" />
      <ellipse cx="-3.4" cy="-5" rx="2.6" ry="1.2" fill="#fff" opacity=".28" />
      <rect x="-1.7" y="-10.6" width="3.4" height="3.6" rx="1.2" fill={sk2} />
      <circle cx="0" cy="-13.6" r="4.7" fill="url(#ofskin)" style={{ color: skin }} />
      <ellipse cx="-4.5" cy="-13.4" rx="1" ry="1.5" fill={sk2} /><ellipse cx="4.5" cy="-13.4" rx="1" ry="1.5" fill={sk2} />
      <path d="M-4.9,-13.2 C-5.2,-19.4 5.2,-19.4 4.9,-13.2 C4.4,-11 -4.4,-11 -4.9,-13.2 Z" fill={hair} />
      <ellipse cx="-1.8" cy="-16.6" rx="1.8" ry=".9" fill="#fff" opacity=".22" />
    </g>
  );
}

function Standing({ i, did, night, refLegs }: { i: number; did: string; night: boolean; refLegs: React.RefObject<SVGGElement | null> }) {
  const hair = HAIR[i % HAIR.length], skin = SKIN[i % SKIN.length], sk2 = mix(skin, '#5a3020', 0.25);
  return (
    <g>
      <ellipse cx="0" cy="0" rx="6" ry="2.6" fill="#000" opacity={night ? 0.3 : 0.16} />
      <g ref={refLegs} className="of-legs">
        <rect className="l1" x="-3.6" y="-10" width="3" height="10" rx="1.5" fill="#2f3237" />
        <rect className="l2" x=".6" y="-10" width="3" height="10" rx="1.5" fill="#3b3f45" />
        <g className="a1"><rect x="-8" y="-21" width="2.8" height="9.5" rx="1.4" fill={`url(#ofg-${did})`} /><circle cx="-6.6" cy="-11.4" r="1.5" fill={skin} /></g>
        <g className="a2"><rect x="5.2" y="-21" width="2.8" height="9.5" rx="1.4" fill={`url(#ofg-${did})`} /><circle cx="6.6" cy="-11.4" r="1.5" fill={sk2} /></g>
      </g>
      <path d="M-5.6,-9 C-6.2,-15 -5.6,-20 -3,-22 Q0,-23 3,-22 C5.6,-20 6.2,-15 5.6,-9 Q0,-7.6 -5.6,-9 Z" fill={`url(#ofg-${did})`} />
      <ellipse cx="-2.6" cy="-19.6" rx="2" ry="1" fill="#fff" opacity=".28" />
      <rect x="-1.5" y="-24.6" width="3" height="3" rx="1" fill={sk2} />
      <circle cx="0" cy="-28" r="4.6" fill="url(#ofskin)" style={{ color: skin }} />
      <circle cx="-1.6" cy="-27.6" r=".65" fill="#2a2a2a" /><circle cx="1.6" cy="-27.6" r=".65" fill="#2a2a2a" />
      <path d="M-4.7,-28.4 C-5,-34 5,-34 4.7,-28.4 C3.6,-30.6 -3.6,-30.6 -4.7,-28.4 Z" fill={hair} />
      <ellipse cx="-1.6" cy="-31.4" rx="1.6" ry=".8" fill="#fff" opacity=".22" />
    </g>
  );
}

export function FigDefs({ depts }: { depts: Array<{ id: string; color: string }> }) {
  return (
    <>
      <radialGradient id="ofskin" cx=".35" cy=".35" r=".75"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".35" stopColor="currentColor" /><stop offset="1" stopColor="currentColor" stopOpacity=".8" /></radialGradient>
      {depts.map((d) => (
        <linearGradient key={d.id + d.color} id={'ofg-' + d.id} x1="0" y1="0" x2="1" y2=".3">
          <stop offset="0" stopColor={mix(d.color, '#ffffff', 0.12)} /><stop offset=".55" stopColor={mix(d.color, '#3a3a3a', 0.22)} /><stop offset="1" stopColor={mix(d.color, '#1e1e1e', 0.55)} />
        </linearGradient>
      ))}
    </>
  );
}

function Box({ x, y, z, w, d, h, top, left, right, stroke }: { x: number; y: number; z: number; w: number; d: number; h: number; top: string; left: string; right: string; stroke?: string }) {
  const zt = z + h;
  return (
    <g stroke={stroke || 'none'} strokeWidth=".5">
      <polygon points={pts([P(x, y + d, zt), P(x + w, y + d, zt), P(x + w, y + d, z), P(x, y + d, z)])} fill={left} />
      <polygon points={pts([P(x + w, y, zt), P(x + w, y + d, zt), P(x + w, y + d, z), P(x + w, y, z)])} fill={right} />
      <polygon points={pts([P(x, y, zt), P(x + w, y, zt), P(x + w, y + d, zt), P(x, y + d, zt)])} fill={top} />
    </g>
  );
}

/** Реплика: до двух строк (~30 символов), чтобы фразу можно было прочитать целиком. */
function wrap2(text: string, max = 30): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w;
    else if ((cur + ' ' + w).length <= max) lines[lines.length - 1] = cur + ' ' + w;
    else if (lines.length < 2) lines.push(w);
    else {
      lines[1] = (lines[1] + ' ' + w).slice(0, max - 1) + '…';
      break;
    }
  }
  return lines.map((l) => (l.length > max ? l.slice(0, max - 1) + '…' : l));
}

function BubbleG({ x, y, text, c }: { x: number; y: number; text: string; c?: string }) {
  const lines = wrap2(text);
  const w = Math.max(...lines.map((l) => l.length)) * 5.6 + 20, h = 8 + lines.length * 13;
  return (
    <g className="of-bub" transform={`translate(${x - w / 2},${y - h - 8})`}>
      <rect width={w} height={h} rx="9" fill="#fff" stroke={c || '#d8d4cb'} />
      <path d={`M${w / 2 - 5},${h - 0.5} L${w / 2},${h + 6} L${w / 2 + 5},${h - 0.5}`} fill="#fff" stroke={c || '#d8d4cb'} />
      <rect x={w / 2 - 5} y={h - 2} width="10" height="3" fill="#fff" />
      {lines.map((l, i) => (
        <text key={i} x={w / 2} y={14 + i * 13} textAnchor="middle" className="of-bub-t">{l}</text>
      ))}
    </g>
  );
}

function Label({ x, y, text, lead, night }: { x: number; y: number; text: string; lead?: boolean; night: boolean }) {
  const t = text.length > 22 ? text.slice(0, 21) + '…' : text;
  const w = t.length * 5.3 + (lead ? 22 : 14);
  return (
    <g transform={`translate(${x - w / 2},${y - 13})`} className="of-lbl">
      <rect width={w} height="13" rx="6.5" fill={night ? '#2a2e36' : '#fff'} stroke={night ? '#3c424c' : '#d9d5cc'} />
      <text x={w / 2} y="9.3" textAnchor="middle" fill={night ? '#e7e3da' : '#2a2a2a'}>{lead ? '★ ' : ''}{t}</text>
    </g>
  );
}

const deskPos = (d: MapDept, i: number) => {
  const [x0, y0] = slotXY(d.slot), n = d.agents.length, rows = Math.ceil(n / 3);
  const col = i % 3, row = Math.floor(i / 3);
  const dx = x0 + 0.65 + col * 2.5, dy = y0 + (R - rows * 2.7) / 2 + 0.15 + row * 2.7;
  return { dx, dy, ax: dx + 0.85, ay: dy + 1.35 };
};

function Desk({ d, i, night, away, bubble }: { d: MapDept; i: number; night: boolean; away: boolean; bubble: string | null }) {
  const { dx, dy, ax, ay } = deskPos(d, i);
  const a = d.agents[i];
  const working = d.active && a.busy;
  const wood = night ? ['#6d5b48', '#4a3d31', '#58493a'] : ['#d9c2a0', '#b59a74', '#c7ad86'];
  const scr = night ? '#8fe0ff' : working ? '#2b3138' : '#454b52';
  const s0 = P(dx + 0.42, dy + 0.16, 0.5), s1 = P(dx + 1.28, dy + 0.16, 0.5), s2 = P(dx + 1.28, dy + 0.16, 1.0), s3 = P(dx + 0.42, dy + 0.16, 1.0);
  const body = P(ax, ay, 0.78), lbl = P(ax, ay, 2.05);
  const delay = ((i * 37 + d.id.length * 11) % 10) / 10;
  return (
    <g>
      {night && <polygon points={pts([P(dx - 0.3, dy + 0.9), P(dx + 2.1, dy + 0.9), P(dx + 2.4, dy + 2.6), P(dx - 0.6, dy + 2.6)])} fill="#8fe0ff" opacity=".07" />}
      <Box x={dx} y={dy} z={0} w={1.7} d={0.85} h={0.42} top={wood[0]} left={wood[1]} right={wood[2]} />
      <Box x={dx + 0.35} y={dy + 0.08} z={0.42} w={1.0} d={0.08} h={0.64} top="#3a3f46" left="#23272c" right="#30353b" />
      <polygon className={working ? 'of-scr' : undefined} style={{ animationDelay: delay + 's' }} points={pts([s0, s1, s2, s3])} fill={scr} />
      {working &&
        [0.62, 0.74, 0.86].map((z, k) => {
          const p1 = P(dx + 0.5, dy + 0.16, z), p2 = P(dx + 0.5 + [0.65, 0.45, 0.55][k], dy + 0.16, z);
          return <line key={k} className="of-ln" style={{ animationDelay: delay + k * 0.4 + 's' }} pathLength={1} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={night ? '#0e3a4d' : '#8fb3c9'} strokeWidth="1.1" />;
        })}
      <Box x={ax - 0.32} y={ay - 0.25} z={0} w={0.64} d={0.55} h={0.32} top="#4a4f57" left="#33373d" right="#3d4249" />
      {!away && (
        <g className={working ? 'of-typer' : 'of-idle'} style={{ animationDelay: delay + 's' }}>
          <Seated x={body[0]} y={body[1] + 1} i={i} did={d.id} delay={delay} night={night} />
        </g>
      )}
      {bubble ? <BubbleG x={lbl[0]} y={lbl[1] - 2} text={bubble} c={d.color} /> : <Label x={lbl[0]} y={lbl[1]} text={a.title} lead={a.isLead} night={night} />}
    </g>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  const a = P(x, y, 0.9), b = P(x + 0.15, y - 0.1, 1.25);
  return (
    <g>
      <Box x={x - 0.25} y={y - 0.25} z={0} w={0.5} d={0.5} h={0.45} top="#8a6a4f" left="#6b513c" right="#7a5d45" />
      <circle cx={a[0]} cy={a[1]} r="7" fill="#5b8a52" /><circle cx={b[0] - 3} cy={b[1]} r="5" fill="#6fa363" /><circle cx={b[0] + 4} cy={b[1] + 2} r="4.5" fill="#4c7a45" />
    </g>
  );
}

function Room({ d, night, sel, hov, away, bubble, onPick, onHover, issue }: {
  d: MapDept; night: boolean; sel: boolean; hov: boolean; away: Set<string>; bubble: Bubble; onPick: (id: string) => void; onHover: (id: string | null) => void; issue: MapIssue;
}) {
  const [x0, y0] = slotXY(d.slot);
  const floor = night ? mix(d.color, '#1d2027', 0.62) : mix(d.color, '#f4efe6', 0.55);
  const side = night ? ['#2c2f35', '#363940'] : ['#cfc5b4', '#ddd4c4'];
  const sh: Array<[number, number]> = [P(x0 + 1, y0 + 1.6, -1.6), P(x0 + R + 1, y0 + 1.6, -1.6), P(x0 + R + 1, y0 + R + 1.6, -1.6), P(x0 + 1, y0 + R + 1.6, -1.6)];
  return (
    <g className={'of-room' + (sel ? ' sel' : '') + (d.active ? '' : ' paused')} onClick={() => onPick(d.id)} onMouseEnter={() => onHover(d.id)} onMouseLeave={() => onHover(null)}>
      <polygon points={pts(sh)} fill="#000" opacity={night ? 0.35 : 0.08} filter="url(#ofBlur)" />
      <Box x={x0} y={y0} z={-0.6} w={R} d={R} h={0.6} top={floor} left={side[0]} right={side[1]} />
      {(sel || hov) && <polygon points={pts([P(x0, y0), P(x0 + R, y0), P(x0 + R, y0 + R), P(x0, y0 + R)])} fill="none" stroke={mix(d.color, '#000', 0.25)} strokeWidth={sel ? 2 : 1.2} strokeDasharray={sel ? undefined : '4 3'} />}
      <Plant x={x0 + R - 0.6} y={y0 + 0.6} />
      {issue && <polygon className="of-alert-floor" points={pts([P(x0, y0), P(x0 + R, y0), P(x0 + R, y0 + R), P(x0, y0 + R)])} fill={issue.color} fillOpacity=".07" stroke={issue.color} strokeWidth="1.4" strokeDasharray="6 4" />}
      {d.agents.map((a, i) => (
        <Desk
          key={a.id}
          d={d}
          i={i}
          night={night}
          away={away.has(a.id)}
          bubble={bubble && bubble.agentId === a.id ? bubble.text : issue && issue.agentId === a.id ? '⚠ ' + issue.label : null}
        />
      ))}
      <Plant x={x0 + 0.6} y={y0 + R - 0.6} />
      {issue &&
        (() => {
          const p = P(x0 + R / 2, y0 + R / 2, 4.6);
          return (
            <g transform={`translate(${p[0]},${p[1]})`}>
              <g className="of-pin">
                <circle className="ring" r="13" fill="none" stroke={issue.color} strokeWidth="2" />
                <circle r="11" fill={issue.color} />
                <text y="4.5" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">!</text>
                <line x1="0" y1="11" x2="0" y2="34" stroke={issue.color} strokeWidth="1.5" strokeDasharray="2 2" />
              </g>
            </g>
          );
        })()}
    </g>
  );
}

function Walkways({ night }: { night: boolean }) {
  const out: React.ReactNode[] = [];
  const top = night ? '#3a3d44' : '#e2d9c9', l = night ? '#2a2c31' : '#c8bda9', r = night ? '#303237' : '#d3c8b4';
  const half = (c: number, rr: number) => (c === 0 && rr === 0 ? BR / 2 : R / 2);
  for (let c = -1; c <= 1; c++)
    for (let rr = -1; rr <= 1; rr++) {
      if (c < 1) {
        const a = c * SP + half(c, rr), b = (c + 1) * SP - half(c + 1, rr);
        out.push(<Box key={'h' + c + rr} x={a} y={rr * SP - 1.3} z={-0.5} w={b - a} d={2.6} h={0.35} top={top} left={l} right={r} />);
      }
      if (rr < 1) {
        const a = rr * SP + half(c, rr), b = (rr + 1) * SP - half(c, rr + 1);
        out.push(<Box key={'v' + c + rr} x={c * SP - 1.3} y={a} z={-0.5} w={2.6} d={b - a} h={0.35} top={top} left={l} right={r} />);
      }
    }
  return <g>{out}</g>;
}

function Brain({ night, label }: { night: boolean; label: string }) {
  const nodes = useMemo(() => Array.from({ length: 16 }, (_, i) => [((i * 53) % 47) / 47 * 4.6 - 2.3, ((i * 29) % 41) / 41 * 4.6 - 2.3]), []);
  const edges = useMemo(() => {
    const e: Array<[number, number]> = [];
    nodes.forEach((a, i) => {
      const s = nodes.map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2] as [number, number]).filter((x) => x[0] !== i).sort((p, q) => p[1] - q[1]);
      e.push([i, s[0][0]], [i, s[1][0]]);
    });
    return e;
  }, [nodes]);
  const c = night ? '#7fd4c0' : '#2f8f7a';
  const lp = P(0, 0, 2.6);
  return (
    <g>
      <Box x={-BR / 2} y={-BR / 2} z={-0.6} w={BR} d={BR} h={0.6} top={night ? '#2a3034' : '#ece6da'} left={night ? '#24282c' : '#cfc5b4'} right={night ? '#2c3135' : '#ddd4c4'} />
      {edges.map(([a, b], k) => {
        const A = P(nodes[a][0], nodes[a][1], 0.05), B = P(nodes[b][0], nodes[b][1], 0.05);
        return <line key={k} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={c} strokeWidth=".7" opacity=".45" />;
      })}
      {nodes.map((n, k) => {
        const A = P(n[0], n[1], 0.05);
        return <circle key={k} className="of-node" style={{ animationDelay: (k % 7) * 0.35 + 's' }} cx={A[0]} cy={A[1]} r={k % 5 ? 2 : 3.2} fill={c} />;
      })}
      <Label x={lp[0]} y={lp[1]} text={label} night={night} />
    </g>
  );
}

function EmptySlot({ night, slot }: { night: boolean; slot: [number, number] }) {
  const [x0, y0] = slotXY(slot);
  return <polygon points={pts([P(x0, y0, -0.3), P(x0 + R, y0, -0.3), P(x0 + R, y0 + R, -0.3), P(x0, y0 + R, -0.3)])} fill={night ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.35)'} stroke={night ? '#4a4f58' : '#bdb3a2'} strokeWidth="1.2" strokeDasharray="6 5" />;
}

export type PacketItem = { k: string; d: string; c: string; w?: number; on: boolean; hi?: boolean; draw?: boolean; dur: number; off: number; rev?: boolean; r: number; moving?: boolean };

/** Пакеты бегут по нарисованным путям; если moving=false — линия есть, движения нет (отдел стоит). */
export function Packets({ items }: { items: PacketItem[] }) {
  const pr = useRef<Array<SVGPathElement | null>>([]), cr = useRef<Array<SVGCircleElement | null>>([]), it = useRef(items);
  it.current = items;
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0, last = 0;
    const t0 = performance.now(), lens = new Map<string, number>();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 33 || document.hidden) return;
      last = now;
      it.current.forEach((p, i) => {
        const pe = pr.current[i], ce = cr.current[i];
        if (!pe || !ce) return;
        if (p.moving === false) {
          ce.setAttribute('opacity', '0');
          return;
        }
        let L = lens.get(p.d);
        if (L === undefined) {
          if (lens.size > 600) lens.clear();
          L = pe.getTotalLength();
          lens.set(p.d, L);
        }
        if (!L) return;
        let k = ((now - t0) / 1000 / p.dur + p.off) % 1;
        if (p.rev) k = 1 - k;
        const pt = pe.getPointAtLength(k * L);
        ce.setAttribute('cx', pt.x.toFixed(1));
        ce.setAttribute('cy', pt.y.toFixed(1));
        const edge = Math.min(k, 1 - k) < 0.03 ? 0 : 1;
        ce.setAttribute('opacity', String((p.on ? 1 : 0.15) * edge));
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <g>
      {items.map((p, i) => (
        <g key={p.k}>
          {p.draw && <path d={p.d} fill="none" stroke={p.c} strokeWidth={p.w} strokeDasharray="3 4" opacity={p.on ? (p.hi ? 0.75 : 0.42) : 0.08} />}
          <path ref={(el) => { pr.current[i] = el; }} d={p.d} fill="none" stroke="none" />
          <circle ref={(el) => { cr.current[i] = el; }} r={p.r} fill={p.c} opacity="0" />
        </g>
      ))}
    </g>
  );
}

function BrainLinks({ depts, hl }: { depts: MapDept[]; hl: string | null }) {
  const items = depts.map((d, di) => {
    const [x0, y0] = slotXY(d.slot), a = P(x0 + R / 2, y0 + R / 2, 0.1), b = P(0, 0, 0.1);
    return {
      k: d.id + 'br', d: `M${a[0]},${a[1]} L${b[0]},${b[1]}`, c: mix(d.color, '#000', 0.3), on: !hl || hl === d.id,
      dur: (4 + di * 0.5) * (d.agents.some((x) => x.busy) ? 1 : 2.2), off: (di * 0.17) % 1, r: 2.6, moving: d.active,
    };
  });
  return <Packets items={items} />;
}

function Walker({ w, d, night, onDone }: { w: WalkerSpec; d: MapDept; night: boolean; onDone: (k: string) => void }) {
  const g = useRef<SVGGElement>(null), legs = useRef<SVGGElement>(null);
  const [stay, setStay] = useState(false);
  const iFrom = d.agents.findIndex((a) => a.id === w.fromAgentId), iTo = d.agents.findIndex((a) => a.id === w.toAgentId);
  useEffect(() => {
    if (iFrom < 0 || iTo < 0) {
      onDone(w.key);
      return;
    }
    // маршрут по проходам, а не сквозь столы: встать → в проход за своим рядом → вдоль прохода к промежутку
    // справа от стола коллеги → по этому промежутку (между колонками столов свободно) к коллеге
    const A = deskPos(d, iFrom), B = deskPos(d, iTo);
    // встаёт сбоку от стола коллеги (в промежутке между колонками), а не перед ним — не загораживает
    const aisle = A.ay + 0.8, gapX = B.ax + 1.0;
    const path: Array<[number, number]> = [[A.ax, A.ay + 0.55], [A.ax, aisle], [gapX, aisle], [gapX, B.ay - 0.2]];
    const segs = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
    const total = segs.reduce((x, y) => x + y, 0) || 1;
    const at = (k: number): [number, number] => {
      let dist = k * total;
      for (let i = 0; i < segs.length; i++) {
        if (dist <= segs[i] || i === segs.length - 1) {
          const f = segs[i] ? Math.min(1, dist / segs[i]) : 1;
          return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f];
        }
        dist -= segs[i];
      }
      return path[path.length - 1];
    };
    // спокойный шаг: скорость постоянная, без рывков «разгон-торможение» на всём пути
    const D = 600 + total * 650, HOLD = 3400;
    let raf = 0, ph = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = now - t0;
      let k: number, moving = true;
      if (t < D) k = t / D;
      else if (t < D + HOLD) {
        k = 1;
        moving = false;
        if (ph === 0) { ph = 1; setStay(true); }
      } else if (t < 2 * D + HOLD) {
        k = 1 - (t - D - HOLD) / D;
        if (ph === 1) { ph = 2; setStay(false); }
      } else {
        onDone(w.key);
        return;
      }
      const [px, py] = at(k);
      const [sx, sy] = P(px, py, 0);
      const bob = moving ? -Math.abs(Math.sin(t / 90)) * 1.6 : 0;
      if (g.current) {
        g.current.setAttribute('transform', `translate(${sx.toFixed(1)},${(sy + bob).toFixed(1)})`);
        g.current.setAttribute('opacity', '1');
      }
      legs.current?.classList.toggle('walk', moving);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (iFrom < 0) return null;
  return (
    <g ref={g} opacity="0">
      <Standing i={iFrom} did={d.id} night={night} refLegs={legs} />
      {stay && <BubbleG x={0} y={-36} text={w.text} c={d.color} />}
    </g>
  );
}

export const OF_WORLD = { W: OW, H: OH, cx: OX, cy: OY, a: R * CS * U, b: R * SN * U };
export const slotCenter = (slot: [number, number]) => {
  const [x0, y0] = slotXY(slot);
  return P(x0 + R / 2, y0 + R / 2, 0);
};

export function OfficeMap({ depts, emptySlots, night, sel, onPick, hl, brainLabel, bubbles, walkers, onWalkerDone, issues }: {
  depts: MapDept[];
  emptySlots: Array<[number, number]>;
  night: boolean;
  sel: string | null;
  onPick: (id: string) => void;
  hl: string | null;
  brainLabel: string;
  bubbles: Record<string, Bubble>;
  walkers: WalkerSpec[];
  onWalkerDone: (k: string) => void;
  issues: Record<string, MapIssue>;
}) {
  const [hov, setHov] = useState<string | null>(null);
  const order = [...depts].sort((a, b) => a.slot[0] + a.slot[1] - (b.slot[0] + b.slot[1]));
  const awayFor = (id: string) => new Set(walkers.filter((w) => w.deptId === id).map((w) => w.fromAgentId));
  const room = (d: MapDept) => (
    <Room key={d.id} d={d} night={night} sel={sel === d.id} hov={hov === d.id} away={awayFor(d.id)} bubble={bubbles[d.id] ?? null} onPick={onPick} onHover={setHov} issue={issues[d.id]} />
  );
  return (
    <svg className="of-svg" width={OW} height={OH} viewBox={`0 0 ${OW} ${OH}`} style={{ overflow: 'visible' }}>
      <defs>
        <filter id="ofBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9" /></filter>
        <FigDefs depts={depts} />
        <filter id="ofWhite"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" /></filter>
      </defs>
      <Walkways night={night} />
      {emptySlots.map((s) => <EmptySlot key={s.join(',')} night={night} slot={s} />)}
      {order.filter((d) => d.slot[0] + d.slot[1] < 0).map(room)}
      <Brain night={night} label={brainLabel} />
      {order.filter((d) => d.slot[0] + d.slot[1] >= 0).map(room)}
      <BrainLinks depts={depts} hl={hl || hov || sel} />
      {walkers.map((w) => {
        const d = depts.find((x) => x.id === w.deptId);
        return d ? <Walker key={w.key} w={w} d={d} night={night} onDone={onWalkerDone} /> : null;
      })}
    </svg>
  );
}

/** Одна комната крупно (страница отдела, превью в редакторе). */
export function RoomScene({ d, night, bubble, walkers, onWalkerDone, issue }: {
  d: MapDept; night: boolean; bubble?: Bubble; walkers?: WalkerSpec[]; onWalkerDone?: (k: string) => void; issue?: MapIssue;
}) {
  const scoped: MapDept = { ...d, slot: [-1, -1] };
  const [x0, y0] = slotXY(scoped.slot);
  const A = P(x0, y0 + R, 3), B = P(x0 + R, y0, 3), T = P(x0, y0, 3), Bo = P(x0 + R, y0 + R, -1.4);
  const vb = [A[0] - 14, T[1] - 30, B[0] - A[0] + 28, Bo[1] - T[1] + 50];
  const ws = (walkers ?? []).filter((w) => w.deptId === d.id);
  return (
    <svg className="of-svg" viewBox={vb.join(' ')} width="100%" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <filter id="ofBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9" /></filter>
        <FigDefs depts={[scoped]} />
      </defs>
      <Room d={scoped} night={night} sel={false} hov={false} away={new Set(ws.map((w) => w.fromAgentId))} bubble={bubble ?? null} onPick={() => undefined} onHover={() => undefined} issue={issue} />
      {ws.map((w) => <Walker key={w.key} w={w} d={scoped} night={night} onDone={onWalkerDone ?? (() => undefined)} />)}
    </svg>
  );
}

/**
 * Жизнь офиса как в дизайне: сотрудники переговариваются и ходят к коллегам. Тексты — не выдумка:
 * `say` отдаёт для агента его реальное состояние (текущая задача, шаг, последнее событие журнала).
 * Отдел на паузе не «живёт». Реальные передачи задач приходят отдельно (walkers из событий).
 */
export function useAmbientLife(depts: MapDept[], say: (deptId: string, agentId: string) => string | null, everyMs = 3800) {
  const [bubbles, setBubbles] = useState<Record<string, Bubble>>({});
  const [walkers, setWalkers] = useState<WalkerSpec[]>([]);
  const ref = useRef({ depts, say, walkers });
  ref.current = { depts, say, walkers };
  // по очереди: отделы по кругу, внутри отдела — следующий сотрудник; одна реплика на экране за раз
  const turn = useRef({ dept: 0, agent: {} as Record<string, number>, n: 0 });
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const { depts: ds, say: sayFn, walkers: ws } = ref.current;
      const pool = ds.filter((d) => d.active && d.agents.length >= 2);
      if (!pool.length) return;
      // пока кто-то идёт к коллеге и говорит — остальные молчат (одна реплика на экране)
      if (ws.length) return;
      const tr = turn.current;
      const d = pool[tr.dept++ % pool.length];
      const away = new Set(ws.filter((w) => w.deptId === d.id).map((w) => w.fromAgentId));
      const free = d.agents.filter((a) => !away.has(a.id));
      if (free.length < 2) return;
      const a = free[(tr.agent[d.id] = ((tr.agent[d.id] ?? -1) + 1)) % free.length];
      const text = sayFn(d.id, a.id);
      if (!text) return;
      tr.n++;
      // каждый четвёртый ход — сходить к соседу по ряду (никто больше в это время не ходит)
      if (tr.n % 4 === 0 && ws.length === 0) {
        const to = free[(free.indexOf(a) + 1) % free.length];
        setBubbles({});
        setWalkers((w) => [...w, { key: `amb-${Date.now()}`, deptId: d.id, fromAgentId: a.id, toAgentId: to.id, text }]);
        return;
      }
      setBubbles({ [d.id]: { agentId: a.id, text } });
      window.setTimeout(() => setBubbles((b) => (b[d.id]?.agentId === a.id && b[d.id]?.text === text ? {} : b)), everyMs - 400);
    }, everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  const done = (k: string) => setWalkers((w) => w.filter((x) => x.key !== k));
  return { bubbles, walkers, done };
}
