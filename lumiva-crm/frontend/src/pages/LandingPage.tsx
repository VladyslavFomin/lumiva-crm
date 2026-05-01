// src/pages/LandingPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { login, resendSignupCode, signup, verifySignupCode } from "../api/client";
import { persistSession } from "../auth/session";
import { PublicHeader } from "../components/public/PublicHeader";
import { PublicFooter } from "../components/public/PublicFooter";

/* ─── DESIGN TOKENS ─────────────────────────────────────────────── */
const FF = "'Inter Tight','Helvetica Neue',Helvetica,Arial,sans-serif";
const FM = "'JetBrains Mono',ui-monospace,monospace";
const INK = "#222";
const FG2 = "#555";
const FG3 = "#888";
const FG4 = "#b5b5b5";
const LINE = "#e7e7e7";
const LINE3 = "#f0f0f0";
const BG_MUTED = "#fafafa";
const BG_SOFT = "#f5f5f5";

/* ─── ICON ───────────────────────────────────────────────────────── */
const Icon: React.FC<{ name: string; size?: number; stroke?: number }> = ({
  name, size = 20, stroke = 1.5,
}) => {
  const p: Record<string, React.ReactNode> = {
    arrow:  <path d="M5 12h14M13 5l7 7-7 7" />,
    play:   <path d="M6 4l14 8-14 8V4z" />,
    funnel: <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z" />,
    pipe:   <><rect x="3" y="4" width="4" height="16"/><rect x="10" y="4" width="4" height="16"/><rect x="17" y="4" width="4" height="16"/></>,
    mail:   <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>,
    users:  <><circle cx="9" cy="8" r="4"/><path d="M1 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/><path d="M16 3.5a4 4 0 010 7.5M23 21c0-3-1.5-5.5-4-7"/></>,
    chart:  <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
    bolt:   <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
    grid:   <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    code:   <path d="M8 6l-6 6 6 6M16 6l6 6-6 6M14 4l-4 16" />,
    shield: <path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3z" />,
    user:   <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    filter: <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/>,
    bell:   <><path d="M18 16V11a6 6 0 00-12 0v5l-2 3h16l-2-3z"/><path d="M10 21a2 2 0 004 0"/></>,
    check:  <path d="M5 12l5 5L20 7" />,
    chev:   <path d="M6 9l6 6 6-6" />,
    globe:  <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[name]}
    </svg>
  );
};

/* ─── KICKER ─────────────────────────────────────────────────────── */
const Kicker: React.FC<{ children: React.ReactNode; light?: boolean }> = ({ children, light }) => (
  <div style={{ fontFamily: FM, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
    color: light ? "rgba(255,255,255,0.55)" : FG3, display: "inline-flex", alignItems: "center", gap: 8 }}>
    <span style={{ width: 6, height: 6, borderRadius: "50%", background: light ? "#fff" : INK, flexShrink: 0 }} />
    {children}
  </div>
);

/* ─── FEATURE CELL (spotlight + glass shadow hover) ─────────────── */
const FeatureCell: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = "" }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const handleMouseMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`group relative overflow-hidden bg-white min-h-[200px] sm:min-h-[220px] p-6 sm:p-7 md:p-8 ${className}`}
      style={{ "--x": `${pos.x}%`, "--y": `${pos.y}%`, borderRight: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` } as React.CSSProperties}
      whileHover={{ backgroundColor: BG_MUTED, boxShadow: "0 22px 55px rgba(0,0,0,0.10)", zIndex: 1, position: "relative" }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: "radial-gradient(380px circle at var(--x) var(--y), rgba(0,0,0,0.04), transparent 60%)" }} />
      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </motion.div>
  );
};

/* ─── SPOTLIGHT CARD (general glass hover) ──────────────────────── */
const SpotlightCard: React.FC<React.PropsWithChildren<{
  className?: string;
  style?: React.CSSProperties;
  light?: boolean;
}>> = ({ children, className = "", style = {}, light = false }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const handleMouseMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={"group relative overflow-hidden " + className}
      style={{ "--x": `${pos.x}%`, "--y": `${pos.y}%`, ...style } as React.CSSProperties}
      whileHover={{ boxShadow: "0 22px 55px rgba(0,0,0,0.10)", zIndex: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: light
          ? "radial-gradient(400px circle at var(--x) var(--y), rgba(255,255,255,0.08), transparent 60%)"
          : "radial-gradient(400px circle at var(--x) var(--y), rgba(0,0,0,0.04), transparent 60%)" }} />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
};

/* ─── LIVE LEADS FEED ────────────────────────────────────────────── */
const LEAD_POOL = [
  { name: "Анна К.", src: "Instagram Ads", val: "85 000 ₽" },
  { name: "Максим Д.", src: "Google Search", val: "120 000 ₽" },
  { name: "Elena R.", src: "Форма сайта", val: "42 500 ₽" },
  { name: "Ozan B.", src: "Telegram Bot", val: "310 000 ₽" },
  { name: "ООО «Север»", src: "LinkedIn", val: "1 240 000 ₽" },
  { name: "Виктор П.", src: "TikTok Ads", val: "64 000 ₽" },
  { name: "Ирина Б.", src: "Реферал", val: "98 000 ₽" },
  { name: "ИП Захаров", src: "Холодный звонок", val: "218 000 ₽" },
  { name: "Светлана М.", src: "Webinar", val: "72 000 ₽" },
];

const LiveLeadsFeed: React.FC = () => {
  const [items, setItems] = useState(() =>
    LEAD_POOL.slice(0, 5).map((l, i) => ({ ...l, id: i, fresh: false }))
  );
  const idRef = useRef(5);
  useEffect(() => {
    const t = setInterval(() => {
      const pick = LEAD_POOL[Math.floor(Math.random() * LEAD_POOL.length)];
      setItems(prev =>
        [{ ...pick, id: idRef.current++, fresh: true }, ...prev.map(p => ({ ...p, fresh: false }))].slice(0, 5)
      );
    }, 3200);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: FG3 }}>LIVE · LEADS</div>
          <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 500, marginTop: 4, color: INK }}>Поток лидов</div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FM, fontSize: 10,
          letterSpacing: "0.1em", color: INK, border: `1px solid ${LINE}`, padding: "3px 8px", borderRadius: 999, background: "#fff" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4a3a",
            animation: "lv-pulse 1.6s ease-in-out infinite" }} />
          LIVE
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(it => (
          <motion.div
            key={it.id}
            initial={it.fresh ? { x: -10, opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0",
              borderBottom: `1px solid ${LINE3}`, background: it.fresh ? BG_SOFT : "transparent" }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: INK, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: INK }}>{it.name}</div>
              <div style={{ fontFamily: FM, fontSize: 9.5, color: FG3, marginTop: 1 }}>{it.src}</div>
            </div>
            <div style={{ fontFamily: FM, fontSize: 11.5, color: INK, fontWeight: 500 }} className="shrink-0 text-right max-[380px]:text-[10px]">{it.val}</div>
          </motion.div>
        ))}
      </div>
      <style>{`@keyframes lv-pulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
    </div>
  );
};

/* ─── MINI PIPELINE ──────────────────────────────────────────────── */
type PipeCard = { n: string; v: string; hot?: boolean; won?: boolean };
const PIPE_COLS: { name: string; cnt: number; cards: PipeCard[] }[] = [
  { name: "NEW",  cnt: 12, cards: [{ n: "Анна К.", v: "85k" }, { n: "Максим Д.", v: "120k" }] },
  { name: "QUAL", cnt: 8,  cards: [{ n: "Elena R.", v: "42k" }, { n: "Виктор П.", v: "64k", hot: true }] },
  { name: "PROP", cnt: 5,  cards: [{ n: "Ozan B.", v: "310k", hot: true }] },
  { name: "WON",  cnt: 3,  cards: [{ n: "ИП Захаров", v: "218k", won: true }] },
];

const MiniPipeline: React.FC = () => (
  <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
      <div>
        <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: FG3 }}>PIPELINE · Q4</div>
        <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 500, marginTop: 4, color: INK }}>Продажи</div>
      </div>
      <div style={{ fontFamily: FM, fontSize: 10, color: FG3 }}>28 сделок</div>
    </div>
    <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
      {PIPE_COLS.map((col, ci) => (
        <div key={col.name} style={{ background: BG_SOFT, borderRadius: 8, padding: "10px 8px", minHeight: 100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: 10, color: FG2, paddingBottom: 8, borderBottom: `1px dashed ${LINE}`, marginBottom: 8, fontWeight: 500 }}>
            <span style={{ fontFamily: FM }}>{col.name}</span>
            <span>{col.cnt}</span>
          </div>
          {col.cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ci * 0.12 + i * 0.08, duration: 0.4 }}
              style={{
                background: card.won ? INK : "#fff",
                border: `1px solid ${card.hot ? INK : card.won ? INK : LINE}`,
                borderRadius: 6, padding: 7, marginBottom: 5,
                color: card.won ? "#fff" : INK,
              }}
            >
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%",
                  background: card.won ? "rgba(255,255,255,0.15)" : BG_SOFT,
                  border: `1px solid ${card.won ? "rgba(255,255,255,0.2)" : LINE}`,
                  fontSize: 8.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center",
                  color: card.won ? "#fff" : FG2 }}>
                  {card.n.split(" ").map(x => x[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.n}</div>
                  <div style={{ fontFamily: FM, fontSize: 9, color: card.won ? "rgba(255,255,255,0.6)" : FG3, marginTop: 1 }}>{card.v}</div>
                </div>
              </div>
              {card.hot && <div style={{ fontSize: 9.5, color: INK, marginTop: 4, fontWeight: 500 }}>● HOT</div>}
              {card.won && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.8)", marginTop: 4, fontWeight: 500 }}>✓ CLOSED</div>}
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

/* ─── SPARKLINE ──────────────────────────────────────────────────── */
const SparkLine: React.FC<{ data: number[]; width?: number; height?: number }> = ({
  data, width = 300, height = 80,
}) => {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / (max - min)) * height * 0.85 - 4;
    return `${x},${y}`;
  });
  const area = `0,${height} ${pts.join(" ")} ${width},${height}`;
  const last = pts[pts.length - 1].split(",");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible", width: "100%" }}>
      <polygon points={area} fill={INK} opacity="0.05" />
      <polyline points={pts.join(" ")} fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={INK} />
    </svg>
  );
};

/* ─── AUTOMATION FLOW ────────────────────────────────────────────── */
const AUTO_STEPS = [
  { label: "Лид",    sub: "Источник: ВК", ic: "user" },
  { label: "Скоринг", sub: "Score: 84",   ic: "target" },
  { label: "Сегмент", sub: "Hot B2B",     ic: "filter" },
  { label: "Канал",   sub: "Email + TG",  ic: "mail" },
  { label: "Задача",  sub: "Звонок",      ic: "bell" },
];

const AutomationFlow: React.FC = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % AUTO_STEPS.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <SpotlightCard style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: FG3 }}>AUTOMATION · PLAYBOOK</div>
          <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 500, marginTop: 4, color: INK }}>Сценарий «Новый лид B2B»</div>
        </div>
        <div style={{ fontFamily: FM, fontSize: 10, color: "#22c55e" }}>● ACTIVE</div>
      </div>
      <svg viewBox="0 0 500 80" style={{ width: "100%", height: 80 }}>
        <line x1="30" y1="40" x2="470" y2="40" stroke={LINE} strokeWidth="1" strokeDasharray="3 3" />
        {AUTO_STEPS.map((s, i) => {
          const x = 30 + i * 110;
          const active = step >= i;
          return (
            <g key={i}>
              <motion.circle cx={x} cy={40} r="18"
                animate={{ fill: active ? INK : "#fff" }}
                style={{ stroke: active ? INK : LINE, strokeWidth: 1.5 }} />
              <g transform={`translate(${x - 8}, 32)`} stroke={active ? "#fff" : FG3}
                strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                {s.ic === "user"   && <><circle cx="8" cy="6" r="3" /><path d="M2 15c0-2.8 2.8-5 6-5s6 2.2 6 5" /></>}
                {s.ic === "target" && <><circle cx="8" cy="8" r="6.5" /><circle cx="8" cy="8" r="3" /></>}
                {s.ic === "filter" && <path d="M1 3h14l-5.5 7v4.5L7 13V10L1 3z" />}
                {s.ic === "mail"   && <><rect x="1" y="3" width="14" height="10" rx="1" /><path d="M1 5l7 4 7-4" /></>}
                {s.ic === "bell"   && <><path d="M13 12V9a5 5 0 00-10 0v3l-1.5 2h13L13 12z" /><path d="M6 16a2 2 0 004 0" /></>}
              </g>
            </g>
          );
        })}
        <motion.circle cx={30} cy={40} r="3.5" fill="#ff4a3a"
          animate={{ cx: 30 + step * 110 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}>
          <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
        </motion.circle>
      </svg>
      <div className="relative mt-1 min-h-[52px] sm:h-9 sm:mt-[-6px] overflow-x-auto overflow-y-hidden sm:overflow-visible pb-1 sm:pb-0">
        <div className="relative min-w-[480px] sm:min-w-0 h-[52px] sm:h-9">
        {AUTO_STEPS.map((s, i) => {
          const x = 30 + i * 110;
          return (
            <div key={i} style={{ position: "absolute", left: `${(x / 500) * 100}%`, transform: "translateX(-50%)",
              fontSize: 10, color: step >= i ? INK : FG4, fontWeight: step >= i ? 500 : 400, transition: "color 0.3s", textAlign: "center", maxWidth: 72 }}
              className="sm:max-w-none sm:whitespace-nowrap">
              <div className="leading-tight">{s.label}</div>
              <div style={{ fontFamily: FM, fontSize: 9, color: FG4, marginTop: 1 }} className="break-words sm:break-normal leading-tight">{s.sub}</div>
            </div>
          );
        })}
        </div>
      </div>
    </SpotlightCard>
  );
};

/* ─── FEATURES DATA ──────────────────────────────────────────────── */
const FEATURES = [
  { n: "01", t: "Унифицированные лиды", d: "Собираем данные из 80+ источников в единую модель. Дедуп, скоринг, маршрутизация — из коробки.", ic: "funnel" },
  { n: "02", t: "Воронка и канбан", d: "Drag-n-drop сценарии, форкасты на 90 дней, авто-задачи менеджерам по правилам.", ic: "pipe" },
  { n: "03", t: "Коммуникации", d: "Email, SMS, push, WhatsApp, Telegram и звонки — в одном потоке с атрибуцией.", ic: "mail" },
  { n: "04", t: "Сегменты и аудитории", d: "Конструктор на 180+ атрибутов. Синхронизация с Ads в реальном времени.", ic: "users" },
  { n: "05", t: "Атрибуция", d: "Last-click, first-touch, linear, time-decay, data-driven. ROI по каждой кампании.", ic: "chart" },
  { n: "06", t: "Автоматизация", d: "Визуальный редактор плейбуков: триггеры, ветвления, A/B, задержки, webhooks.", ic: "bolt" },
  { n: "07", t: "BI-дашборды", d: "80+ готовых виджетов и конструктор. Экспорт в PDF, подписки по расписанию.", ic: "grid" },
  { n: "08", t: "API и webhooks", d: "REST, GraphQL, streaming. SDK для Python, Node, Go. Zapier, Make, n8n.", ic: "code" },
  { n: "09", t: "Безопасность", d: "SOC 2, ISO 27001, GDPR, 152-ФЗ. SSO, RBAC, аудит, шифрование в покое и в движении.", ic: "shield" },
];

/* ─── METRICS ────────────────────────────────────────────────────── */
const METRICS = [
  { v: "2.4×",   l: "рост конверсии в квалифицированный лид за 90 дней" },
  { v: "−38%",   l: "стоимость привлечения за счёт атрибуции" },
  { v: "14ч",    l: "время от сырого лида до первого касания" },
  { v: "99.99%", l: "uptime за последние 12 месяцев" },
];

/* ─── LOGO NAMES ─────────────────────────────────────────────────── */
const LOGOS = ["Northwind", "Contour BI", "Parallax", "Meridian", "Helix", "Stratum", "Orbita", "Kernel"];

/* ═══════════════════════════════════════════════════════════════════
   SECTIONS
═══════════════════════════════════════════════════════════════════ */

/* ─── HERO ───────────────────────────────────────────────────────── */
const HeroSection: React.FC<{ onOpenDemo: () => void }> = ({ onOpenDemo }) => (
  <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 lg:items-start pt-10 pb-12 sm:pt-14 sm:pb-14 md:pt-20 md:pb-16">
    {/* Left */}
    <div>
      <Kicker>Lumiva · v4</Kicker>
      <h1 style={{ fontFamily: FF, fontSize: "clamp(32px,8vw,82px)", lineHeight: 1.0,
        letterSpacing: "-0.04em", fontWeight: 500, marginTop: 28, color: INK }} className="max-w-[100%]">
        Данные. <span style={{ color: FG3, fontWeight: 400 }}>Каналы.</span><br />
        Воронка. <span style={{ color: FG3, fontWeight: 400 }}>В одном месте.</span>
      </h1>
      <p style={{ fontSize: 18, lineHeight: 1.55, color: FG2, maxWidth: 540, marginTop: 24 }} className="text-base sm:text-lg">
        Мы собираем хаос в работающую систему роста. Лиды, сделки, аналитика, коммуникации — единый контур для команд маркетинга и продаж.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 40, flexWrap: "wrap" }}>
        <Link to="/pricing"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 24px",
            fontSize: 15, fontWeight: 500, borderRadius: 999, border: `1px solid ${INK}`,
            background: INK, color: "#fff", textDecoration: "none", whiteSpace: "nowrap" }}>
          Начать 14 дней <Icon name="arrow" size={15} />
        </Link>
        <button onClick={onOpenDemo}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 24px",
            fontSize: 15, fontWeight: 500, borderRadius: 999, border: `1px solid ${LINE}`,
            background: "#fff", color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>
          Смотреть тур <Icon name="play" size={13} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 48, marginTop: 52, flexWrap: "wrap" }}>
        {[
          { label: "КЛИЕНТЫ", val: "1 200+" },
          { label: "ОБРАБОТАНО ЛИДОВ", val: "48.2М" },
          { label: "СТРАНЫ", val: "32" },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.1em", color: FG3 }}>{m.label}</div>
            <div style={{ fontFamily: FF, fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 4, color: INK }}>{m.val}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Right: auth panel in original rounded wrapper */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15 }}
      className="min-w-0 rounded-[32px] border border-black/10 bg-gradient-to-b from-neutral-50 to-white p-4 shadow-[0_30px_70px_rgba(0,0,0,0.16)]"
    >
      <LandingAuthPanel compact />
    </motion.div>
  </section>
);

/* ─── LOGO MARQUEE ───────────────────────────────────────────────── */
const LogoMarquee: React.FC = () => (
  <section style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: "36px 0" }}>
    <div className="mx-auto px-5 md:px-8 max-w-[1440px] grid grid-cols-1 min-[640px]:grid-cols-[220px_1fr] gap-6 min-[640px]:gap-12 items-center">
      <div>
        <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: FG3 }}>ДОВЕРЯЮТ</div>
        <div style={{ fontFamily: FF, fontSize: 14, color: FG2, marginTop: 6 }}>От стартапов до enterprise</div>
      </div>
      <div style={{ overflow: "hidden", maskImage: "linear-gradient(to right, transparent 0, #000 10%, #000 90%, transparent 100%)" }}>
        <div style={{ display: "flex", gap: 56, width: "max-content", animation: "lv-marquee 32s linear infinite" }}>
          {[0, 1].map(k => (
            <div key={k} style={{ display: "flex", gap: 56, alignItems: "center" }}>
              {LOGOS.map(name => (
                <div key={name} style={{ fontFamily: FF, fontSize: 18, fontWeight: 500, color: FG4,
                  letterSpacing: "-0.01em", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: FG4, display: "inline-block" }} />
                  {name}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
    <style>{`@keyframes lv-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
  </section>
);

/* ─── FEATURES GRID ──────────────────────────────────────────────── */
const FeaturesGrid: React.FC = () => (
  <section className="py-16 md:py-24 lg:py-[100px]">
    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}
      className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-8 mb-10 md:mb-12 items-baseline">
      <div style={{ paddingTop: 6 }}><Kicker>01 · Модули</Kicker></div>
      <div>
        <h2 style={{ fontFamily: FF, fontSize: "clamp(28px,4vw,50px)", lineHeight: 1.04,
          letterSpacing: "-0.028em", fontWeight: 500, color: INK }}>
          Девять модулей, одна модель данных.
        </h2>
        <p style={{ marginTop: 16, color: FG2, fontSize: 15.5, maxWidth: 580, lineHeight: 1.55 }}>
          Всё, что нужно команде маркетинга и продаж, в одной платформе. Подключайте нужные модули — остальные не мешают.
        </p>
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5 }}
      style={{ borderTop: `1px solid ${LINE}`, borderLeft: `1px solid ${LINE}` }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f) => (
        <FeatureCell key={f.n}>
          <div style={{ position: "absolute", top: 28, right: 28, color: FG3 }}>
            <Icon name={f.ic} size={24} />
          </div>
          <div style={{ fontFamily: FM, fontSize: 11, color: FG4, letterSpacing: "0.1em" }}>F / {f.n}</div>
          <div style={{ fontFamily: FF, fontSize: 20, fontWeight: 500, color: INK, marginTop: 40, letterSpacing: "-0.01em" }}>{f.t}</div>
          <div style={{ fontSize: 14, color: FG2, marginTop: 10, lineHeight: 1.55, flex: 1 }}>{f.d}</div>
        </FeatureCell>
      ))}
    </motion.div>
  </section>
);

/* ─── AUTOMATION SECTION ─────────────────────────────────────────── */
const AutomationSection: React.FC = () => (
  <div style={{ background: BG_MUTED, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
    <section className="mx-auto max-w-[1440px] px-5 md:px-8 py-16 md:py-24 lg:py-[100px]">
      <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-8 mb-10 md:mb-12 items-baseline">
        <div style={{ paddingTop: 6 }}><Kicker>02 · Автоматизация</Kicker></div>
        <div>
          <h2 style={{ fontFamily: FF, fontSize: "clamp(30px,4vw,54px)", lineHeight: 1.04,
            letterSpacing: "-0.028em", fontWeight: 500, color: INK }}>
            Сценарии, которые делают работу за вас.
          </h2>
          <p style={{ marginTop: 16, color: FG2, fontSize: 16, maxWidth: 580, lineHeight: 1.55 }}>
            Визуальный конструктор плейбуков: триггер → условие → действие. От первого касания до closed won — без ручной рутины.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <AutomationFlow />
        <SpotlightCard style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: 28 }}>
          <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: FG3 }}>PERFORMANCE</div>
          <div style={{ fontFamily: FF, fontSize: 15, fontWeight: 500, marginTop: 4, marginBottom: 16, color: INK }}>
            Конверсия в квалифицированный лид
          </div>
          <SparkLine data={[18, 28, 24, 38, 32, 52, 48, 66, 58, 74, 72, 92]} height={90} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: FG3 }}>
            <span style={{ fontFamily: FM }}>12 нед.</span>
            <span style={{ fontFamily: FM, color: INK, fontWeight: 500 }}>+164%</span>
          </div>
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${LINE}`, fontSize: 13.5, color: FG2, lineHeight: 1.55 }}>
            Средний клиент на тарифе Professional запускает <b style={{ color: INK }}>12 сценариев</b> за первый месяц.
          </div>
        </SpotlightCard>
      </motion.div>
    </section>
  </div>
);

/* ─── LIVE HERO WIDGETS (hero right-side variant) ────────────────── */
const HeroWidgets: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <LiveLeadsFeed />
    <MiniPipeline />
  </div>
);

/* ─── METRICS ROW ────────────────────────────────────────────────── */
const MetricsSection: React.FC = () => (
  <section className="py-16 md:py-24 lg:py-[100px]">
    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}
      className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-8 mb-10 md:mb-12 items-baseline">
      <div style={{ paddingTop: 6 }}><Kicker>03 · Результаты</Kicker></div>
      <div>
        <h2 style={{ fontFamily: FF, fontSize: "clamp(28px,4vw,50px)", lineHeight: 1.04,
          letterSpacing: "-0.028em", fontWeight: 500, color: INK }}>
          Цифры, к которым мы приводим.
        </h2>
        <p style={{ marginTop: 16, color: FG2, fontSize: 15.5, maxWidth: 580, lineHeight: 1.55 }}>
          Усреднённые показатели наших клиентов через 90 дней после запуска.
        </p>
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5 }}
      style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}
      className="grid grid-cols-2 md:grid-cols-4">
      {METRICS.map((m, i) => (
        <SpotlightCard
          key={i}
          style={{ borderRight: i < 3 ? `1px solid ${LINE}` : "none" }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            style={{ padding: "36px 28px" }}>
            <div style={{ fontFamily: FF, fontSize: "clamp(36px,4.5vw,54px)", fontWeight: 500,
              letterSpacing: "-0.03em", lineHeight: 1, color: INK }}>{m.v}</div>
            <div style={{ fontSize: 12.5, color: FG2, marginTop: 12, lineHeight: 1.5 }}>{m.l}</div>
          </motion.div>
        </SpotlightCard>
      ))}
    </motion.div>
  </section>
);

/* ─── QUOTE BLOCK ────────────────────────────────────────────────── */
const QuoteBlock: React.FC = () => (
  <motion.section
    initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}
    style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}
    className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] gap-8 md:gap-12 py-12 md:py-16">
    <SpotlightCard style={{ fontFamily: FF, fontSize: "clamp(20px,2.4vw,28px)", lineHeight: 1.3,
      letterSpacing: "-0.015em", color: INK, fontWeight: 500, padding: "16px 0" }}>
      «Мы заменили семь подрядных кусков — CDP, CRM, трекер, email-сервис, дашборды, автодозвон и webhooks-слой. Lumiva живёт как один продукт. Команда перестала спорить, чьи цифры правильнее.»
    </SpotlightCard>
    <SpotlightCard style={{ display: "flex",
      flexDirection: "column", justifyContent: "flex-end", gap: 4, fontSize: 13, color: FG2 }}
      className="border-t pt-8 border-[#e7e7e7] md:border-t-0 md:border-l md:border-[#e7e7e7] md:pt-0 md:pl-6">
      <div style={{ fontFamily: FM, fontSize: 10, color: FG3, letterSpacing: "0.1em", textTransform: "uppercase" }}>КЛИЕНТ</div>
      <div style={{ fontFamily: FF, fontWeight: 500, color: INK, fontSize: 15 }}>Марина Левкова</div>
      <div>Head of Growth, Contour BI</div>
      <div style={{ marginTop: 10, fontSize: 11.5, color: FG3 }}>2 400 пользователей, 14 команд</div>
    </SpotlightCard>
  </motion.section>
);

/* ─── PRICING TEASE ──────────────────────────────────────────────── */
const PLANS = [
  { id: "standard",     name: "Standard",     priceM: 14, priceY: 11,
    sub: "Для быстрого запуска команды. Базовый CRM для ежедневной работы.", featured: false, cta: "Начать бесплатно", href: "/pricing" },
  { id: "professional", name: "Professional", priceM: 23, priceY: 18,
    sub: "Для роста и автоматизации. Масштабируйте и усиливайте управляемость.", featured: false, cta: "Начать бесплатно", href: "/pricing" },
  { id: "enterprise",   name: "Enterprise",   priceM: 40, priceY: 32,
    sub: "Максимум контроля, безопасности и глубокой аналитики для руководителей.", featured: true, cta: "14 дней бесплатно", href: "/pricing" },
  { id: "ultimate",     name: "Ultimate",     priceM: 52, priceY: 42,
    sub: "Премиальный пакет с сопровождением, консалтингом и кастомизацией.", featured: false, cta: "Связаться", href: "/contact" },
];

const PricingTease: React.FC = () => (
  <section className="py-16 md:py-24 lg:py-[100px]">
    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}
      className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-8 mb-[52px] items-baseline">
      <div style={{ paddingTop: 6 }}><Kicker>04 · Тарифы</Kicker></div>
      <div>
        <h2 style={{ fontFamily: FF, fontSize: "clamp(30px,4vw,54px)", lineHeight: 1.04,
          letterSpacing: "-0.028em", fontWeight: 500, color: INK }}>
          Честное ценообразование.
        </h2>
        <p style={{ marginTop: 16, color: FG2, fontSize: 16, maxWidth: 580, lineHeight: 1.55 }}>
          Платите за активных менеджеров, а не за функции. Все модули доступны на всех тарифах.
        </p>
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden" }}>
      {PLANS.map((plan, i) => (
        <SpotlightCard key={plan.id} light={plan.featured} style={{
          padding: "32px 28px",
          borderRight: i < 3 ? `1px solid ${plan.featured ? "rgba(255,255,255,0.12)" : LINE}` : "none",
          background: plan.featured ? INK : "#fff",
          color: plan.featured ? "#fff" : INK,
          display: "flex", flexDirection: "column",
        }}>
          <Kicker light={plan.featured}>{plan.name}</Kicker>
          <div style={{ marginTop: 24, display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: FF, fontSize: 48, fontWeight: 500, lineHeight: 0.95,
              letterSpacing: "-0.04em", color: plan.featured ? "#fff" : INK }}>
              €{plan.priceM}
            </span>
            <span style={{ fontSize: 13, color: plan.featured ? "rgba(255,255,255,0.55)" : FG3 }}>/мес</span>
          </div>
          <div style={{ fontSize: 11, color: plan.featured ? "rgba(255,255,255,0.45)" : FG4, fontFamily: FM, marginTop: 4, letterSpacing: "0.04em" }}>
            €{plan.priceY}/мес при годовой оплате
          </div>
          <p style={{ fontSize: 13, color: plan.featured ? "rgba(255,255,255,0.7)" : FG2, marginTop: 14, lineHeight: 1.5, flex: 1 }}>
            {plan.sub}
          </p>
          <div style={{ marginTop: 6, fontSize: 11.5, color: plan.featured ? "rgba(255,255,255,0.5)" : FG3 }}>
            + €5/мес за дополнительного пользователя
          </div>
          <Link to={plan.href} style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 24,
            padding: "8px 16px", fontSize: 13, fontWeight: 500, borderRadius: 999,
            border: `1px solid ${plan.featured ? "#fff" : LINE}`,
            background: plan.featured ? "#fff" : "#fff",
            color: INK, textDecoration: "none", alignSelf: "flex-start",
          }}>
            {plan.cta} <Icon name="arrow" size={12} />
          </Link>
        </SpotlightCard>
      ))}
    </motion.div>
  </section>
);

/* ─── CTA STRIP ──────────────────────────────────────────────────── */
const CTAStrip: React.FC<{ onOpenDemo: () => void }> = ({ onOpenDemo }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const handleMouseMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  return (
    <section style={{ paddingBottom: 64 }}>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6 }}
        style={{
          border: `1px solid ${LINE}`, borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32,
          background: "#fff", position: "relative", overflow: "hidden",
          "--x": `${pos.x}%`, "--y": `${pos.y}%`,
        } as React.CSSProperties}
        className="group flex flex-col md:flex-row items-start md:items-center px-6 py-10 sm:px-10 sm:py-12 md:px-12 md:py-14"
        whileHover={{ boxShadow: "0 22px 55px rgba(0,0,0,0.10)", zIndex: 1 }}>
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "radial-gradient(600px circle at var(--x) var(--y), rgba(0,0,0,0.04), transparent 60%)" }} />
        {/* grid-line background */}
        <div style={{ position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(to right, ${LINE3} 1px, transparent 1px)`,
          backgroundSize: "48px 100%", opacity: 0.5, pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <Kicker>НАЧНИТЕ СЕГОДНЯ</Kicker>
          <div style={{ fontFamily: FF, fontSize: "clamp(24px,3vw,36px)", fontWeight: 500,
            letterSpacing: "-0.02em", marginTop: 14, lineHeight: 1.1, maxWidth: 520, color: INK }}>
            14 дней бесплатно. Без карты. Без звонков.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", position: "relative" }}>
          <Link to="/pricing" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 22px",
            fontSize: 14, fontWeight: 500, borderRadius: 999, border: `1px solid ${INK}`,
            background: INK, color: "#fff", textDecoration: "none", whiteSpace: "nowrap" }}>
            Создать аккаунт <Icon name="arrow" size={14} />
          </Link>
          <button onClick={onOpenDemo} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 22px",
            fontSize: 14, fontWeight: 500, borderRadius: 999, border: `1px solid ${LINE}`,
            background: "#fff", color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>
            Демо
          </button>
        </div>
      </motion.div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   AUTH PANEL  (logic untouched — only outer wrapper restyled)
═══════════════════════════════════════════════════════════════════ */
const LandingAuthPanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = (i18n.language || "ru").slice(0, 2);
  const text =
    lang === "en"
      ? {
          title: "Access account",
          subtitle: "Use login for existing tenants or create a new account and activate it after payment.",
          loginTab: "Login", signupTab: "Sign up",
          loginClientKey: "Client key", email: "Email", password: "Password",
          companyName: "Company name", phone: "Phone", makeKey: "Generate key",
          submitLogin: "Enter account", submitSignup: "Create account",
          loading: "Please wait...", needFields: "Fill required fields",
          signupOk: "Account created. Redirecting to billing...", loginOk: "Login successful",
          verifyTitle: "Email confirmation", verifyHint: "Enter the 6-digit code sent to your email.",
          verifyCode: "Verification code", verifySubmit: "Confirm code",
          verifySent: "Code sent to your email", verifyOk: "Email confirmed. Redirecting to billing...",
          resendCode: "Send code again", resendWait: "You can request again in", verifyTapHint: "Tap to type code",
        }
      : lang === "tr"
        ? {
            title: "Hesap erişimi",
            subtitle: "Mevcut tenant için giriş yapın veya yeni hesap oluşturup ödemeden sonra etkinleştirin.",
            loginTab: "Giriş", signupTab: "Kayıt",
            loginClientKey: "Müşteri anahtarı", email: "E-posta", password: "Şifre",
            companyName: "Şirket adı", phone: "Telefon", makeKey: "Anahtar üret",
            submitLogin: "Panele gir", submitSignup: "Hesap oluştur",
            loading: "Yükleniyor...", needFields: "Zorunlu alanları doldurun",
            signupOk: "Hesap oluşturuldu. Ödemeye yönlendiriliyor...", loginOk: "Giriş başarılı",
            verifyTitle: "E-posta doğrulama", verifyHint: "E-postanıza gönderilen 6 haneli kodu girin.",
            verifyCode: "Doğrulama kodu", verifySubmit: "Kodu onayla",
            verifySent: "Kod e-postanıza gönderildi", verifyOk: "E-posta doğrulandı. Ödemeye yönlendiriliyor...",
            resendCode: "Kodu tekrar gönder", resendWait: "Tekrar isteme süresi", verifyTapHint: "Kodu yazmak için dokunun",
          }
        : {
            title: "Вход в аккаунт",
            subtitle: "Войдите в существующий аккаунт или зарегистрируйте новый и активируйте его после оплаты.",
            loginTab: "Вход", signupTab: "Регистрация",
            loginClientKey: "Ключ клиента", email: "Email", password: "Пароль",
            companyName: "Название компании", phone: "Телефон", makeKey: "Сформировать ключ",
            submitLogin: "Войти в аккаунт", submitSignup: "Создать аккаунт",
            loading: "Подождите...", needFields: "Заполните обязательные поля",
            signupOk: "Аккаунт создан. Переходим к оплате...", loginOk: "Вход выполнен",
            verifyTitle: "Подтверждение email", verifyHint: "Введите код из 6 цифр, отправленный на вашу почту.",
            verifyCode: "Код подтверждения", verifySubmit: "Подтвердить код",
            verifySent: "Код отправлен вам на почту", verifyOk: "Email подтвержден. Переходим к оплате...",
            resendCode: "Отправить код повторно", resendWait: "Повторная отправка через", verifyTapHint: "Нажмите, чтобы ввести код",
          };

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ clientKey: "", email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    companyName: "", clientKey: "", email: "", password: "", phoneCountry: "+7", phoneNumber: "",
  });
  const [signupVerification, setSignupVerification] = useState<{ clientKey: string; email: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [lastChangedDigit, setLastChangedDigit] = useState<number | null>(null);
  const verifyInputRef = useRef<HTMLInputElement | null>(null);

  const verificationDigits = useMemo(
    () => Array.from({ length: 6 }, (_, i) => verificationCode[i] || ""),
    [verificationCode],
  );

  const makeClientKey = () => {
    const raw = signupForm.companyName.trim().toLowerCase()
      .replace(/[^a-z0-9а-яё\s-]/gi, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const latin = raw
      .replace(/а/g,"a").replace(/б/g,"b").replace(/в/g,"v").replace(/г/g,"g").replace(/д/g,"d")
      .replace(/е/g,"e").replace(/ё/g,"e").replace(/ж/g,"zh").replace(/з/g,"z").replace(/и/g,"i")
      .replace(/й/g,"y").replace(/к/g,"k").replace(/л/g,"l").replace(/м/g,"m").replace(/н/g,"n")
      .replace(/о/g,"o").replace(/п/g,"p").replace(/р/g,"r").replace(/с/g,"s").replace(/т/g,"t")
      .replace(/у/g,"u").replace(/ф/g,"f").replace(/х/g,"h").replace(/ц/g,"c").replace(/ч/g,"ch")
      .replace(/ш/g,"sh").replace(/щ/g,"sch").replace(/ы/g,"y").replace(/э/g,"e").replace(/ю/g,"yu").replace(/я/g,"ya");
    setSignupForm(s => ({ ...s, clientKey: latin.slice(0, 64) }));
  };

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(() => setResendCooldown(p => p <= 1 ? 0 : p - 1), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setMessage(null);
    if (!loginForm.clientKey || !loginForm.email || !loginForm.password) { setError(text.needFields); return; }
    setLoading(true);
    try {
      const resp = await login(loginForm);
      persistSession(resp); setMessage(text.loginOk);
      navigate(resp.billingLocked ? "/app/billing" : "/app", { replace: true });
    } catch (err: any) { setError(err?.message || "Error"); } finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setMessage(null);
    if (!signupForm.companyName || !signupForm.clientKey || !signupForm.email || !signupForm.password) { setError(text.needFields); return; }
    setLoading(true);
    try {
      const phone = `${signupForm.phoneCountry} ${signupForm.phoneNumber}`.trim();
      const resp = await signup({ companyName: signupForm.companyName, clientKey: signupForm.clientKey, email: signupForm.email, password: signupForm.password, phone });
      setSignupVerification({ clientKey: resp.clientKey, email: resp.email });
      setVerificationCode(""); setResendCooldown(45); setMessage(resp.message || text.verifySent);
    } catch (err: any) { setError(err?.message || "Error"); } finally { setLoading(false); }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setMessage(null);
    if (!signupVerification) { setError("Verification context is missing"); return; }
    if (!/^\d{6}$/.test(verificationCode.trim())) { setError(text.verifyHint); return; }
    setLoading(true);
    try {
      const resp = await verifySignupCode({ clientKey: signupVerification.clientKey, email: signupVerification.email, code: verificationCode.trim() });
      persistSession(resp); setMessage(text.verifyOk); navigate("/app/billing", { replace: true });
    } catch (err: any) { setError(err?.message || "Error"); } finally { setLoading(false); }
  };

  const handleResendCode = async () => {
    if (!signupVerification || resendCooldown > 0) return;
    setError(null); setMessage(null); setLoading(true);
    try {
      const resp = await resendSignupCode({ clientKey: signupVerification.clientKey, email: signupVerification.email });
      setVerificationCode(""); setResendCooldown(45); setMessage(resp.message || text.verifySent);
      verifyInputRef.current?.focus();
    } catch (err: any) { setError(err?.message || "Error"); } finally { setLoading(false); }
  };

  /* Shared input style */
  const inp = "rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-400 w-full";

  return (
    <section className={compact
      ? "overflow-y-auto overflow-x-hidden rounded-[24px] bg-white p-5"
      : "rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-8"}>
      <div className={compact ? "max-w-none" : "max-w-3xl"}>
        <h2 style={{ fontFamily: FF }} className={compact ? "text-xl font-semibold text-black" : "text-2xl font-semibold text-black"}>
          {text.title}
        </h2>
        <p className={compact ? "mt-1.5 text-xs text-neutral-500" : "mt-2 text-sm text-neutral-500"}>{text.subtitle}</p>
      </div>

      {/* Tab switcher */}
      <div className={compact ? "mt-4" : "mt-5"}>
        <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1">
          {(["login", "signup"] as const).map(tab => (
            <button key={tab} type="button"
              onClick={() => { setMode(tab); setSignupVerification(null); setVerificationCode(""); setResendCooldown(0); setError(null); setMessage(null); }}
              style={{ fontFamily: FF }}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${mode === tab ? "bg-black text-white" : "text-neutral-500 hover:text-black"}`}>
              {tab === "login" ? text.loginTab : text.signupTab}
            </button>
          ))}
        </div>
      </div>

      {/* Login form */}
      {mode === "login" && (
        <form onSubmit={handleLogin} className={compact ? "mt-4 grid gap-2.5" : "mt-5 grid gap-3"}>
          <input className={inp} placeholder={text.loginClientKey} value={loginForm.clientKey}
            onChange={e => setLoginForm(s => ({ ...s, clientKey: e.target.value }))} />
          <input className={inp} placeholder={text.email} type="email" value={loginForm.email}
            onChange={e => setLoginForm(s => ({ ...s, email: e.target.value }))} />
          <input className={inp} placeholder={text.password} type="password" value={loginForm.password}
            onChange={e => setLoginForm(s => ({ ...s, password: e.target.value }))} />
          <button type="submit" disabled={loading}
            style={{ fontFamily: FF }}
            className="w-full rounded-xl bg-black py-2.5 text-sm font-medium text-white disabled:opacity-60 hover:bg-neutral-800 transition-colors">
            {loading ? text.loading : text.submitLogin}
          </button>
        </form>
      )}

      {/* Signup form */}
      {mode === "signup" && !signupVerification && (
        <form onSubmit={handleSignup} className={compact ? "mt-4 grid gap-2.5" : "mt-5 grid gap-3"} autoComplete="on">
          <input className={inp} placeholder={text.companyName} autoComplete="organization" value={signupForm.companyName}
            onChange={e => setSignupForm(s => ({ ...s, companyName: e.target.value }))} />
          <div className="flex gap-2">
            <input className={`${inp} flex-1 min-w-0`} placeholder={text.loginClientKey} autoComplete="off" value={signupForm.clientKey}
              onChange={e => setSignupForm(s => ({ ...s, clientKey: e.target.value }))} />
            <button type="button" onClick={makeClientKey}
              className="shrink-0 rounded-xl border border-neutral-200 px-3 text-xs font-medium text-neutral-600 hover:border-neutral-400 whitespace-nowrap">
              {text.makeKey}
            </button>
          </div>
          <div className="flex gap-2">
            <select value={signupForm.phoneCountry} onChange={e => setSignupForm(s => ({ ...s, phoneCountry: e.target.value }))}
              className="w-24 rounded-xl border border-neutral-200 bg-white px-2 py-2.5 text-sm" aria-label="Country code">
              <option value="+7">🇷🇺 +7</option>
              <option value="+90">🇹🇷 +90</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+49">🇩🇪 +49</option>
            </select>
            <input className={`${inp} flex-1 min-w-0`} placeholder={text.phone} autoComplete="tel-national" inputMode="tel"
              value={signupForm.phoneNumber} onChange={e => setSignupForm(s => ({ ...s, phoneNumber: e.target.value }))} />
          </div>
          <input className={inp} placeholder={text.email} type="email" autoComplete="email" value={signupForm.email}
            onChange={e => setSignupForm(s => ({ ...s, email: e.target.value }))} />
          <input className={inp} placeholder={text.password} type="password" autoComplete="new-password" value={signupForm.password}
            onChange={e => setSignupForm(s => ({ ...s, password: e.target.value }))} />
          <button type="submit" disabled={loading}
            style={{ fontFamily: FF }}
            className="w-full rounded-xl bg-black py-2.5 text-sm font-medium text-white disabled:opacity-60 hover:bg-neutral-800 transition-colors">
            {loading ? text.loading : text.submitSignup}
          </button>
        </form>
      )}

      {/* Email verification */}
      {mode === "signup" && signupVerification && (
        <form onSubmit={handleVerifyCode} className={compact ? "mt-4 grid gap-3" : "mt-5 grid gap-4"} autoComplete="off" data-lpignore="true">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-4 sm:p-5 shadow-[0_16px_45px_rgba(15,23,42,0.14)]">
            <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-cyan-300/35 blur-2xl" />
            <div className="pointer-events-none absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-indigo-300/30 blur-2xl" />
            <div className="relative">
              <div className="inline-flex items-center rounded-full border border-slate-300/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Lumiva Secure
              </div>
              <div className="mt-2 text-[17px] sm:text-[19px] font-semibold text-slate-900">{text.verifyTitle}</div>
              <div className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">{text.verifyHint}</div>
              <div className="mt-2 text-xs text-slate-500">{signupVerification.email}</div>
            </div>
          </div>

          <div className="relative">
            <input ref={verifyInputRef} type="text" inputMode="numeric" autoComplete="one-time-code"
              name="one-time-code" spellCheck={false} data-lpignore="true"
              className="absolute inset-0 h-full w-full opacity-0"
              value={verificationCode} maxLength={6}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                const prevLength = verificationCode.length;
                const nextLength = digits.length;
                if (nextLength > prevLength) setLastChangedDigit(nextLength - 1);
                else if (nextLength < prevLength) setLastChangedDigit(Math.max(nextLength, 0));
                setVerificationCode(digits);
              }}
              onFocus={() => { if (lastChangedDigit === null && verificationCode.length === 0) setLastChangedDigit(0); }}
            />
            <button type="button" onClick={() => verifyInputRef.current?.focus()} className="w-full">
              <div className="grid grid-cols-6 gap-2 sm:gap-3">
                {verificationDigits.map((digit, index) => {
                  const active = index === Math.min(verificationCode.length, 5);
                  const filled = Boolean(digit);
                  return (
                    <motion.div key={`${index}-${digit || "empty"}`}
                      initial={false}
                      animate={lastChangedDigit === index ? { y: [0, -3, 2, -1, 0], rotate: [0, -1.2, 1.2, 0], scale: [1, 1.05, 1] } : { y: 0, rotate: 0, scale: 1 }}
                      transition={{ duration: 0.32, ease: "easeOut" }}
                      className={`h-12 sm:h-14 rounded-2xl border text-lg sm:text-xl font-semibold flex items-center justify-center transition-all ${
                        filled ? "border-cyan-400 bg-slate-900 text-cyan-300 shadow-[0_8px_22px_rgba(8,145,178,0.25)]"
                          : active ? "border-slate-700 bg-slate-800 text-white shadow-[0_10px_24px_rgba(15,23,42,0.35)]"
                          : "border-slate-200 bg-white text-slate-300"
                      }`}>
                      {digit || "•"}
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-2 text-center text-[11px] text-slate-500">{text.verifyTapHint}</div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button type="submit" disabled={loading || verificationCode.length !== 6}
              className="rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {loading ? text.loading : text.verifySubmit}
            </button>
            <button type="button" onClick={handleResendCode} disabled={loading || resendCooldown > 0}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:opacity-60">
              {resendCooldown > 0 ? `${text.resendWait} ${resendCooldown}s` : text.resendCode}
            </button>
          </div>
        </form>
      )}

      {error   && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {message && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</div>}
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
═══════════════════════════════════════════════════════════════════ */
const LandingPage: React.FC = () => {
  const { t } = useTranslation();

  const [pageLoading, setPageLoading] = useState(() => {
    try { return window.localStorage.getItem("lumiva_landing_preloader_seen") !== "1"; } catch { return true; }
  });
  const [progress, setProgress] = useState(0);

  const [cookiesAccepted, setCookiesAccepted] = useState(() => {
    try {
      const d = window.localStorage.getItem("lumiva_cookies_consent");
      return d === "accepted" || d === "declined";
    } catch { return false; }
  });

  const [demoOpen, setDemoOpen] = useState(false);
  const [utmPayload, setUtmPayload] = useState<Record<string, string>>({});
  const [demoForm, setDemoForm] = useState({
    firstName: "", lastName: "", email: "", phoneCountry: "+7", phoneNumber: "",
    ordersPerMonth: "", contactMethod: "", consent: false, botTrap: "",
  });
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [demoStatus, setDemoStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  /* preloader */
  useEffect(() => {
    if (!pageLoading) return;
    let current = 0;
    const total = 1600, stepMs = 20, step = 100 / (total / stepMs);
    const id = window.setInterval(() => {
      current += step;
      if (current >= 100) {
        current = 100; window.clearInterval(id);
        setTimeout(() => { setPageLoading(false); try { window.localStorage.setItem("lumiva_landing_preloader_seen", "1"); } catch {} }, 200);
      }
      setProgress(Math.round(current));
    }, stepMs);
    return () => window.clearInterval(id);
  }, [pageLoading]);

  /* UTM */
  useEffect(() => {
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    const params = new URLSearchParams(window.location.search);
    const fromUrl: Record<string, string> = {};
    keys.forEach(k => { const v = params.get(k); if (v) fromUrl[k] = v; });
    if (Object.keys(fromUrl).length > 0) {
      setUtmPayload(fromUrl);
      try { window.localStorage.setItem("lumiva_utm", JSON.stringify(fromUrl)); } catch {};
      return;
    }
    try {
      const cached = window.localStorage.getItem("lumiva_utm");
      if (cached) { const p = JSON.parse(cached); if (p && typeof p === "object") setUtmPayload(p); }
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-white text-black overflow-x-hidden">
      {/* PRELOADER */}
      {pageLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-40 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-black transition-[width] duration-100 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div style={{ fontFamily: FM }} className="text-xs tracking-[0.25em] uppercase text-neutral-400">
              {progress}%
            </div>
          </div>
        </div>
      )}

      <PublicHeader activeKey="home" />

      {/* Contained sections */}
      <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1440 }}>
        <HeroSection onOpenDemo={() => setDemoOpen(true)} />
      </div>

      {/* Full-width strip sections */}
      <LogoMarquee />

      <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1440 }}>
        <FeaturesGrid />
      </div>

      {/* Full-width muted background */}
      <AutomationSection />

      <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1440 }}>
        <MetricsSection />
        <QuoteBlock />
        <PricingTease />
        <CTAStrip onOpenDemo={() => setDemoOpen(true)} />
      </div>

      <PublicFooter />

      {/* DEMO DRAWER */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${demoOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button className="absolute inset-0 bg-black/40" onClick={() => setDemoOpen(false)} aria-label={t("landing.form.close")} />
        <div className={`absolute inset-0 bg-white transition-transform duration-300 ease-out ${demoOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="mx-auto h-full max-w-[1440px] px-4 sm:px-6 py-8 sm:py-12 grid gap-8 lg:gap-10 lg:grid-cols-[1.35fr,1fr] overflow-y-auto">
            <div className="space-y-6">
              <div style={{ fontFamily: FM }} className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Lumiva CRM</div>
              <h2 style={{ fontFamily: FF }} className="text-4xl sm:text-6xl lg:text-7xl font-medium text-black leading-[1.05] whitespace-pre-line">
                {t("landing.form.headline")}
              </h2>
              <p className="text-sm text-neutral-600 max-w-md">{t("landing.form.sub")}</p>
              <div className="flex items-center gap-4 text-[12px] text-neutral-500">
                <span>vlad@lumiva.agency</span><span>+7 499 653 78 83</span>
              </div>
            </div>

            <form className="space-y-5" onSubmit={e => {
              e.preventDefault();
              if (!demoForm.consent) { setDemoStatus({ type: "error", message: t("landing.form.errors.consent") }); return; }
              if (!demoForm.firstName || !demoForm.email || !demoForm.phoneNumber) { setDemoStatus({ type: "error", message: t("landing.form.errors.required") }); return; }
              if (!demoForm.contactMethod) { setDemoStatus({ type: "error", message: t("landing.form.errors.contact") }); return; }
              setDemoSubmitting(true); setDemoStatus(null);
              const phone = `${demoForm.phoneCountry} ${demoForm.phoneNumber}`.trim();
              void fetch("/v1/public/demo-requests", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ firstName: demoForm.firstName, lastName: demoForm.lastName, email: demoForm.email, phone, ordersPerMonth: demoForm.ordersPerMonth, contactMethod: demoForm.contactMethod, botField: demoForm.botTrap || undefined, utm: utmPayload }),
              })
                .then(res => { if (!res.ok) throw new Error(t("landing.form.errors.submit")); return res.json(); })
                .then(() => { setDemoStatus({ type: "success", message: t("landing.form.success") }); setDemoForm({ firstName: "", lastName: "", email: "", phoneCountry: "+7", phoneNumber: "", ordersPerMonth: "", contactMethod: "", consent: false, botTrap: "" }); })
                .catch(() => setDemoStatus({ type: "error", message: t("landing.form.errors.failed") }))
                .finally(() => setDemoSubmitting(false));
            }}>
              {demoStatus && (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${demoStatus.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
                  {demoStatus.message}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.name")} *
                  <input className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm" value={demoForm.firstName} onChange={e => setDemoForm(s => ({ ...s, firstName: e.target.value }))} placeholder={t("landing.form.placeholders.name")} />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.surname")}
                  <input className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm" value={demoForm.lastName} onChange={e => setDemoForm(s => ({ ...s, lastName: e.target.value }))} placeholder={t("landing.form.placeholders.surname")} />
                </label>
              </div>
              <input className="hidden" tabIndex={-1} autoComplete="off" value={demoForm.botTrap} onChange={e => setDemoForm(s => ({ ...s, botTrap: e.target.value }))} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.email")} *
                  <input type="email" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm" value={demoForm.email} onChange={e => setDemoForm(s => ({ ...s, email: e.target.value }))} placeholder={t("landing.form.placeholders.email")} />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.phone")} *
                  <div className="mt-2 flex gap-2">
                    <select value={demoForm.phoneCountry} onChange={e => setDemoForm(s => ({ ...s, phoneCountry: e.target.value }))} className="w-28 rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm">
                      <option value="+7">🇷🇺 +7</option><option value="+90">🇹🇷 +90</option><option value="+1">🇺🇸 +1</option><option value="+44">🇬🇧 +44</option><option value="+49">🇩🇪 +49</option>
                    </select>
                    <input className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm" value={demoForm.phoneNumber} onChange={e => setDemoForm(s => ({ ...s, phoneNumber: e.target.value }))} placeholder={t("landing.form.placeholders.phone")} />
                  </div>
                </label>
              </div>
              <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                {t("landing.form.orders")}
                <input className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm" value={demoForm.ordersPerMonth} onChange={e => setDemoForm(s => ({ ...s, ordersPerMonth: e.target.value }))} placeholder={t("landing.form.placeholders.orders")} />
              </label>
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">{t("landing.form.contact")} *</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[{ value: "telegram", label: "Telegram" }, { value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }, { value: "phone", label: t("landing.form.phone") }].map(m => (
                    <label key={m.value} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors ${demoForm.contactMethod === m.value ? m.value === "telegram" ? "border-sky-500 bg-sky-50 text-sky-700" : "border-black bg-neutral-50 text-black" : "border-neutral-200 text-neutral-700 hover:border-neutral-400"}`}>
                      <span>{m.label}</span>
                      <input type="radio" name="contactMethod" value={m.value} checked={demoForm.contactMethod === m.value} onChange={e => setDemoForm(s => ({ ...s, contactMethod: e.target.value }))} />
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 px-4 py-3 text-sm">
                <span className="text-neutral-600">
                  {t("landing.form.consent")}{" "}
                  <a href="#privacy-pdf" className="underline underline-offset-4 text-neutral-800">{t("landing.form.policy")}</a>
                </span>
                <span className="relative inline-flex items-center">
                  <input type="checkbox" checked={demoForm.consent} onChange={e => setDemoForm(s => ({ ...s, consent: e.target.checked }))} className="peer sr-only" />
                  <span className="h-6 w-11 rounded-full bg-neutral-300 transition-colors peer-checked:bg-emerald-500" />
                  <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                </span>
              </label>
              <button type="submit" disabled={demoSubmitting} className="w-full rounded-2xl border border-black bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-60 hover:bg-neutral-800 transition-colors">
                {demoSubmitting ? t("landing.form.sending") : t("landing.form.send")}
              </button>
            </form>
          </div>
          <button onClick={() => setDemoOpen(false)} className="absolute right-6 top-6 text-sm text-neutral-500 hover:text-black">✕</button>
        </div>
      </div>

      {/* COOKIES */}
      {!cookiesAccepted && (
        <div className="fixed inset-x-0 bottom-4 z-50 px-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.12)] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-neutral-700">
            <div className="space-y-1">
              <div className="font-semibold text-black">{t("landing.cookies.title")}</div>
              <div className="text-[12px] text-neutral-500">
                {t("landing.cookies.text")}{" "}
                <a href="#cookies-policy" className="underline underline-offset-4 text-neutral-800">{t("landing.cookies.link")}</a>.
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setCookiesAccepted(true); try { window.localStorage.setItem("lumiva_cookies_consent", "accepted"); } catch {} }}
                className="rounded-xl border border-black bg-black text-white px-3 py-2 text-sm font-medium">
                {t("landing.cookies.accept")}
              </button>
              <button onClick={() => { setCookiesAccepted(true); try { window.localStorage.setItem("lumiva_cookies_consent", "declined"); } catch {} }}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-700">
                {t("landing.cookies.decline")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
