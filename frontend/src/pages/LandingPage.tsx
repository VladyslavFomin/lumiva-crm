// src/pages/LandingPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top, behavior: "smooth" });
};

/* ====================== UI: Magnetic Button ====================== */

const MagneticButton: React.FC<React.PropsWithChildren> = ({ children }) => {
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

/* ====================== HEADER ====================== */

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 mb-10">
      <div className="backdrop-blur-xl bg-white/70 border border-black/5 rounded-3xl mt-3 px-6 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.06)] flex items-center justify-between">
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
            Обзор
          </button>
          <button
            onClick={() => scrollToId("features")}
            className="hover:text-black transition-colors"
          >
            Модули
          </button>
          <button
            onClick={() => scrollToId("analytics")}
            className="hover:text-black transition-colors"
          >
            Аналитика
          </button>
          <button
            onClick={() => scrollToId("dashboard")}
            className="hover:text-black transition-colors"
          >
            Рабочее пространство
          </button>
        </nav>

        {/* Contact */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs font-medium text-neutral-500">
            crm@lumiva.agency
          </span>
          <a
            href="/login"
            className="rounded-full border border-black px-3 py-1.5 text-xs font-semibold tracking-wide uppercase bg-black text-white hover:bg-white hover:text-black transition-colors"
          >
            Вход
          </a>
        </div>
      </div>
    </header>
  );
};

/* ====================== HERO ====================== */

const Hero: React.FC = () => {
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

      <div className="relative grid gap-10 lg:grid-cols-[1.1fr,0.9fr] rounded-[40px] border border-black/8 bg-white/70 px-7 py-10 sm:px-10 sm:py-14 shadow-[0_30px_80px_rgba(0,0,0,0.16)] overflow-hidden">
        {/* Текстовая часть */}
        <motion.div style={{ y: titleY }} className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-black" />
            Платформа управления бизнесом
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-[1.03] text-black">
              Одна спокойная рабочая среда
              <br />
              для{" "}
              <span className="underline decoration-black/20">
                всего вашего бизнеса
              </span>
              .
            </h1>
            <p className="max-w-xl text-sm text-neutral-600 leading-relaxed">
              crm.lumiva.agency объединяет продажи, маркетинг, проекты, лиды и
              задачи в одном минималистичном интерфейсе. Мы спроектировали
              систему вокруг реальных процессов: от заявки с сайта до отчёта по
              выручке и загрузке команды.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <MagneticButton>Запросить демо</MagneticButton>
            <button
              onClick={() => scrollToId("features")}
              className="text-xs font-medium text-neutral-600 underline underline-offset-4 hover:text-black"
            >
              Смотреть модули
            </button>
          </div>

          <div className="flex flex-wrap gap-4 text-[11px] text-neutral-500">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-black" />
              Живая аналитика по сделкам и бронированиям
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-black/70" />
              Роли и права доступа для отделов и партнёров
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
              API и Webhooks для интеграций (сайты, n8n, боты)
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
              <span>Сегодня · Снимок по сети отелей</span>
              <span className="rounded-full border border-neutral-300 px-2 py-0.5">
                Live
              </span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3 px-6 pt-5 text-[11px] text-neutral-600">
              <div>
                <div className="text-neutral-500">Новых лидов</div>
                <div className="mt-1 text-lg font-semibold text-black">126</div>
                <div className="mt-0.5 text-[10px] text-neutral-500">
                  +21% к прошлой неделе
                </div>
              </div>
              <div>
                <div className="text-neutral-500">Конверсия</div>
                <div className="mt-1 text-lg font-semibold text-black">
                  18,7%
                </div>
                <div className="mt-0.5 text-[10px] text-neutral-500">
                  +2,9 п.п.
                </div>
              </div>
              <div>
                <div className="text-neutral-500">Выручка</div>
                <div className="mt-1 text-lg font-semibold text-black">
                  € 72K
                </div>
                <div className="mt-0.5 text-[10px] text-neutral-500">
                  за последние 30 дней
                </div>
              </div>
            </div>

            {/* Mini trend line */}
            <div className="mt-5 px-6">
              <div className="flex items-center justify-between mb-2 text-[10px] text-neutral-500">
                <span>Динамика выручки · 8 недель</span>
                <span>Все каналы в CRM</span>
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
                <div className="text-neutral-500">Фокус</div>
                <div className="mt-0.5 text-neutral-900 text-[11px]">
                  Высокий спрос на лето 2026
                </div>
              </div>
              <div>
                <div className="text-neutral-500">Нагрузка</div>
                <div className="mt-1 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                  <div className="h-full w-2/3 bg-black" />
                </div>
              </div>
              <div>
                <div className="text-neutral-500">Ответ менеджеров</div>
                <div className="mt-0.5 text-neutral-900 text-[11px]">
                  медиана &lt; 3 мин
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
  const features = [
    {
      title: "Маркетинг",
      description:
        "Коннектим сайты, формы, рекламные кампании и SMM в единую воронку, чтобы видеть, что реально приводит выручку.",
    },
    {
      title: "Продажи",
      description:
        "Единый реестр заявок и бронирований с этапами, причинами отказа и планом по выручке по каждому направлению.",
    },
    {
      title: "Проекты",
      description:
        "Управление открытием отелей, спец-акциями и выставками: задачи, дедлайны, ответственные и статусы в одном месте.",
    },
    {
      title: "Лиды",
      description:
        "Заявки с сайтов, онлайн-чата, почты и мессенджеров автоматически нормализуются и связываются с каналом и агентом.",
    },
    {
      title: "Задачи",
      description:
        "Мелкие задачи, привязанные к лидам, проектам и клиентам: без отдельного таск-трекера, но с контролем сроков.",
    },
  ];

  return (
    <section id="features" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-black">
            Одна поверхность — пять ключевых модулей.
          </h2>
          <p className="mt-2 max-w-md text-sm text-neutral-600">
            crm.lumiva.agency заранее «провязана» между маркетингом, продажами,
            проектами, лидами и задачами. Любое действие можно связать с
            конкретной выручкой и источником трафика.
          </p>
        </div>
        <p className="text-xs text-neutral-500 max-w-xs">
          Карточки реагируют на курсор живой подсветкой границы и лёгким
          подъёмом — без лишней анимационной суеты.
        </p>
      </div>

      <motion.div
        className="grid gap-4 md:grid-cols-3 auto-rows-[minmax(160px,1fr)]"
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
          {features.slice(0, 2).map((f) => (
            <SpotlightCard key={f.title} className="p-5">
              <div className="flex h-full flex-col justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.21em] text-neutral-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-black" />
                    {f.title}
                  </div>
                  <p className="text-sm text-neutral-700">{f.description}</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-neutral-500">
                  <span className="h-[1px] w-6 bg-neutral-400" />
                  Связано с аналитикой и отчётами
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
                <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.21em] text-neutral-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-black" />
                  Проекты
                </div>
                <p className="text-sm text-neutral-700">
                  Лонч нового отеля, выставка в Румынии или акция для рынка
                  Польши — всё раскладывается на этапы и задачи с ответственными.
                </p>
              </div>
              <div className="mt-4">
                <div className="h-20 rounded-2xl border border-neutral-200 bg-neutral-50 flex items-center justify-center text-[11px] text-neutral-500">
                  Минималистичная шкала статусов вместо сложного Gantt
                </div>
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard className="flex-1 p-5">
            <div className="flex h-full flex-col justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.21em] text-neutral-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-black" />
                  Задачи
                </div>
                <p className="text-sm text-neutral-700">
                  Звонки агентам, брифы дизайнерам, проверки тарифов — все
                  задачи лежат прямо в CRM, привязанные к конкретным сделкам и
                  партнёрам.
                </p>
              </div>
              <div className="mt-3 flex flex-col gap-1.5 text-[11px] text-neutral-600">
                <div className="flex items-center justify-between">
                  <span>Сегодня</span>
                  <span>13 задач</span>
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
                <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.21em] text-neutral-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-black" />
                  Лиды
                </div>
                <p className="text-sm text-neutral-700">
                  Формы с сайтов, онлайн-чат crm.lumiva.agency, заявки из
                  мессенджеров и таблиц — всё попадает в единую базу с
                  источником, кампанией и ответственным менеджером.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-[11px] text-neutral-600">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-[10px] text-neutral-500">Live</div>
                  <div className="mt-1 text-sm font-semibold text-black">+42</div>
                  <div className="mt-1 text-[10px]">новых за последний час</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-[10px] text-neutral-500">Квалифицировано</div>
                  <div className="mt-1 text-sm font-semibold text-black">78%</div>
                  <div className="mt-1 text-[10px]">совпадение с ICP</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-[10px] text-neutral-500">Роутинг</div>
                  <div className="mt-1 text-sm font-semibold text-black">Мгновенно</div>
                  <div className="mt-1 text-[10px]">по правилам в CRM</div>
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
            Аналитика, которая выглядит как часть страницы.
          </h2>
          <p className="mt-2 max-w-md text-sm text-neutral-600">
            Минимальные по форме, но насыщенные по смыслу графики. Вы видите
            направление и скорость, а не просто красивые диаграммы.
          </p>
        </div>
        <p className="text-xs text-neutral-500 max-w-xs">
          Линейные и столбчатые графики используют только чёрный и серый на
          белом фоне, оставаясь в стилистике crm.lumiva.agency.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Line chart */}
        <motion.div
          className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.04)]"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-black">
                Скорость выручки
              </h3>
              <p className="text-[11px] text-neutral-500">
                Последние 12 недель, суммарно по брендам и рынкам
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-black">+34,2%</div>
              <div className="text-[11px] text-neutral-500">
                к прошлому периоду
              </div>
            </div>
          </div>

          <motion.svg
            viewBox="0 0 300 120"
            className="w-full"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.0, ease: "easeInOut" }}
          >
            <defs>
              <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="black" stopOpacity="0.22" />
                <stop offset="90%" stopColor="black" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* area */}
            <path d={revenueAreaPath} fill="url(#lineFill)" />
            {/* line */}
            <path
              d={revenuePath}
              fill="none"
              stroke="black"
              strokeWidth={2.6}
              strokeLinecap="round"
            />
            {/* points */}
            {revenuePoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4} fill="black" />
            ))}
          </motion.svg>
        </motion.div>

        {/* Bar chart */}
        <motion.div
          className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.04)]"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-black">
                Воронка и конверсия по модулям
              </h3>
              <p className="text-[11px] text-neutral-500">
                Объём заявок и выигранных сделок по каждому разделу
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-black">61,3%</div>
              <div className="text-[11px] text-neutral-500">
                средняя конверсия по сети
              </div>
            </div>
          </div>

          <div className="flex h-40 items-end gap-3">
            {[
              { label: "Маркетинг", value: 80 },
              { label: "Продажи", value: 100 },
              { label: "Проекты", value: 60 },
              { label: "Лиды", value: 90 },
              { label: "Задачи", value: 50 },
            ].map((b, idx) => (
              <motion.div
                key={b.label}
                className="flex-1 flex flex-col justify-end"
                initial={{ opacity: 0, scaleY: 0.3 }}
                whileInView={{ opacity: 1, scaleY: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.8, delay: 0.2 + idx * 0.06 }}
                style={{ transformOrigin: "bottom" }}
              >
                <div
                  className="rounded-2xl bg-black/90"
                  style={{ height: `${b.value}%` }}
                />
                <div className="mt-2 text-[10px] text-neutral-500 text-center">
                  {b.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ====================== DASHBOARD PREVIEW ====================== */

const DashboardPreview: React.FC = () => {
  return (
    <section id="dashboard" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-black">
            Личный кабинет, который кажется неизбежным.
          </h2>
          <p className="mt-2 max-w-md text-sm text-neutral-600">
            Вся операционная система — в одной стеклянной панели: от отчётов по
            выручке до задач для команды. Достаточно глубины, чтобы чувствовать
            контроль, и ничего лишнего, что тормозит работу.
          </p>
        </div>
        <p className="text-xs text-neutral-500 max-w-xs">
          Плавающая компоновка, плотная типографика и чёрные акценты. Готово
          подключаться к вашему стеку — сайты, боты, n8n, сторонние отчёты.
        </p>
      </div>

      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
      >
        {/* Глубокая тень */}
        <div className="absolute inset-0 translate-y-8 blur-2xl rounded-[40px] bg-black/25" />

        <div className="relative rounded-[32px] border border-black/10 bg-white/90 backdrop-blur-xl p-4 sm:p-6 md:p-7 shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
          {/* Верхняя панель */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-black" />
                <span className="h-2 w-2 rounded-full bg-neutral-800" />
                <span className="h-2 w-2 rounded-full bg-neutral-500" />
              </div>
              <span className="ml-3 text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500">
                Панель управления
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <span>Рабочая область</span>
              <span className="h-4 w-px bg-neutral-300" />
              <span className="rounded-full border border-black/10 px-2 py-0.5">
                v1.0 • Stable
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[0.9fr,1.1fr]">
            {/* Sidebar */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-black bg-black px-3 py-2.5 text-xs text-white">
                <div className="text-[11px] text-white/70 mb-1">Сегодня</div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-sm font-semibold">Общий обзор</div>
                    <div className="text-[11px] text-white/60">
                      4 кампании · 12 активных сделок
                    </div>
                  </div>
                  <div className="text-right text-[10px]">
                    <div>Нагрузка</div>
                    <div className="mt-0.5 h-1.5 w-14 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full w-3/4 bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-3 text-[11px] text-neutral-600 space-y-1.5">
                {[
                  "Маркетинг · 3 активные кампании",
                  "Продажи · 8 сделок в работе",
                  "Проекты · 5 задач по запуску",
                  "Лиды · 24 к обзвону",
                  "Задачи · 18 на этой неделе",
                ].map((row) => (
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

            {/* Main pane */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-neutral-500">
                    Реальное время
                  </div>
                  <div className="text-sm font-semibold text-black">
                    Все модули — в одном кадре
                  </div>
                </div>
                <div className="flex gap-1.5 text-[10px] text-neutral-500">
                  <span className="rounded-full border border-neutral-300 px-2 py-0.5">
                    Live
                  </span>
                  <span className="rounded-full border border-neutral-300 px-2 py-0.5">
                    Последние 24 ч
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 text-[11px] text-neutral-600">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-neutral-500 mb-1">Выручка сегодня</div>
                  <div className="text-lg font-semibold text-black">€ 86 420</div>
                  <div className="mt-1 text-[10px] text-neutral-500">
                    +18,3% к среднему дню
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-neutral-500 mb-1">Новый поток</div>
                  <div className="text-lg font-semibold text-black">€ 240K</div>
                  <div className="mt-1 text-[10px] text-neutral-500">
                    12 новых возможностей
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-neutral-500 mb-1">Фокус дня</div>
                  <div className="text-lg font-semibold text-black">
                    Исполнение
                  </div>
                  <div className="mt-1 text-[10px] text-neutral-500">
                    72% доставка, 28% рост
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
                <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-3">
                  <span>Лента дня</span>
                  <span>09:00 – 19:00</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white overflow-hidden mb-2">
                  <div className="h-full w-2/3 bg-black" />
                </div>
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>Синк по маркетингу</span>
                  <span>Созвон по продажам</span>
                  <span>Окно под доставку</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

/* ====================== FOOTER ====================== */

const Footer: React.FC = () => {
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
              Бело-чёрная операционная система для команд, которым нужен
              контроль над данными без хаоса таблиц и мессенджеров.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold mb-1">Продукт</div>
            <ul className="space-y-1 text-neutral-300">
              <li>Обзор платформы</li>
              <li>Модули</li>
              <li>Безопасность</li>
              <li>API и интеграции</li>
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold mb-1">Компания</div>
            <ul className="space-y-1 text-neutral-300">
              <li>Lumiva Agency</li>
              <li>Партнёры</li>
              <li>Карьера</li>
              <li>Правовая информация</li>
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold mb-1">Контакты</div>
            <ul className="space-y-1 text-neutral-300">
              <li>crm@lumiva.agency</li>
              <li>@lumiva.agency</li>
              <li>LinkedIn</li>
              <li>Dribbble</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-4 text-[10px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Lumiva CRM. Все права защищены.</span>
          <div className="flex gap-4">
            <span>Политика конфиденциальности</span>
            <span>Условия использования</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

/* ====================== MAIN LANDING PAGE ====================== */

const LandingPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

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
        <main className="space-y-32 pb-24 pt-20">
          <Hero />
          <Features />
          <AnalyticsSection />
          <DashboardPreview />
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default LandingPage;