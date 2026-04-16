// src/pages/TenantDetailsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchTenant,
  fetchTenantLogs,
  type TenantDetail,
  type TenantLog,
  updateTenant,
  requestPasswordResetLink,
  sendPasswordResetEmail,
} from "../api/tenants";
import { apiClient, getApiErrorMessage } from "../api/client";

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU");
};

const TenantDetailsPage: React.FC = () => {
  const { id } = useParams();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [logs, setLogs] = useState<TenantLog[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "errors">("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "2xx" | "4xx" | "5xx"
  >("all");
  const [logSearch, setLogSearch] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIncidents, setOpenIncidents] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const LOG_PRESETS: { label: string; q: string }[] = [
    { label: "Маркетинг", q: "/marketing" },
    { label: "Трафик", q: "traffic" },
    { label: "Интеграции", q: "integration" },
    { label: "Sync", q: "sync" },
  ];

  const crmApiBase =
    import.meta.env.VITE_CRM_API_URL ||
    import.meta.env.VITE_API_BASE ||
    "https://crm.lumiva.agency/v1";

  const crmFrontBase =
    import.meta.env.VITE_CRM_FRONT_URL ||
    "https://crm.lumiva.agency";

  const [resetLoading, setResetLoading] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [sendEmailLoading, setSendEmailLoading] = useState(false);
  const [sendEmailResult, setSendEmailResult] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        if (
          logFilter === "errors" &&
          !(
            (log.statusCode && log.statusCode >= 400) ||
            log.type.toLowerCase().includes("error") ||
            log.type.toLowerCase().includes("denied")
          )
        ) {
          return false;
        }
        if (statusFilter !== "all") {
          const code = log.statusCode || 0;
          if (statusFilter === "2xx" && (code < 200 || code >= 300)) return false;
          if (statusFilter === "4xx" && (code < 400 || code >= 500)) return false;
          if (statusFilter === "5xx" && code < 500) return false;
        }
        if (logSearch.trim()) {
          const q = logSearch.toLowerCase();
          return (
            log.type.toLowerCase().includes(q) ||
            (log.path || "").toLowerCase().includes(q) ||
            (log.message || "").toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [logs, logFilter, statusFilter, logSearch]);

  const paginatedLogs = useMemo(() => {
    const start = (logPage - 1) * logPageSize;
    return filteredLogs.slice(start, start + logPageSize);
  }, [filteredLogs, logPage, logPageSize]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [info, history] = await Promise.all([
        fetchTenant(id),
        fetchTenantLogs(id),
      ]);
      setTenant(info);
      setLogs(history);
      setNotesDraft(info.notes ?? "");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const toggleStatus = async () => {
    if (!tenant) return;
    setActionLoading(true);
    try {
      const nextStatus = tenant.status === "active" ? "blocked" : "active";
      const updated = await updateTenant(tenant.id, { status: nextStatus });
      setTenant((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (err) {
      alert("Не удалось изменить статус: " + getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const toggleApi = async () => {
    if (!tenant) return;
    setActionLoading(true);
    try {
      const updated = await updateTenant(tenant.id, {
        apiEnabled: !tenant.apiEnabled,
      });
      setTenant((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (err) {
      alert("Не удалось изменить API: " + getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const saveNotes = async () => {
    if (!tenant) return;
    setNotesSaving(true);
    try {
      const updated = await updateTenant(tenant.id, {
        notes: notesDraft.trim() || null,
      });
      setTenant((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (err) {
      alert("Не удалось сохранить заметки: " + getApiErrorMessage(err));
    } finally {
      setNotesSaving(false);
    }
  };

  const exportLogsCsv = () => {
    if (!filteredLogs.length) return;
    const headers = [
      "id",
      "type",
      "statusCode",
      "method",
      "path",
      "message",
      "createdAt",
      "meta",
    ];
    const csv = [
      headers.join(","),
      ...filteredLogs.map((log) =>
        headers
          .map((h) => {
            const value =
              h === "meta" ? JSON.stringify(log.meta ?? {}) : (log as any)[h];
            const safe = String(value ?? "").replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `tenant-logs-${tenant?.clientKey || "logs"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportLogsJson = () => {
    if (!filteredLogs.length) return;
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `tenant-logs-${tenant?.clientKey || "logs"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateResetLink = async (opts?: { open?: boolean }) => {
    if (!tenant) return;
    setResetLoading(true);
    try {
      const res = await requestPasswordResetLink(tenant.id);
      setResetLink(res.link);
      copyText(res.link, "reset-link");
      if (opts?.open) {
        window.open(res.link, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      alert("Не удалось сгенерировать ссылку: " + getApiErrorMessage(err));
    } finally {
      setResetLoading(false);
    }
  };

  const sendResetEmail = async () => {
    if (!tenant) return;
    const to = window.prompt(
      "Куда отправить письмо (оставьте пустым, чтобы отправить на ownerEmail)",
      tenant.ownerEmail || "",
    );
    setSendEmailLoading(true);
    setSendEmailResult(null);
    try {
      const res = await sendPasswordResetEmail(tenant.id, to || undefined);
      setSendEmailResult(`Письмо отправлено на ${res.sentTo}`);
    } catch (err) {
      alert("Не удалось отправить письмо: " + getApiErrorMessage(err));
    } finally {
      setSendEmailLoading(false);
    }
  };

  useEffect(() => {
    const fetchIncidents = async () => {
      if (!tenant) return;
      try {
        const res = await apiClient.get(
          `https://status.dev.lumiva.agency/api/incidents?service=${tenant.clientKey}`,
        );
        const list = Array.isArray(res.data) ? res.data : [];
        if (list.length > 0) {
          const titles = list
            .slice(0, 3)
            .map((i: any) => i.title || i.name || "Инцидент")
            .join("; ");
          setOpenIncidents(titles);
        } else {
          setOpenIncidents(null);
        }
      } catch {
        setOpenIncidents(null);
      }
    };
    void fetchIncidents();
  }, [tenant]);

  const statusPillClass = useMemo(() => {
    if (!tenant) return "pl1-pill pl1-pill-gray";
    return tenant.status === "active"
      ? "pl1-pill pl1-pill-green"
      : "pl1-pill pl1-pill-red";
  }, [tenant]);

  const apiPillClass = useMemo(() => {
    if (!tenant) return "pl1-pill pl1-pill-gray";
    return tenant.apiEnabled
      ? "pl1-pill pl1-pill-green"
      : "pl1-pill pl1-pill-gray";
  }, [tenant]);

  const renderSkeleton = (key: string) => (
    <div
      key={key}
      className="animate-pulse h-12 rounded-xl bg-slate-900/70 border border-slate-800/80"
    />
  );

  const copyText = (text: string, key: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied((prev) => (prev === key ? null : prev)), 1200);
      })
      .catch(() => setCopied(null));
  };

  return (
    <div className="pl1-page space-y-4 md:space-y-5">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <Link className="pl1-link-button" to="/tenants">
          ← К списку тенантов
        </Link>
        {tenant && (
          <span className="text-slate-500">
            clientKey: <span className="pl1-mono">{tenant.clientKey}</span>
          </span>
        )}
      </div>

      <div className="pl1-card p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Карточка тенанта
            </div>
            <h2 className="text-2xl font-semibold text-slate-50">
              {tenant ? tenant.name : "Загрузка..."}
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl">
              Детали компании, статус, доступ к API и журнал событий для
              поддержки.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={statusPillClass}>
              {tenant ? tenant.status : "—"}
            </span>
            <button
              type="button"
              className="pl1-btn-outline"
              onClick={() => void toggleStatus()}
              disabled={actionLoading || !tenant}
            >
              {tenant?.status === "active" ? "Заблокировать" : "Разблокировать"}
            </button>
            <span className={apiPillClass}>
              {tenant?.apiEnabled ? "API Вкл" : "API Выкл"}
            </span>
            <button
              type="button"
              className="pl1-btn-outline"
              onClick={() => void toggleApi()}
              disabled={actionLoading || !tenant}
            >
              {tenant?.apiEnabled ? "API Off" : "API On"}
            </button>
          </div>
        </div>

        {error && (
          <div className="pl1-alert pl1-alert-error mt-4">
            <span className="pl1-alert-badge">ERROR</span>
            <span>{error}</span>
          </div>
        )}

        {openIncidents && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Открытые инциденты: {openIncidents}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="pl1-card p-5 md:p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Последние события
              </div>
              <h3 className="text-lg font-semibold text-slate-50 mt-1">
                Логи по тенанту
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="pl1-input"
                placeholder="Поиск по типу/пути/сообщению"
                value={logSearch}
                onChange={(e) => {
                  setLogSearch(e.target.value);
                  setLogPage(1);
                }}
                style={{ width: 220 }}
              />
              <button
                type="button"
                className="pl1-btn-outline px-4 py-[9px] text-sm"
                onClick={() => void loadData()}
                disabled={loading}
              >
                {loading ? "Обновляем…" : "Обновить"}
              </button>
              <select
                className="pl1-select"
                value={logFilter}
                onChange={(e) =>
                  setLogFilter(e.target.value as "all" | "errors")
                }
              >
                <option value="all">Все</option>
                <option value="errors">Только ошибки</option>
              </select>
              <select
                className="pl1-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setLogPage(1);
                }}
              >
                <option value="all">Коды все</option>
                <option value="2xx">2xx</option>
                <option value="4xx">4xx</option>
                <option value="5xx">5xx</option>
              </select>
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                {LOG_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="rounded-full border border-slate-700/80 bg-slate-900/50 px-2.5 py-1 text-[10px] text-slate-200 hover:bg-slate-800/80"
                    onClick={() => {
                      setLogSearch(p.q);
                      setLogFilter("all");
                      setLogPage(1);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="rounded-full border border-slate-700/50 px-2.5 py-1 text-[10px] text-slate-500 hover:text-slate-200"
                  onClick={() => {
                    setLogSearch("");
                    setLogPage(1);
                  }}
                >
                  Сброс
                </button>
              </div>
              <button
                type="button"
                className="pl1-btn-outline px-4 py-[9px] text-sm"
                onClick={exportLogsCsv}
                disabled={!filteredLogs.length}
              >
                Экспорт логов
              </button>
              <button
                type="button"
                className="pl1-btn-outline px-4 py-[9px] text-sm"
                onClick={exportLogsJson}
                disabled={!filteredLogs.length}
              >
                JSON
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {loading &&
              Array.from({ length: 5 }).map((_, i) =>
                renderSkeleton(`log-${i}`),
              )}

            {!loading && logs.length === 0 && (
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-sm text-slate-400">
                Событий пока нет.
              </div>
            )}

            {!loading &&
              paginatedLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-slate-700/80 bg-slate-800/80 px-2 py-1">
                      {log.type}
                    </span>
                    {log.statusCode !== null &&
                      log.statusCode !== undefined && (
                        <span
                          className={`rounded-full border px-2 py-1 ${
                            log.statusCode >= 500
                              ? "border-rose-500/60 bg-rose-500/10 text-rose-100"
                              : log.statusCode >= 400
                                ? "border-amber-500/60 bg-amber-500/10 text-amber-100"
                                : "border-slate-700/80 bg-slate-800/80 text-slate-200"
                          }`}
                        >
                          {log.statusCode}
                        </span>
                      )}
                    {log.method && (
                      <span className="rounded-full border border-slate-700/80 bg-slate-800/80 px-2 py-1">
                        {log.method}
                      </span>
                    )}
                    {log.path && (
                      <span className="text-slate-500 truncate max-w-[200px] md:max-w-[280px]">
                        {log.path}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-sm text-slate-200">
                    {log.message || "—"}
                    {log.meta && (
                      <div className="text-xs text-slate-500 mt-1 break-all">
                        {JSON.stringify(log.meta)}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 text-right">
                    {formatDateTime(log.createdAt)}
                  </div>
                </div>
              ))}

            {!loading && paginatedLogs.length === 0 && filteredLogs.length > 0 && (
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-sm text-slate-400">
                По текущим фильтрам нет записей на этой странице.
              </div>
            )}

            {!loading && filteredLogs.length > logPageSize && (
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div>
                  Показано {(logPage - 1) * logPageSize + 1}-
                  {Math.min(logPage * logPageSize, filteredLogs.length)} из{" "}
                  {filteredLogs.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="pl1-btn-outline"
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    disabled={logPage === 1}
                  >
                    Назад
                  </button>
                  <span>
                    Стр. {logPage} / {Math.ceil(filteredLogs.length / logPageSize)}
                  </span>
                  <button
                    type="button"
                    className="pl1-btn-outline"
                    onClick={() =>
                      setLogPage((p) =>
                        p >= Math.ceil(filteredLogs.length / logPageSize) ? p : p + 1,
                      )
                    }
                    disabled={logPage >= Math.ceil(filteredLogs.length / logPageSize)}
                  >
                    Вперёд
                  </button>
                  <select
                    className="pl1-select"
                    value={logPageSize}
                    onChange={(e) => {
                      setLogPageSize(Number(e.target.value));
                      setLogPage(1);
                    }}
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n} на стр.
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
         </div>
        </div>

        <div className="space-y-4">
          <div className="pl1-card p-5 md:p-6 space-y-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Профиль
            </div>
            {loading && (
              <div className="space-y-2">
                {renderSkeleton("profile-1")}
                {renderSkeleton("profile-2")}
              </div>
            )}

            {tenant && (
              <>
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-2">
                  <div className="text-xs text-slate-500 uppercase tracking-[0.12em]">
                    План
                  </div>
                  <div className="text-sm text-slate-200 font-semibold">
                    {tenant.plan ?? "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-2">
                  <div className="text-xs text-slate-500 uppercase tracking-[0.12em]">
                    Активен до
                  </div>
                  <div className="text-sm text-slate-200 font-semibold">
                    {formatDate(tenant.activeUntil)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-2">
                  <div className="text-xs text-slate-500 uppercase tracking-[0.12em]">
                    Владельцы
                  </div>
                  <div className="text-sm text-slate-200 font-semibold">
                    {tenant.ownerName || "—"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {tenant.ownerEmail || "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-2">
                  <div className="text-xs text-slate-500 uppercase tracking-[0.12em]">
                    Быстрые ссылки
                  </div>
                  <div className="text-xs text-slate-400 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span>Логин для тенанта</span>
                      <a
                        className="pl1-link-button"
                        href={`${crmFrontBase}/login?clientKey=${tenant.clientKey}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Открыть
                      </a>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Страница Billing в CRM</span>
                      <a
                        className="pl1-link-button"
                        href={`${crmFrontBase}/app/billing`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Открыть
                      </a>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Публичные тарифы (renew)</span>
                      <a
                        className="pl1-link-button"
                        href={`${crmFrontBase}/pricing?renew=1`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Открыть
                      </a>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Сброс пароля</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="pl1-btn-outline text-xs"
                          onClick={() => void generateResetLink({ open: true })}
                          disabled={resetLoading}
                        >
                          {resetLoading ? "Генерируем…" : "Открыть"}
                        </button>
                        <button
                          type="button"
                          className="pl1-btn-outline text-xs"
                          onClick={() => void generateResetLink()}
                          disabled={resetLoading}
                        >
                          {resetLoading ? "…" : "Токен"}
                        </button>
                      </div>
                    </div>
                    {resetLink && (
                      <div className="text-[11px] text-emerald-200 break-all">
                        Ссылка с токеном скопирована и доступна ниже:
                        <div className="mt-1">{resetLink}</div>
                        <button
                          type="button"
                          className="pl1-link-button"
                          onClick={() => copyText(resetLink, "reset-link")}
                        >
                          Скопировать ещё раз
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="pl1-btn-primary text-xs"
                        onClick={() => void sendResetEmail()}
                        disabled={sendEmailLoading}
                      >
                        {sendEmailLoading ? "Отправляем…" : "Отправить письмо"}
                      </button>
                      {sendEmailResult && (
                        <span className="text-[11px] text-emerald-200">
                          {sendEmailResult}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-2">
                  <div className="text-xs text-slate-500 uppercase tracking-[0.12em]">
                    Notes
                  </div>
                  <textarea
                    className="pl1-input"
                    rows={4}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="pl1-btn-outline"
                      onClick={() => void saveNotes()}
                      disabled={notesSaving}
                    >
                      {notesSaving ? "Сохраняем…" : "Сохранить"}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-2">
                  <div className="text-xs text-slate-500 uppercase tracking-[0.12em]">
                    API Playground
                  </div>
                  <div className="text-xs text-slate-400">
                    Используйте токен тенанта и clientKey в запросах к CRM API.
                  </div>
                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-200 font-mono space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Проверка health</span>
                      <button
                        type="button"
                        className="pl1-btn-ghost"
                        onClick={() =>
                          copyText(
                            `curl -H "X-Api-Token: <TOKEN>" ${crmApiBase}/health`,
                            "curl-health",
                          )
                        }
                      >
                        {copied === "curl-health" ? "Скопировано" : "Копировать"}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-[11px]">
{`curl -H "X-Api-Token: <TOKEN>" ${crmApiBase}/health`}
                    </pre>
                  </div>

                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-200 font-mono space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Список лидов</span>
                      <button
                        type="button"
                        className="pl1-btn-ghost"
                        onClick={() =>
                          copyText(
                            `curl -H "X-Api-Token: <TOKEN>" ${crmApiBase}/leads?clientKey=${tenant.clientKey}`,
                            "curl-leads",
                          )
                        }
                      >
                        {copied === "curl-leads" ? "Скопировано" : "Копировать"}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-[11px]">
{`curl -H "X-Api-Token: <TOKEN>" ${crmApiBase}/leads?clientKey=${tenant.clientKey}`}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantDetailsPage;
