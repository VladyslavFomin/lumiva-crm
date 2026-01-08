// src/pages/LandingPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useTranslation } from "react-i18next";
import { setAppLanguage } from "../i18n";

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top, behavior: "smooth" });
};

/* ====================== UI: Magnetic Button ====================== */

const MagneticButton: React.FC<
  React.PropsWithChildren<{ onClick?: () => void }>
> = ({ children, onClick }) => {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 18;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 18;
    setPos({ x, y });
  };

  const reset = () => {
    setHovered(false);
    setPos({ x: 0, y: 0 });
  };

  return (
    <button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={reset}
      onClick={onClick}
      className="relative inline-flex items-center justify-center rounded-full border border-black bg-black px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white overflow-hidden"
    >
      <span
        className="absolute inset-0 rounded-full border border-white/20"
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          transition: hovered ? "transform 0.05s linear" : "transform 0.35s ease-out",
        }}
      />
      <span className="relative">{children}</span>
    </button>
  );
};

/* ====================== UI: Spotlight Card ====================== */

const SpotlightCard: React.FC<
  React.PropsWithChildren<{ className?: string }>
> = ({ children, className = "" }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x, y });
  };

  return (
    <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        className={
            "group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white/80 shadow-[0_18px_45px_rgba(0,0,0,0.04)] transition-colors duration-300 group-hover:border-black/80 " +
            className
        }
      style={{
        // @ts-expect-error – CSS custom properties
        "--x": `${pos.x}%`,
        "--y": `${pos.y}%`,
      }}
      whileHover={{
        y: -8,
        boxShadow: "0 22px 55px rgba(0,0,0,0.12)",
      }}
      transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.6 }}
    >
      {/* Spotlight / moving gradient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "radial-gradient(480px circle at var(--x) var(--y), rgba(0,0,0,0.12), transparent 55%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

const DonutStat: React.FC<{ label: string; percent: number }> = ({
  label,
  percent,
}) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <div className="group relative flex flex-col items-center gap-1.5">
      <svg width="80" height="80" className="rotate-[-90deg]">
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="#111827"
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-transform duration-200 group-hover:scale-[1.03]"
        />
      </svg>
      <div className="text-center">
        <div className="text-sm font-semibold text-black">
          {percent.toFixed(1)}%
        </div>
        <div className="text-[11px] text-neutral-500">{label}</div>
      </div>
      <div className="pointer-events-none absolute -top-2 translate-y-[-100%] opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-600 shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
          {label}: {percent.toFixed(1)}%
        </div>
      </div>
    </div>
  );
};

const OutlineIcon: React.FC<{ kind: "marketing" | "sales" | "projects" | "leads" | "tasks" }> = ({ kind }) => {
  const stroke = "#0f172a";
  const common = { stroke, strokeWidth: 1.6, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (kind === "marketing") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <rect x="3" y="5" width="18" height="14" rx="2" {...common} />
        <path d="M7 13.5 11 10l3 3 3-4" {...common} />
        <circle cx="8" cy="9" r="1" fill={stroke} />
      </svg>
    );
  }
  if (kind === "sales") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M4 7h16M4 12h10M4 17h7" {...common} />
        <rect x="4" y="5" width="16" height="14" rx="2" {...common} />
      </svg>
    );
  }
  if (kind === "projects") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <rect x="4" y="6" width="16" height="12" rx="2" {...common} />
        <path d="M8 9h8M8 13h4" {...common} />
      </svg>
    );
  }
  if (kind === "leads") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M6 5h12M6 9h10M6 13h8M6 17h6" {...common} />
        <circle cx="18" cy="9" r="1.2" fill={stroke} />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <rect x="5" y="5" width="14" height="14" rx="3" {...common} />
      <path d="M8 12h8M8 15h5M8 9h6" {...common} />
    </svg>
  );
};

/* ====================== HEADER ====================== */

const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language || "ru").slice(0, 2);
  return (
    <header className="sticky top-0 z-40 mb-8 sm:mb-10">
      <div className="backdrop-blur-xl bg-white/70 border border-black/5 rounded-3xl mt-2 sm:mt-3 px-4 sm:px-6 py-2.5 sm:py-3 shadow-[0_10px_40px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl border border-black bg-black flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-white" />
          </div>
          <span className="text-sm font-semibold tracking-[0.16em] uppercase text-black">
            Lumiva CRM
          </span>
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-neutral-600">
          <button
            onClick={() => scrollToId("hero")}
            className="hover:text-black transition-colors"
          >
            {t("landing.nav.overview")}
          </button>
          <button
            onClick={() => scrollToId("features")}
            className="hover:text-black transition-colors"
          >
            {t("landing.nav.features")}
          </button>
          <button
            onClick={() => scrollToId("analytics")}
            className="hover:text-black transition-colors"
          >
            {t("landing.nav.analytics")}
          </button>
          <button
            onClick={() => scrollToId("dashboard")}
            className="hover:text-black transition-colors"
          >
            {t("landing.nav.workspace")}
          </button>
        </nav>

        {/* Contact */}
        <div className="flex items-center gap-3">
          <select
            value={currentLang}
            onChange={(e) => setAppLanguage(e.target.value as "ru" | "en" | "tr")}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            aria-label={t("crm.common.language")}
          >
            <option value="ru">{t("lang.ru")}</option>
            <option value="en">{t("lang.en")}</option>
            <option value="tr">{t("lang.tr")}</option>
          </select>
          <span className="hidden sm:inline text-xs font-medium text-neutral-500">
            vlad@lumiva.agency
          </span>
          <a
            href="/login"
            className="rounded-full border border-black px-3 py-1.5 text-xs font-semibold tracking-wide uppercase bg-black text-white hover:bg-white hover:text-black transition-colors"
          >
            {t("landing.nav.login")}
          </a>
        </div>
      </div>
    </header>
  );
};

/* ====================== HERO ====================== */

const Hero: React.FC<{ onOpenDemo: () => void }> = ({ onOpenDemo }) => {
  const { t } = useTranslation();
  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const titleY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const panelY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);

  // Точки для мини-графика в герое (линия + точки совпадают)
  const heroPoints = [
    { x: 12, y: 52 },
    { x: 55, y: 38 },
    { x: 100, y: 32 },
    { x: 145, y: 30 },
    { x: 185, y: 34 },
    { x: 220, y: 30 },
    { x: 246, y: 26 },
  ];
  const heroPath = `M${heroPoints
    .map((p) => `${p.x},${p.y}`)
    .join(" L ")}`;
  const heroAreaPath = `${heroPath} L ${
    heroPoints[heroPoints.length - 1].x
  },70 L ${heroPoints[0].x},70 Z`;

  return (
    <section id="hero" ref={heroRef} className="relative">
      {/* Лёгкий параллакс фон */}
      <motion.div
        style={{ scale: bgScale }}
        className="pointer-events-none absolute -inset-10 rounded-[46px] border border-black/5 bg-white"
      />

      {/* 3D-орбы */}
      <motion.div
        className="pointer-events-none absolute -left-12 top-6 h-44 w-44 rounded-full bg-gradient-to-br from-[#7c3aed] via-[#22d3ee] to-white blur-3xl opacity-60"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute right-4 -bottom-10 h-56 w-56 rounded-full bg-gradient-to-br from-[#0ea5e9] via-[#22c55e] to-white blur-3xl opacity-60"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/3 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-[#f97316] via-[#f472b6] to-white blur-3xl opacity-50"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative grid gap-8 lg:gap-10 lg:grid-cols-[1.1fr,0.9fr] rounded-[40px] border border-black/8 bg-white/70 px-5 py-8 sm:px-10 sm:py-14 shadow-[0_30px_80px_rgba(0,0,0,0.16)] overflow-hidden">
        {/* Текстовая часть */}
        <motion.div style={{ y: titleY }} className="space-y-6 sm:space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-black" />
            {t("landing.hero.badge")}
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-[1.03] text-black whitespace-pre-line">
              {t("landing.hero.title")}
            </h1>
            <p className="max-w-xl text-sm text-neutral-600 leading-relaxed">
              {t("landing.hero.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <MagneticButton onClick={onOpenDemo}>
              {t("landing.hero.primary")}
            </MagneticButton>
            <button
              onClick={() => scrollToId("features")}
              className="text-xs font-medium text-neutral-600 underline underline-offset-4 hover:text-black"
            >
              {t("landing.hero.secondary")}
            </button>
          </div>

          <div className="flex flex-wrap gap-4 text-[11px] text-neutral-500">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-black" />
              {t("landing.hero.points.analytics")}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-black/70" />
              {t("landing.hero.points.roles")}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
              {t("landing.hero.points.api")}
            </div>
          </div>
        </motion.div>

        {/* Правая панель: полезная «Live snapshot» */}
        <motion.div
          style={{ y: panelY }}
          className="relative h-[320px] sm:h-[380px] lg:h-[420px]"
        >
          <div className="absolute inset-0 rounded-[32px] border border-black/10 bg-gradient-to-b from-neutral-50 to-white shadow-[0_30px_70px_rgba(0,0,0,0.16)] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 text-[10px] text-neutral-500">
              <span>{t("landing.heroSnapshot.title")}</span>
              <span className="rounded-full border border-neutral-300 px-2 py-0.5">
                {t("landing.heroSnapshot.live")}
              </span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3 px-6 pt-5 text-[11px] text-neutral-600">
              <div>
                <div className="text-neutral-500">
                  {t("landing.heroSnapshot.newLeads")}
                </div>
                <div className="mt-1 text-lg font-semibold text-black">126</div>
                <div className="mt-0.5 text-[10px] text-neutral-500">
                  {t("landing.heroSnapshot.newLeadsDelta")}
                </div>
              </div>
              <div>
                <div className="text-neutral-500">
                  {t("landing.heroSnapshot.conversion")}
                </div>
                <div className="mt-1 text-lg font-semibold text-black">
                  18,7%
                </div>
                <div className="mt-0.5 text-[10px] text-neutral-500">
                  {t("landing.heroSnapshot.conversionDelta")}
                </div>
              </div>
              <div>
                <div className="text-neutral-500">
                  {t("landing.heroSnapshot.revenue")}
                </div>
                <div className="mt-1 text-lg font-semibold text-black">
                  € 72K
                </div>
                <div className="mt-0.5 text-[10px] text-neutral-500">
                  {t("landing.heroSnapshot.revenueRange")}
                </div>
              </div>
            </div>

            {/* Mini trend line */}
            <div className="mt-5 px-6">
              <div className="flex items-center justify-between mb-2 text-[10px] text-neutral-500">
                <span>{t("landing.heroSnapshot.revenueTrend")}</span>
                <span>{t("landing.heroSnapshot.allChannels")}</span>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                <svg viewBox="0 0 260 70" className="w-full">
                  <defs>
                    <linearGradient id="heroTrendFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="black" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="black" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={heroAreaPath} fill="url(#heroTrendFill)" />
                  <path
                    d={heroPath}
                    fill="none"
                    stroke="black"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                  />
                  {heroPoints.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={3} fill="black" />
                  ))}
                </svg>
              </div>
            </div>

            {/* Bottom list */}
            <div className="mt-auto px-6 pb-6 pt-4 grid grid-cols-3 gap-3 text-[10px] text-neutral-500">
              <div>
                <div className="text-neutral-500">
                  {t("landing.heroSnapshot.focus")}
                </div>
                <div className="mt-0.5 text-neutral-900 text-[11px]">
                  {t("landing.heroSnapshot.focusValue")}
                </div>
              </div>
              <div>
                <div className="text-neutral-500">
                  {t("landing.heroSnapshot.load")}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                  <div className="h-full w-2/3 bg-black" />
                </div>
              </div>
              <div>
                <div className="text-neutral-500">
                  {t("landing.heroSnapshot.response")}
                </div>
                <div className="mt-0.5 text-neutral-900 text-[11px]">
                  {t("landing.heroSnapshot.responseValue")}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ====================== FEATURES (BENTO) ====================== */

const Features: React.FC = () => {
  const { t } = useTranslation();
  const featureTexts = t("landing.features.items", {
    returnObjects: true,
  }) as { title: string; description: string }[];
  const featureIcons = ["marketing", "sales", "projects", "leads", "tasks"] as const;
  const features = featureTexts.map((item, idx) => ({
    ...item,
    icon: featureIcons[idx] ?? "marketing",
  }));

  const [marketing, sales, projects, leads, tasks] = features;

  const renderLabel = (f: (typeof features)[number], order: number) => (
    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.21em] text-neutral-500">
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-400 text-neutral-800 text-[11px] bg-white">
        {order.toString().padStart(2, "0")}
      </span>
      <OutlineIcon kind={f.icon} />
      <span>{f.title}</span>
    </div>
  );

  return (
    <section id="features" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-black">
            {t("landing.features.title")}
          </h2>
          <p className="mt-2 max-w-md text-sm text-neutral-600">
            {t("landing.features.subtitle")}
          </p>
        </div>
        <p className="text-xs text-neutral-500 max-w-xs">
          {t("landing.features.note")}
        </p>
      </div>

      <motion.div
        className="grid gap-4 md:grid-cols-3 auto-rows-[minmax(180px,1fr)]"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={{
          hidden: { opacity: 0, y: 40 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, staggerChildren: 0.06 },
          },
        }}
      >
        {/* Маркетинг + Продажи */}
        <motion.div
          className="md:col-span-2 grid gap-4 md:grid-cols-2"
          variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
        >
          {[marketing, sales].map((f, idx) => (
            <SpotlightCard key={f.title} className="p-5">
              <div className="flex h-full flex-col justify-between">
                <div className="space-y-3">
                  {renderLabel(f, idx + 1)}
                  <p className="text-sm text-neutral-700">{f.description}</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-neutral-500">
                  <span className="h-[1px] w-6 bg-neutral-400" />
                  {t("landing.features.included")}
                </div>
              </div>
            </SpotlightCard>
          ))}
        </motion.div>

        {/* Проекты + Задачи */}
        <motion.div
          className="flex flex-col gap-4 md:row-span-2"
          variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
        >
          <SpotlightCard className="flex-1 p-5">
            <div className="flex h-full flex-col justify-between">
              <div className="space-y-3">
                {renderLabel(projects, 3)}
                <p className="text-sm text-neutral-700">{projects.description}</p>
              </div>
              <div className="mt-4">
                <div className="h-20 rounded-2xl border border-neutral-200 bg-neutral-50 flex items-center justify-center text-[11px] text-neutral-500">
                  {t("landing.features.projectStatus")}
                </div>
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard className="flex-1 p-5">
            <div className="flex h-full flex-col justify-between">
              <div className="space-y-2">
                {renderLabel(tasks, 5)}
                <p className="text-sm text-neutral-700">{tasks.description}</p>
              </div>
              <div className="mt-3 flex flex-col gap-1.5 text-[11px] text-neutral-600">
                <div className="flex items-center justify-between">
                  <span>{t("landing.features.today")}</span>
                  <span>{t("landing.features.tasksToday")}</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                  <div className="h-full w-2/3 bg-black" />
                </div>
              </div>
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Лиды */}
        <motion.div
          className="md:col-span-2"
          variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
        >
          <SpotlightCard className="p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2 max-w-sm">
                {renderLabel(leads, 4)}
                <p className="text-sm text-neutral-700">{leads.description}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-[11px] text-neutral-600">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-[10px] text-neutral-500">Live</div>
                  <div className="mt-1 text-sm font-semibold text-black">+42</div>
                  <div className="mt-1 text-[10px]">
                    {t("landing.features.leadsLive")}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-[10px] text-neutral-500">
                    {t("landing.features.qualified")}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-black">78%</div>
                  <div className="mt-1 text-[10px]">
                    {t("landing.features.qualifiedHint")}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-[10px] text-neutral-500">
                    {t("landing.features.routing")}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-black">
                    {t("landing.features.routingValue")}
                  </div>
                  <div className="mt-1 text-[10px]">
                    {t("landing.features.routingHint")}
                  </div>
                </div>
              </div>
            </div>
          </SpotlightCard>
        </motion.div>
      </motion.div>
    </section>
  );
};

/* ====================== ANALYTICS ====================== */

const AnalyticsSection: React.FC = () => {
  const { t } = useTranslation();
  // точки для большого линейного графика
  const revenuePoints = [
    { x: 10, y: 90 },
    { x: 60, y: 60 },
    { x: 120, y: 50 },
    { x: 170, y: 65 },
    { x: 215, y: 72 },
    { x: 260, y: 45 },
    { x: 290, y: 30 },
  ];
  const revenuePath = `M${revenuePoints
    .map((p) => `${p.x},${p.y}`)
    .join(" L ")}`;
  const revenueAreaPath = `${revenuePath} L ${
    revenuePoints[revenuePoints.length - 1].x
  },110 L ${revenuePoints[0].x},110 Z`;

  return (
    <section id="analytics" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-black">
            {t("landing.analytics.title")}
          </h2>
          <p className="mt-2 max-w-md text-sm text-neutral-600">
            {t("landing.analytics.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-full border border-black bg-black px-4 py-2 text-xs font-semibold text-white uppercase tracking-[0.16em]">
            {t("landing.analytics.cta")}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.05fr,0.95fr]">
        <motion.div
          className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-[0_12px_35px_rgba(0,0,0,0.05)] space-y-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                {t("landing.analytics.campaigns.label")}
              </div>
              <div className="text-sm font-semibold text-black">
                {t("landing.analytics.campaigns.range")}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-black">+34,2%</div>
              <div className="text-[11px] text-neutral-500">
                {t("landing.analytics.campaigns.delta")}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
              <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-2">
                <span>{t("landing.analytics.spend.title")}</span>
                <span>{t("landing.analytics.spend.region")}</span>
              </div>
              <motion.svg
                viewBox="0 0 300 120"
                className="w-full h-36 sm:h-40"
                preserveAspectRatio="xMidYMid meet"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 1.0, ease: "easeInOut" }}
              >
                <defs>
                  <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="black" stopOpacity="0.16" />
                    <stop offset="90%" stopColor="black" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={revenueAreaPath} fill="url(#lineFill)" />
                <path
                  d={revenuePath}
                  fill="none"
                  stroke="black"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
                {revenuePoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3.8} fill="black" />
                ))}
              </motion.svg>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-neutral-600">
                <div>{t("landing.analytics.spend.ctr")}</div>
                <div>{t("landing.analytics.spend.cpl")}</div>
                <div>{t("landing.analytics.spend.cr")}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 space-y-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                {t("landing.analytics.metrics.title")}
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px] text-neutral-600">
                <DonutStat label={t("landing.analytics.metrics.conversion")} percent={19.4} />
                <DonutStat label={t("landing.analytics.metrics.sla")} percent={72.0} />
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 col-span-2">
                  <div className="text-neutral-500 mb-1">
                    {t("landing.analytics.metrics.avgCheck")}
                  </div>
                  <div className="text-lg font-semibold text-black">€ 680</div>
                  <div className="text-[10px] text-neutral-500">
                    {t("landing.analytics.metrics.region")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-[0_12px_35px_rgba(0,0,0,0.05)] space-y-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-sm font-semibold text-black">
                {t("landing.analytics.channels.title")}
              </h3>
              <p className="text-[11px] text-neutral-500">
                {t("landing.analytics.channels.subtitle")}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-black">61,3%</div>
              <div className="text-[11px] text-neutral-500">
                {t("landing.analytics.channels.avg")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <DonutStat label={t("landing.analytics.channels.items.ads")} percent={62.4} />
            <DonutStat label={t("landing.analytics.channels.items.meta")} percent={74.1} />
            <DonutStat label={t("landing.analytics.channels.items.telegram")} percent={55.3} />
            <DonutStat label={t("landing.analytics.channels.items.organic")} percent={69.8} />
            <DonutStat label={t("landing.analytics.channels.items.direct")} percent={48.6} />
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-[11px] text-neutral-600 space-y-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
              {t("landing.analytics.sources.title")}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <div className="text-sm font-semibold text-black">
                  {t("landing.analytics.sources.bookings.title")}
                </div>
                <div>{t("landing.analytics.sources.bookings.sites")}</div>
                <div>{t("landing.analytics.sources.bookings.leads")}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-black">
                  {t("landing.analytics.sources.performance.title")}
                </div>
                <div>{t("landing.analytics.sources.performance.channels")}</div>
                <div>{t("landing.analytics.sources.performance.leads")}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-black">
                  {t("landing.analytics.sources.partners.title")}
                </div>
                <div>{t("landing.analytics.sources.partners.channels")}</div>
                <div>{t("landing.analytics.sources.partners.leads")}</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ====================== DASHBOARD PREVIEW ====================== */

const DashboardPreview: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section id="dashboard" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-black">
            {t("landing.dashboard.title")}
          </h2>
          <p className="mt-2 max-w-md text-sm text-neutral-600">
            {t("landing.dashboard.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-full border border-black bg-black px-4 py-2 text-xs font-semibold text-white uppercase tracking-[0.16em]">
            {t("landing.dashboard.cta")}
          </button>
        </div>
      </div>

      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
      >
        <div className="relative rounded-[24px] border border-black/10 bg-white/95 backdrop-blur-xl p-4 sm:p-6 shadow-[0_30px_80px_rgba(0,0,0,0.15)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              <span className="h-2 w-2 rounded-full bg-black" />
              {t("landing.dashboard.liveTitle")}
            </div>
            <div className="text-[11px] text-neutral-500">
              {t("landing.dashboard.last24h")}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[0.9fr,1.1fr]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-black bg-black px-3 py-2.5 text-xs text-white">
                <div className="text-[11px] text-white/70 mb-1">
                  {t("landing.dashboard.todayAds")}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {t("landing.dashboard.growthChannels")}
                    </div>
                    <div className="text-[11px] text-white/60">
                      {t("landing.dashboard.kpiDelta")}
                    </div>
                  </div>
                  <div className="text-right text-[10px]">
                    <div>{t("landing.dashboard.budget")}</div>
                    <div className="mt-0.5 h-1.5 w-14 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full w-3/4 bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-3 text-[11px] text-neutral-600 space-y-1.5">
                {(
                  t("landing.dashboard.channelList", {
                    returnObjects: true,
                  }) as string[]
                ).map((row) => (
                  <div
                    key={row}
                    className="flex items-center justify-between rounded-xl px-2 py-1 hover:bg-neutral-50"
                  >
                    <span>{row}</span>
                    <span className="h-1 w-10 rounded-full bg-neutral-200">
                      <span className="block h-full w-1/2 bg-black" />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-neutral-500">
                    {t("landing.dashboard.realtime")}
                  </div>
                  <div className="text-sm font-semibold text-black">
                    {t("landing.dashboard.realtimeHint")}
                  </div>
                </div>
                <div className="flex gap-1.5 text-[10px] text-neutral-500">
                  <span className="rounded-full border border-neutral-300 px-2 py-0.5">
                    Live
                  </span>
                  <span className="rounded-full border border-neutral-300 px-2 py-0.5">
                    24h
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 text-[11px] text-neutral-600">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-neutral-500 mb-1">CPA</div>
                  <div className="text-lg font-semibold text-black">€ 18.4</div>
                  <div className="mt-1 text-[10px] text-neutral-500">
                    {t("landing.dashboard.cpaDelta")}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-neutral-500 mb-1">
                    {t("landing.dashboard.leads")}
                  </div>
                  <div className="text-lg font-semibold text-black">+186</div>
                  <div className="mt-1 text-[10px] text-neutral-500">
                    {t("landing.dashboard.leadsHint")}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-neutral-500 mb-1">
                    {t("landing.dashboard.revenue")}
                  </div>
                  <div className="text-lg font-semibold text-black">
                    € 240K
                  </div>
                  <div className="mt-1 text-[10px] text-neutral-500">
                    {t("landing.dashboard.revenueHint")}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
                <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-3">
                  <span>{t("landing.dashboard.plan")}</span>
                  <span>{t("landing.dashboard.planTime")}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white overflow-hidden mb-2">
                  <div className="h-full w-2/3 bg-black" />
                </div>
                <div className="flex justify-between text-[10px] text-neutral-500">
                  {(t("landing.dashboard.planItems", {
                    returnObjects: true,
                  }) as string[]).map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

/* ====================== SECURITY ====================== */

const SecuritySection: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section id="security" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-black">
            {t("landing.security.title")}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-neutral-600">
            {t("landing.security.subtitle")}
          </p>
        </div>
        <p className="text-xs text-neutral-500 max-w-xs">
          {t("landing.security.note")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr,1.1fr]">
        <div className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>{t("landing.security.dataContour")}</span>
            <span className="rounded-full border border-neutral-300 px-2 py-0.5">
              Live
            </span>
          </div>
          <div className="space-y-3 text-sm text-neutral-700">
            <div className="flex items-start gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-black" />
              <div>
                {t("landing.security.items.encrypt")}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-neutral-500" />
              <div>{t("landing.security.items.redis")}</div>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-neutral-400" />
              <div>{t("landing.security.items.publicApi")}</div>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-neutral-300" />
              <div>{t("landing.security.items.audit")}</div>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-[11px] text-neutral-600 space-y-2">
            <div className="flex items-center justify-between">
              <span>JWT</span>
              <span>{t("landing.security.tokens.jwt")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("landing.security.tokens.refresh")}</span>
              <span>{t("landing.security.tokens.refreshTtl")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("landing.security.tokens.webhooks")}</span>
              <span>{t("landing.security.tokens.webhooksHint")}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
            <span>{t("landing.security.operations.title")}</span>
            <span>{t("landing.security.operations.range")}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 text-[11px] text-neutral-600">
            {(t("landing.security.operations.items", {
              returnObjects: true,
            }) as { label: string; value: string; muted?: boolean }[]).map(
              (item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
              >
                <div className="text-neutral-500 mb-1">{item.label}</div>
                <div className="text-lg font-semibold text-black">
                  {item.value}
                </div>
                {item.muted && (
                  <div className="mt-1 text-[10px] text-neutral-500">
                    {t("landing.security.operations.mutedNote")}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-2">
              <span>{t("landing.security.whyTitle")}</span>
            </div>
            <ul className="space-y-1.5 text-[12px] text-neutral-600">
              {(t("landing.security.whyItems", {
                returnObjects: true,
              }) as string[]).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ====================== INTEGRATIONS ====================== */

const IntegrationsSection: React.FC = () => {
  const { t } = useTranslation();
  const items = t("landing.integrations.items", {
    returnObjects: true,
  }) as { title: string; desc: string; status: string; load: number }[];

  return (
    <section id="integrations" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-black">
            {t("landing.integrations.title")}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-neutral-600">
            {t("landing.integrations.subtitle")}
          </p>
        </div>
        <p className="text-xs text-neutral-500 max-w-xs">
          {t("landing.integrations.note")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.04)] space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-black">
                  {item.title}
                </div>
                <div className="text-[11px] text-neutral-500">{item.desc}</div>
              </div>
              <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                {item.status}
              </span>
            </div>
            <div className="text-[11px] text-neutral-500">
              {t("landing.integrations.load")}
            </div>
            <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-black"
                style={{ width: `${item.load}%` }}
              />
            </div>
            <div className="text-[11px] text-neutral-500">
              {t("landing.integrations.example")}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ====================== PARTNERS ====================== */

const PartnersSection: React.FC = () => {
  const { t } = useTranslation();
  const partners = t("landing.partners.items", {
    returnObjects: true,
  }) as { name: string; region: string; uplift: string }[];

  return (
    <section id="partners" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-black">
            {t("landing.partners.title")}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-neutral-600">
            {t("landing.partners.subtitle")}
          </p>
        </div>
        <p className="text-xs text-neutral-500 max-w-xs">
          {t("landing.partners.note")}
        </p>
      </div>

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.03),transparent_55%)] pointer-events-none" />
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {partners.map((p) => (
            <div
              key={p.name}
              className="min-w-[280px] flex-1 rounded-3xl border border-neutral-200 bg-white p-5 flex flex-col justify-between hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition-shadow"
            >
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  <span className="h-6 w-6 rounded-full border border-neutral-300 flex items-center justify-center text-[11px] font-semibold text-neutral-700">
                    ●
                  </span>
                  {p.region}
                </div>
                <div className="text-lg font-semibold text-black">{p.name}</div>
                <div className="text-[12px] text-neutral-600">
                  {t("landing.partners.card")}
                </div>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-1 text-[11px] text-neutral-700">
                <span className="h-2 w-2 rounded-full bg-black" />
                {p.uplift}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ====================== ANALYTICS SHOWCASE ====================== */

const AnalyticsShowcase: React.FC = () => {
  const { t } = useTranslation();
  const channelRows = t("landing.showcase.channels", {
    returnObjects: true,
  }) as {
    label: string;
    current: number;
    prev: number;
    growth: string;
    orders: number;
    revenue: string;
  }[];
  const topChannels = t("landing.showcase.topChannels.items", {
    returnObjects: true,
  }) as { name: string; share: number; sales: number }[];
  return (
    <section id="analytics-showcase" className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                {t("landing.showcase.label")}
              </div>
              <div className="text-sm font-semibold text-black">
                {t("landing.showcase.title")}
              </div>
            </div>
            <div className="text-right text-xs text-neutral-600">
              {t("landing.showcase.delta")}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-2">
                <span>{t("landing.showcase.ordersByChannel")}</span>
                <span>{t("landing.showcase.period")}</span>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                <div className="flex items-center justify-between text-[10px] text-neutral-500 mb-2">
                  <span>{t("landing.showcase.channel")}</span>
                  <span>{t("landing.showcase.growth")}</span>
                </div>
                <div className="space-y-3">
                  {channelRows.map((row) => (
                    <div key={row.label} className="group relative flex items-center gap-3">
                      <div className="w-16 text-[10px] text-neutral-500">{row.label}</div>
                      <div className="flex-1 space-y-1">
                        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-black"
                            style={{ width: `${row.current}%` }}
                          />
                        </div>
                        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-neutral-400"
                            style={{ width: `${row.prev}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-12 text-right text-[10px] text-neutral-500">
                        {row.growth}
                      </div>
                      <div className="pointer-events-none absolute right-0 top-0 -translate-y-[110%] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <div className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-600 shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
                          {t("landing.showcase.ordersTooltip", {
                            count: row.orders,
                            revenue: row.revenue,
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-neutral-600">
                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center">
                  {t("landing.showcase.prevPeriod")}
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center">
                  {t("landing.showcase.currentPeriod")}
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center">
                  {t("landing.showcase.median")}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                {t("landing.showcase.kpiTitle")}
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px] text-neutral-600">
                <DonutStat label={t("landing.showcase.kpi.cr")} percent={19.4} />
                <DonutStat label={t("landing.showcase.kpi.sla")} percent={72.0} />
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 col-span-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-neutral-500 mb-1">
                            {t("landing.showcase.kpi.avgCheck")}
                          </div>
                          <div className="text-lg font-semibold text-black">
                            € 680
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {t("landing.showcase.kpi.region")}
                          </div>
                        </div>
                        <div>
                          <div className="text-neutral-500 mb-1">LTV</div>
                          <div className="text-lg font-semibold text-black">
                            € 1 920
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {t("landing.showcase.kpi.median")}
                          </div>
                        </div>
                      </div>
                    </div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-600">
                {t("landing.showcase.leadChannel")}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] space-y-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
            {t("landing.showcase.topChannels.title")}
          </div>
          <div className="space-y-3 text-sm text-neutral-700">
            {topChannels.map((c) => (
              <div key={c.name} className="group rounded-2xl border border-neutral-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span>{c.name}</span>
                  <span className="text-[11px] text-neutral-500">
                    {c.share}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className="h-full rounded-full bg-black" style={{ width: `${c.share}%` }} />
                </div>
                <div className="mt-2 text-[10px] text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("landing.showcase.topChannels.sales", { count: c.sales })}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-600">
            {t("landing.showcase.topChannels.note")}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ====================== FOOTER ====================== */

const Footer: React.FC = () => {
  const { t } = useTranslation();
  return (
    <footer className="mt-24 bg-black text-white">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 xl:px-12 py-12 sm:py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2">
              <div className="h-7 w-7 rounded-xl border border-white flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-white" />
              </div>
              <span className="text-xs font-semibold tracking-[0.16em] uppercase">
                Lumiva CRM
              </span>
            </div>
            <p className="text-xs text-neutral-300 max-w-xs">
              {t("landing.footer.about")}
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold mb-1">
              {t("landing.footer.product.title")}
            </div>
            <ul className="space-y-1 text-neutral-300">
              {(t("landing.footer.product.items", {
                returnObjects: true,
              }) as string[]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold mb-1">
              {t("landing.footer.company.title")}
            </div>
            <ul className="space-y-1 text-neutral-300">
              {(t("landing.footer.company.items", {
                returnObjects: true,
              }) as string[]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold mb-1">
              {t("landing.footer.contacts.title")}
            </div>
            <ul className="space-y-1 text-neutral-300">
              {(t("landing.footer.contacts.items", {
                returnObjects: true,
              }) as string[]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-4 text-[10px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {t("landing.footer.copyright", {
              year: new Date().getFullYear(),
            })}
          </span>
          <div className="flex gap-4">
            <span>{t("landing.footer.privacy")}</span>
            <span>{t("landing.footer.terms")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

/* ====================== MAIN LANDING PAGE ====================== */

const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [cookiesAccepted, setCookiesAccepted] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [utmPayload, setUtmPayload] = useState<Record<string, string>>({});
  const [demoForm, setDemoForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneCountry: "+7",
    phoneNumber: "",
    ordersPerMonth: "",
    contactMethod: "",
    consent: false,
    botTrap: "",
  });
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [demoStatus, setDemoStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Простой прелоадер 0–100% БЕЗ текста, только процент
  useEffect(() => {
    let current = 0;
    const total = 1600; // мс
    const stepMs = 20;
    const step = 100 / (total / stepMs);

    const id = window.setInterval(() => {
      current += step;
      if (current >= 100) {
        current = 100;
        window.clearInterval(id);
        setTimeout(() => setLoading(false), 200);
      }
      setProgress(Math.round(current));
    }, stepMs);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ];
    const params = new URLSearchParams(window.location.search);
    const fromUrl: Record<string, string> = {};
    keys.forEach((key) => {
      const value = params.get(key);
      if (value) fromUrl[key] = value;
    });

    if (Object.keys(fromUrl).length > 0) {
      setUtmPayload(fromUrl);
      try {
        window.localStorage.setItem("lumiva_utm", JSON.stringify(fromUrl));
      } catch {}
      return;
    }

    try {
      const cached = window.localStorage.getItem("lumiva_utm");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          setUtmPayload(parsed);
        }
      }
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-white text-black overflow-x-hidden">
      {/* PRELOADER */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-40 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-black transition-[width] duration-100 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs font-medium tracking-[0.25em] uppercase text-neutral-500">
              {progress}%
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 xl:px-12">
        <Header />
        <main className="space-y-20 sm:space-y-28 lg:space-y-32 pb-16 sm:pb-20 lg:pb-24 pt-12 sm:pt-16 lg:pt-20">
          <Hero onOpenDemo={() => setDemoOpen(true)} />
          <Features />
          <AnalyticsSection />
          <DashboardPreview />
          <SecuritySection />
          <IntegrationsSection />
          <PartnersSection />
          <AnalyticsShowcase />
        </main>
      </div>
      <Footer />

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          demoOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          className="absolute inset-0 bg-black/40"
          onClick={() => setDemoOpen(false)}
          aria-label={t("landing.form.close")}
        />
        <div
          className={`absolute inset-0 bg-white transition-transform duration-300 ease-out ${
            demoOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mx-auto h-full max-w-[1440px] px-4 sm:px-6 py-8 sm:py-12 grid gap-8 lg:gap-10 lg:grid-cols-[1.35fr,1fr] overflow-y-auto">
            <div className="space-y-6">
              <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Lumiva CRM
              </div>
              <h2 className="text-4xl sm:text-6xl lg:text-7xl font-semibold text-black leading-[1.05] whitespace-pre-line">
                {t("landing.form.headline")}
              </h2>
              <p className="text-sm text-neutral-600 max-w-md">
                {t("landing.form.sub")}
              </p>
              <div className="flex items-center gap-4 text-[12px] text-neutral-500">
                <span>vlad@lumiva.agency</span>
                <span>+7 499 653 78 83</span>
              </div>
            </div>

            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!demoForm.consent) {
                  setDemoStatus({
                    type: "error",
                    message: t("landing.form.errors.consent"),
                  });
                  return;
                }
                if (!demoForm.firstName || !demoForm.email || !demoForm.phoneNumber) {
                  setDemoStatus({
                    type: "error",
                    message: t("landing.form.errors.required"),
                  });
                  return;
                }
                if (!demoForm.contactMethod) {
                  setDemoStatus({
                    type: "error",
                    message: t("landing.form.errors.contact"),
                  });
                  return;
                }
                setDemoSubmitting(true);
                setDemoStatus(null);
                const phone = `${demoForm.phoneCountry} ${demoForm.phoneNumber}`.trim();
                void fetch("/v1/public/demo-requests", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    firstName: demoForm.firstName,
                    lastName: demoForm.lastName,
                    email: demoForm.email,
                    phone,
                    ordersPerMonth: demoForm.ordersPerMonth,
                    contactMethod: demoForm.contactMethod,
                    botField: demoForm.botTrap || undefined,
                    utm: utmPayload,
                  }),
                })
                  .then((res) => {
                    if (!res.ok) throw new Error(t("landing.form.errors.submit"));
                    return res.json();
                  })
                  .then(() => {
                    setDemoStatus({
                      type: "success",
                      message: t("landing.form.success"),
                    });
                    setDemoForm({
                      firstName: "",
                      lastName: "",
                      email: "",
                      phoneCountry: "+7",
                      phoneNumber: "",
                      ordersPerMonth: "",
                      contactMethod: "",
                      consent: false,
                      botTrap: "",
                    });
                  })
                  .catch(() => {
                    setDemoStatus({
                      type: "error",
                      message: t("landing.form.errors.failed"),
                    });
                  })
                  .finally(() => setDemoSubmitting(false));
              }}
            >
              {demoStatus && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    demoStatus.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  {demoStatus.message}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.name")} *
                  <input
                    className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                    value={demoForm.firstName}
                    onChange={(e) =>
                      setDemoForm((s) => ({ ...s, firstName: e.target.value }))
                    }
                    placeholder={t("landing.form.placeholders.name")}
                  />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.surname")}
                  <input
                    className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                    value={demoForm.lastName}
                    onChange={(e) =>
                      setDemoForm((s) => ({ ...s, lastName: e.target.value }))
                    }
                    placeholder={t("landing.form.placeholders.surname")}
                  />
                </label>
              </div>
              <input
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                value={demoForm.botTrap}
                onChange={(e) =>
                  setDemoForm((s) => ({ ...s, botTrap: e.target.value }))
                }
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.email")} *
                  <input
                    type="email"
                    className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                    value={demoForm.email}
                    onChange={(e) =>
                      setDemoForm((s) => ({ ...s, email: e.target.value }))
                    }
                    placeholder={t("landing.form.placeholders.email")}
                  />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.phone")} *
                  <div className="mt-2 flex gap-2">
                    <select
                      value={demoForm.phoneCountry}
                      onChange={(e) =>
                        setDemoForm((s) => ({
                          ...s,
                          phoneCountry: e.target.value,
                        }))
                      }
                      className="w-28 rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm"
                    >
                      <option value="+7">🇷🇺 +7</option>
                      <option value="+90">🇹🇷 +90</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+49">🇩🇪 +49</option>
                    </select>
                    <input
                      className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                      value={demoForm.phoneNumber}
                      onChange={(e) =>
                        setDemoForm((s) => ({
                          ...s,
                          phoneNumber: e.target.value,
                        }))
                      }
                      placeholder={t("landing.form.placeholders.phone")}
                    />
                  </div>
                </label>
              </div>

              <label className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                {t("landing.form.orders")}
                <input
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                  value={demoForm.ordersPerMonth}
                  onChange={(e) =>
                    setDemoForm((s) => ({ ...s, ordersPerMonth: e.target.value }))
                  }
                  placeholder={t("landing.form.placeholders.orders")}
                />
              </label>

              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  {t("landing.form.contact")} *
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { value: "email", label: t("landing.form.contactOptions.email") },
                    { value: "phone", label: t("landing.form.contactOptions.phone") },
                    { value: "whatsapp", label: t("landing.form.contactOptions.whatsapp") },
                    { value: "telegram", label: t("landing.form.contactOptions.telegram") },
                  ].map((m) => (
                    <label
                      key={m.value}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors ${
                        demoForm.contactMethod === m.value
                          ? m.value === "telegram"
                            ? "border-sky-500 bg-sky-50 text-sky-700"
                            : "border-black bg-neutral-50 text-black"
                          : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
                      }`}
                    >
                      <span>{m.label}</span>
                      <input
                        type="radio"
                        name="contactMethod"
                        value={m.value}
                        checked={demoForm.contactMethod === m.value}
                        onChange={(e) =>
                          setDemoForm((s) => ({
                            ...s,
                            contactMethod: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 px-4 py-3 text-sm">
                <span className="text-neutral-600">
                  {t("landing.form.consent")}{" "}
                  <a
                    href="#privacy-pdf"
                    className="underline underline-offset-4 text-neutral-800"
                  >
                    {t("landing.form.policy")}
                  </a>
                </span>
                <span className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={demoForm.consent}
                    onChange={(e) =>
                      setDemoForm((s) => ({ ...s, consent: e.target.checked }))
                    }
                    className="peer sr-only"
                  />
                  <span className="h-6 w-11 rounded-full bg-neutral-300 transition-colors peer-checked:bg-emerald-500" />
                  <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                </span>
              </label>

              <button
                type="submit"
                disabled={demoSubmitting}
                className="w-full rounded-2xl border border-black bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {demoSubmitting ? t("landing.form.sending") : t("landing.form.send")}
              </button>
            </form>
          </div>
          <button
            onClick={() => setDemoOpen(false)}
            className="absolute right-6 top-6 text-sm text-neutral-500 hover:text-black"
          >
            ✕
          </button>
        </div>
      </div>

      {!cookiesAccepted && (
        <div className="fixed inset-x-0 bottom-4 z-50 px-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.12)] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-neutral-700">
            <div className="space-y-1">
              <div className="font-semibold text-black">
                {t("landing.cookies.title")}
              </div>
              <div className="text-[12px] text-neutral-500">
                {t("landing.cookies.text")}{" "}
                <a
                  href="#cookies-policy"
                  className="underline underline-offset-4 text-neutral-800"
                >
                  {t("landing.cookies.link")}
                </a>
                .
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCookiesAccepted(true)}
                className="rounded-xl border border-black bg-black text-white px-3 py-2 text-sm font-semibold"
              >
                {t("landing.cookies.accept")}
              </button>
              <button
                onClick={() => setCookiesAccepted(true)}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-700"
              >
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
