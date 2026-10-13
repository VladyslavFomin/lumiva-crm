// src/pages/ContentPage.tsx
// «Контент»: ссылки на видео/gif к подсказкам CRM. Для каждой страницы — видео-гайд
// (окно «?») и по одному месту на каждый шаг тура. Нет ссылки — подсказка только текстом.
import React, { useEffect, useMemo, useState } from "react";
import {
  fetchHelpCatalog,
  saveHelpMedia,
  PAGE_GUIDE_STEP,
  type HelpCatalog,
  type HelpCatalogPage,
  type HelpMediaKind,
  type HelpMediaRow,
} from "../api/helpContent";

type Filter = "all" | "empty" | "filled";

const mediaKey = (topic: string, stepId: string) => `${topic}::${stepId}`;

/** YouTube / Vimeo / Loom → адрес для встраивания (так же, как в CRM). */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const id = u.searchParams.get("v") || u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.match(/\/(\d+)/)?.[1];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (host === "player.vimeo.com") return url;
    if (host === "loom.com") {
      const id = u.pathname.match(/\/(?:share|embed)\/([^/?]+)/)?.[1];
      if (id) return `https://www.loom.com/embed/${id}`;
    }
  } catch {
    /* не URL */
  }
  return null;
}

/** По расширению угадываем тип, чтобы не переключать вручную в типичных случаях. */
function guessKind(url: string, current: HelpMediaKind): HelpMediaKind {
  if (/\.gif(\?|#|$)/i.test(url)) return "gif";
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) || embedUrl(url)) return "video";
  return current;
}

const MediaPreview: React.FC<{ kind: HelpMediaKind; url: string }> = ({ kind, url }) => {
  const box = "mt-3 overflow-hidden rounded-2xl border border-slate-800 bg-black/40 max-w-md";
  if (kind === "gif") {
    return (
      <div className={box}>
        <img src={url} alt="" className="block w-full max-h-72 object-contain" />
      </div>
    );
  }
  const embed = embedUrl(url);
  return (
    <div className={box}>
      {embed ? (
        <iframe src={embed} title="preview" className="block aspect-video w-full" allowFullScreen />
      ) : (
        <video src={url} className="block w-full max-h-72" controls muted playsInline preload="metadata" />
      )}
    </div>
  );
};

const MediaSlot: React.FC<{
  topic: string;
  stepId: string;
  label: React.ReactNode;
  hint?: string;
  value: HelpMediaRow | undefined;
  onSaved: (row: HelpMediaRow | null) => void;
}> = ({ topic, stepId, label, hint, value, onSaved }) => {
  const [url, setUrl] = useState(value?.url || "");
  const [kind, setKind] = useState<HelpMediaKind>((value?.kind as HelpMediaKind) || "video");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setUrl(value?.url || "");
    setKind((value?.kind as HelpMediaKind) || "video");
  }, [value?.url, value?.kind]);

  const dirty = url.trim() !== (value?.url || "") || (!!url.trim() && kind !== (value?.kind || "video"));

  const save = async (nextUrl = url, nextKind = kind) => {
    setSaving(true);
    setError(null);
    try {
      const res = await saveHelpMedia({ topic, stepId, kind: nextKind, url: nextUrl.trim() });
      onSaved(res.url ? { topic, stepId, kind: res.kind as HelpMediaKind, url: res.url, updatedAt: res.updatedAt } : null);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1600);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-100">{label}</div>
          {hint && <div className="mt-0.5 text-xs text-slate-500 line-clamp-2">{hint}</div>}
        </div>
        <span
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
            value?.url ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-500",
          ].join(" ")}
        >
          {value?.url ? (value.kind === "gif" ? "GIF" : "Видео") : "Только текст"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-slate-700/70 p-0.5 text-xs">
          {(["video", "gif"] as HelpMediaKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={[
                "rounded-lg px-3 py-1 transition",
                kind === k ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {k === "video" ? "Видео" : "GIF"}
            </button>
          ))}
        </div>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setKind((cur) => guessKind(e.target.value, cur));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && dirty) void save();
          }}
          placeholder="https://youtu.be/… · https://…/clip.mp4 · https://…/step.gif"
          className="min-w-[220px] flex-1 rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500/60 focus:outline-none"
        />
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-default disabled:opacity-30"
        >
          {saving ? "…" : justSaved ? "Сохранено" : "Сохранить"}
        </button>
        {value?.url && (
          <>
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              className="rounded-xl border border-slate-700/70 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            >
              {preview ? "Скрыть" : "Просмотр"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setUrl("");
                void save("", kind);
              }}
              className="rounded-xl border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
            >
              Убрать
            </button>
          </>
        )}
      </div>
      {error && <div className="mt-2 text-xs text-rose-300">{error}</div>}
      {preview && value?.url && <MediaPreview kind={value.kind as HelpMediaKind} url={value.url} />}
    </div>
  );
};

const PageCard: React.FC<{
  page: HelpCatalogPage;
  media: Map<string, HelpMediaRow>;
  open: boolean;
  onToggle: () => void;
  filter: Filter;
  onSaved: (topic: string, stepId: string, row: HelpMediaRow | null) => void;
}> = ({ page, media, open, onToggle, filter, onSaved }) => {
  const slots = [PAGE_GUIDE_STEP, ...page.steps.map((s) => s.id)];
  const filled = slots.filter((id) => media.has(mediaKey(page.topic, id))).length;
  const visible = (id: string) => {
    const has = media.has(mediaKey(page.topic, id));
    return filter === "all" || (filter === "filled" ? has : !has);
  };

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span
          className={["text-slate-500 transition-transform duration-200", open ? "rotate-90" : ""].join(" ")}
          aria-hidden
        >
          ▸
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-100">{page.title}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            <span className="font-mono">{page.topic}</span>
            {" · "}
            {page.steps.length ? `${page.steps.length} шагов тура` : "тура пока нет — только видео-гайд"}
          </div>
        </div>
        <span
          className={[
            "rounded-full px-2.5 py-1 text-xs tabular-nums",
            filled === slots.length
              ? "bg-emerald-500/15 text-emerald-300"
              : filled
                ? "bg-sky-500/15 text-sky-300"
                : "bg-slate-800 text-slate-500",
          ].join(" ")}
        >
          {filled} / {slots.length}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-slate-800/70 px-5 py-4">
          {visible(PAGE_GUIDE_STEP) && (
            <MediaSlot
              topic={page.topic}
              stepId={PAGE_GUIDE_STEP}
              label={
                <>
                  <span className="mr-2 rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-indigo-300">
                    Гайд
                  </span>
                  Видео-гайд страницы — в окне «?»
                </>
              }
              value={media.get(mediaKey(page.topic, PAGE_GUIDE_STEP))}
              onSaved={(row) => onSaved(page.topic, PAGE_GUIDE_STEP, row)}
            />
          )}
          {page.steps.map((s, i) =>
            visible(s.id) ? (
              <MediaSlot
                key={s.id}
                topic={page.topic}
                stepId={s.id}
                label={
                  <>
                    <span className="mr-2 font-mono text-xs text-slate-500">Шаг {i + 1}</span>
                    {s.title}
                  </>
                }
                hint={s.body}
                value={media.get(mediaKey(page.topic, s.id))}
                onSaved={(row) => onSaved(page.topic, s.id, row)}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
};

const ContentPage: React.FC = () => {
  const [catalog, setCatalog] = useState<HelpCatalog | null>(null);
  const [media, setMedia] = useState<Map<string, HelpMediaRow>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openPages, setOpenPages] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHelpCatalog();
      setCatalog(data);
      setMedia(new Map(data.media.map((m) => [mediaKey(m.topic, m.stepId), m])));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не удалось загрузить контент");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSaved = (topic: string, stepId: string, row: HelpMediaRow | null) => {
    setMedia((prev) => {
      const next = new Map(prev);
      if (row) next.set(mediaKey(topic, stepId), row);
      else next.delete(mediaKey(topic, stepId));
      return next;
    });
  };

  const slotCount = (p: HelpCatalogPage) => 1 + p.steps.length;
  const filledCount = (p: HelpCatalogPage) =>
    [PAGE_GUIDE_STEP, ...p.steps.map((s) => s.id)].filter((id) => media.has(mediaKey(p.topic, id))).length;

  const groupStats = useMemo(() => {
    const stats = new Map<string, { pages: number; slots: number; filled: number }>();
    for (const p of catalog?.pages || []) {
      const s = stats.get(p.group) || { pages: 0, slots: 0, filled: 0 };
      s.pages += 1;
      s.slots += slotCount(p);
      s.filled += filledCount(p);
      stats.set(p.group, s);
    }
    return stats;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, media]);

  const totals = useMemo(() => {
    let slots = 0;
    let filled = 0;
    groupStats.forEach((s) => {
      slots += s.slots;
      filled += s.filled;
    });
    return { slots, filled };
  }, [groupStats]);

  const q = query.trim().toLowerCase();
  const pages = (catalog?.pages || []).filter((p) => {
    if (group !== "all" && p.group !== group) return false;
    if (filter === "empty" && filledCount(p) === slotCount(p)) return false;
    if (filter === "filled" && filledCount(p) === 0) return false;
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.topic.toLowerCase().includes(q) ||
      p.steps.some((s) => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q))
    );
  });

  // Поиск или фильтр — раскрываем найденное, чтобы не кликать по каждой странице.
  const autoOpen = !!q || filter !== "all";

  const togglePage = (topic: string) =>
    setOpenPages((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });

  const groupTitle = (id: string) => catalog?.groups.find((g) => g.id === id)?.title || id;

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-50">Контент</h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Видео и gif к подсказкам в CRM. «Гайд» — видео в окне «?» страницы, «Шаг» — картинка
            в окне подсказки рядом с кнопкой. Пустое место — клиент видит только текст.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {catalog && (
            <span className="rounded-full border border-slate-800 px-3 py-1.5 text-xs text-slate-400">
              Заполнено <b className="text-slate-100 tabular-nums">{totals.filled}</b> из{" "}
              <span className="tabular-nums">{totals.slots}</span>
            </span>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-3">
            {[{ id: "all", title: "Все разделы" }, ...(catalog?.groups || [])].map((g) => {
              const s =
                g.id === "all"
                  ? { pages: catalog?.pages.length || 0, ...totals }
                  : groupStats.get(g.id) || { pages: 0, slots: 0, filled: 0 };
              if (g.id !== "all" && !s.pages) return null;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroup(g.id)}
                  className={[
                    "flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left text-sm transition",
                    group === g.id ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100",
                  ].join(" ")}
                >
                  <span className="truncate">{g.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">
                    {s.filled}/{s.slots}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по странице или шагу…"
              className="min-w-[220px] flex-1 rounded-2xl border border-slate-800/70 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500/60 focus:outline-none"
            />
            <div className="inline-flex rounded-2xl border border-slate-800/70 p-1 text-xs">
              {(
                [
                  ["all", "Все"],
                  ["empty", "Без ссылки"],
                  ["filled", "Заполненные"],
                ] as [Filter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={[
                    "rounded-xl px-3 py-1.5 transition",
                    filter === id ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!catalog && loading && <div className="text-sm text-slate-500">Загрузка…</div>}
          {catalog && !pages.length && <div className="text-sm text-slate-500">Ничего не найдено</div>}

          {(group === "all"
            ? (catalog?.groups || []).map((g) => g.id)
            : [group]
          ).map((gid) => {
            const list = pages.filter((p) => p.group === gid);
            if (!list.length) return null;
            return (
              <div key={gid} className="space-y-3">
                {group === "all" && (
                  <h2 className="px-1 pt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{groupTitle(gid)}</h2>
                )}
                {list.map((p) => (
                  <PageCard
                    key={p.topic}
                    page={p}
                    media={media}
                    open={autoOpen || openPages.has(p.topic)}
                    onToggle={() => togglePage(p.topic)}
                    filter={filter}
                    onSaved={onSaved}
                  />
                ))}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
};

export default ContentPage;
