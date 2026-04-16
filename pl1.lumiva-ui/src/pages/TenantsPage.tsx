// src/pages/TenantsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  fetchTenants,
  enableTenant,
  disableTenant,
  setTenantApi,
  createTenant,
  updateTenant,
  deleteTenant as deleteTenantApi,
  type TenantSummary,
  type TenantPlan,
  type CreateTenantDto,
  type UpdateTenantDto,
} from "../api/tenants";
import { getApiErrorMessage } from "../api/client";

type StatusFilter = "all" | "active" | "blocked";
type PlanFilter = "all" | TenantPlan;

const PLAN_OPTIONS: TenantPlan[] = [
  "free_locked",
  "standard",
  "professional",
  "enterprise",
  "ultimate",
];

interface EditTenantForm {
  id: string;
  name: string;
  clientKey: string;
  plan: TenantPlan | "";
  activeUntil: string; // YYYY-MM-DD
  ownerName: string;
  ownerEmail: string;
  apiEnabled: boolean;
  notes: string;
}

interface CreateTenantForm {
  name: string;
  clientKey: string;
  plan: TenantPlan;
  activeUntil: string; // YYYY-MM-DD
  ownerName: string;
  ownerEmail: string;
  apiEnabled: boolean;
}
interface CreateTenantPayload extends CreateTenantDto {
  activeUntil: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  apiEnabled: boolean;
}

const TenantsPage: React.FC = () => {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [savedFilters, setSavedFilters] = useState<
    {
      name: string;
      search: string;
      status: StatusFilter;
      plan: PlanFilter;
      expiringOnly: boolean;
    }[]
  >([]);

  // ---------- создание ----------
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTenantForm>({
    name: "",
    clientKey: "",
    plan: "standard",
    activeUntil: "",
    ownerName: "",
    ownerEmail: "",
    apiEnabled: true,
  });
  const [createLoading, setCreateLoading] = useState(false);

  // ---------- редактирование ----------
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditTenantForm | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  /** Смена clientKey опасна: старые ссылки и интеграции с прежним ключом перестанут работать. */
  const [editClientKeyUnlocked, setEditClientKeyUnlocked] = useState(false);
  const [editOriginalClientKey, setEditOriginalClientKey] = useState("");

  // ---------- импорт CSV ----------
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [auditToast, setAuditToast] = useState<string | null>(null);

  // ---------- загрузка ----------
  const loadTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTenants();
      setTenants(data);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTenants();
  }, []);

  // ---------- сохранённые фильтры ----------
  const FILTERS_KEY = "pl1_tenants_filters";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedFilters(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(savedFilters));
    } catch {
      // ignore
    }
  }, [savedFilters]);

  // ---------- фильтрация ----------
  const filteredTenants = useMemo(() => {
    const now = new Date();
    const expiringThreshold = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    return tenants.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.name.toLowerCase().includes(q) &&
          !t.clientKey.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (planFilter !== "all" && (t.plan || "standard") !== planFilter) {
        return false;
      }

      if (expiringOnly) {
        if (!t.activeUntil) return false;
        const end = new Date(t.activeUntil);
        if (Number.isNaN(end.getTime())) return false;
        if (end < now || end > expiringThreshold) return false;
      }
      return true;
    });
  }, [tenants, search, statusFilter, planFilter, expiringOnly]);

  // ---------- действия со статусом / API ----------
  const toggleStatus = async (tenant: TenantSummary) => {
    try {
      if (tenant.status === "active") {
        await disableTenant(tenant.id);
        setTenants((prev) =>
          prev.map((t) =>
            t.id === tenant.id ? { ...t, status: "blocked" } : t
          )
        );
      } else {
        await enableTenant(tenant.id);
        setTenants((prev) =>
          prev.map((t) =>
            t.id === tenant.id ? { ...t, status: "active" } : t
          )
        );
      }
    } catch (e) {
      alert("Не удалось изменить статус тенанта: " + getApiErrorMessage(e));
    }
  };
  
  const toggleApi = async (tenant: TenantSummary) => {
    try {
      const next = !tenant.apiEnabled;
      await setTenantApi(tenant.id, next);
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id ? { ...t, apiEnabled: next } : t
        )
      );
    } catch (e) {
      alert("Не удалось изменить состояние API: " + getApiErrorMessage(e));
    }
  };


  const deleteTenant = async (tenant: TenantSummary) => {
    const ok = window.confirm(
      `Удалить тенанта "${tenant.name}" (clientKey: ${tenant.clientKey})?\nЭто действие необратимо.`
    );
    if (!ok) return;

    try {
      await deleteTenantApi(tenant.id);
      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
    } catch (e) {
      alert("Не удалось удалить тенант: " + getApiErrorMessage(e));
    }
  };

  // ---------- создание ----------
  const resetCreateForm = () => {
    setCreateForm({
      name: "",
      clientKey: "",
      plan: "standard",
      activeUntil: "",
      ownerName: "",
      ownerEmail: "",
      apiEnabled: true,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.clientKey.trim()) return;

    setCreateLoading(true);
    try {
      const dto: CreateTenantPayload = {
        name: createForm.name.trim(),
        clientKey: createForm.clientKey.trim(),
        plan: createForm.plan,
        activeUntil: createForm.activeUntil
          ? new Date(createForm.activeUntil + "T00:00:00Z").toISOString()
          : null,
        ownerName: createForm.ownerName.trim() || null,
        ownerEmail: createForm.ownerEmail.trim() || null,
        apiEnabled: createForm.apiEnabled,
      };

      const created = await createTenant(dto);
      setTenants((prev) => [created, ...prev]);
      setCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      const msg = getApiErrorMessage(err);
      alert("Не удалось создать тенант: " + msg);
    } finally {
      setCreateLoading(false);
    }
  };

  // ---------- редактирование ----------
  const openEditModal = (t: TenantSummary) => {
    const activeDate = t.activeUntil ? t.activeUntil.slice(0, 10) : "";
    setEditClientKeyUnlocked(false);
    setEditOriginalClientKey(t.clientKey);
    setEditForm({
      id: t.id,
      name: t.name,
      clientKey: t.clientKey,
      plan: t.plan ?? "standard",
      activeUntil: activeDate,
      ownerName: t.ownerName ?? "",
      ownerEmail: t.ownerEmail ?? "",
      apiEnabled: t.apiEnabled,
      notes: t.notes ?? "",
    });
    setEditOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;

    setEditLoading(true);
    try {
      const dto: UpdateTenantDto = {
        name: editForm.name.trim(),
        plan: (editForm.plan || "standard") as TenantPlan,
        activeUntil: editForm.activeUntil
          ? new Date(editForm.activeUntil + "T00:00:00Z").toISOString()
          : null,
        ownerName: editForm.ownerName.trim() || null,
        ownerEmail: editForm.ownerEmail.trim() || null,
        apiEnabled: editForm.apiEnabled,
        notes: editForm.notes.trim() || null,
      };

      if (editClientKeyUnlocked) {
        const nextKey = editForm.clientKey.trim();
        if (!nextKey) {
          alert("Client key не может быть пустым.");
          setEditLoading(false);
          return;
        }
        if (nextKey !== editOriginalClientKey) {
          const ok = window.confirm(
            "Вы меняете clientKey. Все ссылки вида /login?clientKey=… и часть интеграций с прежним ключом перестанут работать. Продолжить?"
          );
          if (!ok) {
            setEditLoading(false);
            return;
          }
          dto.clientKey = nextKey;
        }
      }

      const updated = await updateTenant(editForm.id, dto);
      setTenants((prev) =>
        prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
      );
      setEditOpen(false);
      setEditForm(null);
    } catch (err) {
      const msg = getApiErrorMessage(err);
      alert("Не удалось сохранить изменения: " + msg);
    } finally {
      setEditLoading(false);
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU");
  };

  const daysToExpire = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const diff = d.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const exportCsv = () => {
    const rows = filteredTenants.map((t) => ({
      name: t.name,
      clientKey: t.clientKey,
      status: t.status,
      plan: t.plan ?? "",
      apiEnabled: t.apiEnabled ? "on" : "off",
      activeUntil: t.activeUntil ?? "",
      ownerName: t.ownerName ?? "",
      ownerEmail: t.ownerEmail ?? "",
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    const headers = [
      "name",
      "clientKey",
      "status",
      "plan",
      "apiEnabled",
      "activeUntil",
      "ownerName",
      "ownerEmail",
      "createdAt",
      "updatedAt",
    ];

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((key) => {
            const value = (row as any)[key] ?? "";
            const safe = String(value).replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    link.download = `tenants-${yyyy}${mm}${dd}.csv`;

    link.click();
    URL.revokeObjectURL(url);
  };

  const saveCurrentFilter = () => {
    const name =
      window.prompt("Название фильтра", `Фильтр ${new Date().toLocaleDateString("ru-RU")}`)?.trim() ||
      "";
    if (!name) return;

    setSavedFilters((prev) => {
      const rest = prev.filter((f) => f.name !== name);
      return [
        ...rest,
        {
          name,
          search,
          status: statusFilter,
          plan: planFilter,
          expiringOnly,
        },
      ];
    });
  };

  const applySavedFilter = (name: string) => {
    const f = savedFilters.find((sf) => sf.name === name);
    if (!f) return;
    setSearch(f.search);
    setStatusFilter(f.status);
    setPlanFilter(f.plan);
    setExpiringOnly(f.expiringOnly);
  };

  const deleteSavedFilter = (name: string) => {
    setSavedFilters((prev) => prev.filter((f) => f.name !== name));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allIds = filteredTenants.map((t) => t.id);
      const next = new Set(prev);
      const allSelected = allIds.every((id) => next.has(id));
      if (allSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const applyBatch = async (
    action: "activate" | "block" | "api-on" | "api-off" | TenantPlan,
  ) => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map((id) => {
          switch (action) {
            case "activate":
              return updateTenant(id, { status: "active" });
            case "block":
              return updateTenant(id, { status: "blocked" });
            case "api-on":
              return updateTenant(id, { apiEnabled: true });
            case "api-off":
              return updateTenant(id, { apiEnabled: false });
            default:
              return updateTenant(id, { plan: action as TenantPlan });
          }
        })
      );

      const applied = ids.length;
      const actionLabel =
        action === "activate"
          ? "Разблокировано"
          : action === "block"
            ? "Заблокировано"
            : action === "api-on"
              ? "API включено"
              : action === "api-off"
                ? "API выключено"
                : `План ${action}`;

      setTenants((prev) =>
        prev.map((t) => {
          if (!selectedIds.has(t.id)) return t;
          if (action === "activate") return { ...t, status: "active" };
          if (action === "block") return { ...t, status: "blocked" };
          if (action === "api-on") return { ...t, apiEnabled: true };
          if (action === "api-off") return { ...t, apiEnabled: false };
          return { ...t, plan: action as TenantPlan };
        })
      );
      setSelectedIds(new Set());
      setAuditToast(`${actionLabel}: ${applied} шт.`);
    } catch (err) {
      alert("Не удалось применить массовое действие: " + getApiErrorMessage(err));
    } finally {
      setBatchLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const lines = importText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        setImportResult("Нет данных");
        return;
      }

      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1);
      const created: TenantSummary[] = [];
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const cols = rows[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        const row: Record<string, string> = {};
        header.forEach((h, idx) => {
          row[h] = cols[idx] ?? "";
        });
        const name = row.name;
        const clientKey = row.clientkey || row.client_key || "";
        const plan = (row.plan || "standard") as TenantPlan;
        const ownerEmail = row.owneremail || row.owner_email || "";
        if (!name || !clientKey || !ownerEmail) {
          errors.push(`Строка ${i + 2}: name/clientKey/ownerEmail обязательны`);
          continue;
        }
        try {
          const dto: CreateTenantDto = {
            name,
            clientKey,
            plan,
          };
          // backend ожидает ownerEmail в другом поле? createTenant принимает CreateTenantDto,
          // но у нас платформа может требовать ownerEmail. Пока кладём в notes для ориентира.
          const createdTenant = await createTenant(dto as any);
          created.push(createdTenant);
        } catch (err) {
          errors.push(`Строка ${i + 2}: ${getApiErrorMessage(err)}`);
        }
      }

      if (created.length > 0) {
        setTenants((prev) => [...created, ...prev]);
      }

      setImportResult(
        `Импорт завершён. Создано: ${created.length}. Ошибок: ${errors.length}${errors.length ? ` (${errors.slice(0, 3).join("; ")}${errors.length > 3 ? " …" : ""})` : ""}`,
      );
    } finally {
      setImportLoading(false);
    }
  };

  // ---------- JSX ----------
  return (
    <div className="pl1-page">
      <header className="pl1-page-header">
        <div>
          <h1 className="pl1-page-title">Тенанты</h1>
          <p className="pl1-page-subtitle">
            Список всех компаний, их статусы, планы и доступ к API.
          </p>
        </div>
        <div className="pl1-header-actions">
          <button
            type="button"
            className="pl1-btn-outline"
            onClick={() => void loadTenants()}
            disabled={loading}
          >
            {loading ? "Обновляем…" : "Обновить"}
          </button>
          <button
            type="button"
            className="pl1-btn-outline"
            onClick={exportCsv}
            disabled={filteredTenants.length === 0}
          >
            Экспорт CSV
          </button>
          <button
            type="button"
            className="pl1-btn-outline"
            onClick={() => setImportOpen(true)}
          >
            Импорт CSV
          </button>
          <button
            type="button"
            className="pl1-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            + Новый тенант
          </button>
        </div>
      </header>

      {error && (
        <div className="pl1-alert pl1-alert-error">
          <span className="pl1-alert-badge">ERROR</span>
          <span>{error}</span>
        </div>
      )}

      <section className="pl1-filters">
        <div className="pl1-filters-left">
          <input
            className="pl1-input"
            placeholder="Поиск по названию или client key…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="pl1-filters-right">
          <select
            className="pl1-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">Все статусы</option>
            <option value="active">active</option>
            <option value="blocked">blocked</option>
          </select>
          <select
            className="pl1-select"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
          >
            <option value="all">Все планы</option>
            {PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={expiringOnly}
              onChange={(e) => setExpiringOnly(e.target.checked)}
            />
            Истекает ≤ 14 дней
          </label>
          <div className="flex items-center gap-2">
            <select
              className="pl1-select"
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__none__") return;
                applySavedFilter(val);
              }}
              defaultValue="__none__"
            >
              <option value="__none__">Сохранённые фильтры</option>
              {savedFilters.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="pl1-btn-outline"
              onClick={saveCurrentFilter}
            >
              Сохранить фильтр
            </button>
            {savedFilters.length > 0 && (
              <button
                type="button"
                className="pl1-btn-ghost"
                onClick={() => {
                  const name = window.prompt(
                    "Удалить фильтр (введите название)",
                  );
                  if (name) deleteSavedFilter(name.trim());
                }}
              >
                Удалить
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="pl1-card pl1-card-table">
        {auditToast && (
          <div className="px-4 py-2 text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/40 rounded-xl mb-2">
            {auditToast}
            <button
              type="button"
              className="pl1-link-button ml-3"
              onClick={() => setAuditToast(null)}
            >
              Закрыть
            </button>
          </div>
        )}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm text-slate-200">
            <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs text-slate-200">
              Выбрано: {selectedIds.size}
            </span>
            <button
              type="button"
              className="pl1-btn-outline"
              onClick={() => void applyBatch("activate")}
              disabled={batchLoading}
            >
              Активировать
            </button>
            <button
              type="button"
              className="pl1-btn-outline"
              onClick={() => void applyBatch("block")}
              disabled={batchLoading}
            >
              Заблокировать
            </button>
            <button
              type="button"
              className="pl1-btn-outline"
              onClick={() => void applyBatch("api-on")}
              disabled={batchLoading}
            >
              API On
            </button>
            <button
              type="button"
              className="pl1-btn-outline"
              onClick={() => void applyBatch("api-off")}
              disabled={batchLoading}
            >
              API Off
            </button>
            <button
              type="button"
              className="pl1-btn-outline"
              onClick={() => void applyBatch("standard")}
              disabled={batchLoading}
            >
              План Standard
            </button>
            <button
              type="button"
              className="pl1-btn-outline"
              onClick={() => void applyBatch("professional")}
              disabled={batchLoading}
            >
              План Professional
            </button>
          </div>
        )}
        <table className="pl1-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={
                    filteredTenants.length > 0 &&
                    filteredTenants.every((t) => selectedIds.has(t.id))
                  }
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Название</th>
              <th>CLIENT KEY</th>
              <th>СТАТУС</th>
              <th>ПЛАН</th>
              <th>API</th>
              <th>АКТИВЕН ДО</th>
              <th>ЗАМЕТКИ</th>
              <th>OWNER</th>
              <th>СОЗДАН</th>
              <th>ОБНОВЛЁН</th>
              <th className="pl1-col-actions">ДЕЙСТВИЯ</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.length === 0 && !loading && (
              <tr>
                <td colSpan={12} className="pl1-table-empty">
                  Нет тенантов по текущему фильтру
                </td>
              </tr>
            )}

            {filteredTenants.map((t) => (
              <tr key={t.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleSelect(t.id)}
                  />
                </td>
                <td>{t.name}</td>
                <td className="pl1-mono">{t.clientKey}</td>
                <td>
                  <span
                    className={
                      t.status === "active"
                        ? "pl1-pill pl1-pill-green"
                        : "pl1-pill pl1-pill-red"
                    }
                  >
                    {t.status}
                  </span>
                </td>
                <td>{t.plan || "—"}</td>
                <td>
                  <button
                    type="button"
                    className={
                      t.apiEnabled
                        ? "pl1-pill pl1-pill-green pl1-pill-clickable"
                        : "pl1-pill pl1-pill-gray pl1-pill-clickable"
                    }
                    onClick={() => void toggleApi(t)}
                  >
                    {t.apiEnabled ? "Вкл" : "Выкл"}
                  </button>
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <span>{formatDate(t.activeUntil)}</span>
                    {(() => {
                      const days = daysToExpire(t.activeUntil);
                      if (days === null || days > 30) return null;
                      if (days < 0) {
                        return (
                          <span className="pl1-pill pl1-pill-red">
                            Просрочен
                          </span>
                        );
                      }
                      return (
                        <span className="pl1-pill pl1-pill-gray">
                          {`Осталось ${days} д.`}
                        </span>
                      );
                    })()}
                  </div>
                </td>
                <td className="max-w-[220px]">
                  <div className="truncate text-sm text-slate-200">
                    {t.notes || "—"}
                  </div>
                </td>
                <td>
                  {t.ownerName || "—"}
                  {t.ownerEmail && (
                    <div className="pl1-owner-email">{t.ownerEmail}</div>
                  )}
                </td>
                <td>{formatDate(t.createdAt)}</td>
                <td>{formatDate(t.updatedAt)}</td>
                <td className="pl1-col-actions">
                <button
                  type="button"
                  className="pl1-link-button"
                  onClick={() => openEditModal(t)}
                >
                  Редактировать
                </button>

                <button
                  type="button"
                  className="pl1-link-button"
                  onClick={() => (window.location.href = `/tenants/${t.id}`)}
                >
                  Детали / логи
                </button>

                <button
                  type="button"
                  className="pl1-link-button"
                  onClick={() => void toggleStatus(t)}
                >
                  {t.status === "active" ? "Заблокировать" : "Разблокировать"}
                </button>

                <button
                  type="button"
                  className="pl1-link-button"
                  style={{ color: "#f87171" }} // красный текст
                  onClick={() => void deleteTenant(t)}
                >
                  Удалить
                </button>
              </td>
              </tr>
            ))}

            {loading && (
              <tr>
                <td colSpan={12} className="pl1-table-empty">
                  Загрузка…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- МОДАЛ СОЗДАНИЯ ---------- */}
      {createOpen && (
        <div
          className="pl1-modal-backdrop"
          onClick={() => !createLoading && setCreateOpen(false)}
        >
          <div className="pl1-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="pl1-modal-title">Новый тенант</h2>
            <p className="pl1-modal-subtitle">
              Укажите название, client key, тариф, срок активности и владельца.
            </p>

            <form className="pl1-modal-form" onSubmit={handleCreate}>
              <label className="pl1-field">
                <span>Название компании</span>
                <input
                  className="pl1-input"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </label>

              <label className="pl1-field">
                <span>Client key</span>
                <input
                  className="pl1-input pl1-mono"
                  value={createForm.clientKey}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, clientKey: e.target.value }))
                  }
                  required
                />
              </label>

              <label className="pl1-field">
                <span>План</span>
                <select
                  className="pl1-select"
                  value={createForm.plan}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      plan: e.target.value as TenantPlan,
                    }))
                  }
                >
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pl1-field">
                <span>Активен до</span>
                <input
                  type="date"
                  className="pl1-input"
                  value={createForm.activeUntil}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      activeUntil: e.target.value,
                    }))
                  }
                />
              </label>

              <label className="pl1-field">
                <span>Owner name</span>
                <input
                  className="pl1-input"
                  value={createForm.ownerName}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      ownerName: e.target.value,
                    }))
                  }
                />
              </label>

              <label className="pl1-field">
                <span>Owner email</span>
                <input
                  className="pl1-input"
                  value={createForm.ownerEmail}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      ownerEmail: e.target.value,
                    }))
                  }
                />
              </label>

              <label className="pl1-field pl1-field-inline">
                <span>API доступ</span>
                <label className="pl1-switch">
                  <input
                    type="checkbox"
                    checked={createForm.apiEnabled}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        apiEnabled: e.target.checked,
                      }))
                    }
                  />
                  <span className="pl1-switch-slider" />
                  <span className="pl1-switch-label">
                    {createForm.apiEnabled ? "Включён" : "Выключен"}
                  </span>
                </label>
              </label>

              <div className="pl1-modal-actions">
                <button
                  type="button"
                  className="pl1-btn-ghost"
                  onClick={() => !createLoading && setCreateOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="pl1-btn-primary"
                  disabled={createLoading}
                >
                  {createLoading ? "Создаём…" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- МОДАЛ РЕДАКТИРОВАНИЯ ---------- */}
      {editOpen && editForm && (
        <div
          className="pl1-modal-backdrop"
          onClick={() => !editLoading && setEditOpen(false)}
        >
          <div className="pl1-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="pl1-modal-title">Редактирование тенанта</h2>
            <p className="pl1-modal-subtitle">
              Владелец (имя и email), тариф, срок, API, заметки. Client key —
              только после явного разблокирования (опасная операция).
            </p>

            <form className="pl1-modal-form" onSubmit={handleEditSave}>
              <label className="pl1-field">
                <span>Название компании</span>
                <input
                  className="pl1-input"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, name: e.target.value } : f
                    )
                  }
                  required
                />
              </label>

              <label className="pl1-field pl1-field-inline">
                <span>Разрешить смену client key</span>
                <label className="pl1-switch">
                  <input
                    type="checkbox"
                    checked={editClientKeyUnlocked}
                    onChange={(e) => setEditClientKeyUnlocked(e.target.checked)}
                  />
                  <span className="pl1-switch-slider" />
                  <span className="pl1-switch-label">
                    {editClientKeyUnlocked ? "Редактирование" : "Только просмотр"}
                  </span>
                </label>
              </label>

              <label className="pl1-field">
                <span>Client key</span>
                <input
                  className="pl1-input pl1-mono"
                  value={editForm.clientKey}
                  disabled={!editClientKeyUnlocked}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, clientKey: e.target.value } : f
                    )
                  }
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  По умолчанию заблокирован. Включите переключатель выше, чтобы
                  изменить ключ (бэкенд поддерживает PATCH).
                </span>
              </label>

              <label className="pl1-field">
                <span>План</span>
                <select
                  className="pl1-select"
                  value={editForm.plan || "standard"}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f
                        ? {
                            ...f,
                            plan: e.target.value as TenantPlan,
                          }
                        : f
                    )
                  }
                >
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pl1-field">
                <span>Активен до</span>
                <input
                  type="date"
                  className="pl1-input"
                  value={editForm.activeUntil}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, activeUntil: e.target.value } : f
                    )
                  }
                />
              </label>

              <label className="pl1-field">
                <span>Owner name</span>
                <input
                  className="pl1-input"
                  value={editForm.ownerName}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, ownerName: e.target.value } : f
                    )
                  }
                />
              </label>

              <label className="pl1-field">
                <span>Owner email</span>
                <input
                  className="pl1-input"
                  value={editForm.ownerEmail}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, ownerEmail: e.target.value } : f
                    )
                  }
                />
              </label>

              <label className="pl1-field">
                <span>Внутренние заметки</span>
                <textarea
                  className="pl1-input"
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, notes: e.target.value } : f
                    )
                  }
                />
              </label>

              <label className="pl1-field pl1-field-inline">
                <span>API доступ</span>
                <label className="pl1-switch">
                  <input
                    type="checkbox"
                    checked={editForm.apiEnabled}
                    onChange={(e) =>
                      setEditForm((f) =>
                        f ? { ...f, apiEnabled: e.target.checked } : f
                      )
                    }
                  />
                  <span className="pl1-switch-slider" />
                  <span className="pl1-switch-label">
                    {editForm.apiEnabled ? "Включён" : "Выключен"}
                  </span>
                </label>
              </label>

              <div className="pl1-modal-actions">
                <button
                  type="button"
                  className="pl1-btn-ghost"
                  onClick={() => !editLoading && setEditOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="pl1-btn-primary"
                  disabled={editLoading}
                >
                  {editLoading ? "Сохраняем…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- МОДАЛ ИМПОРТА ---------- */}
      {importOpen && (
        <div
          className="pl1-modal-backdrop"
          onClick={() => !importLoading && setImportOpen(false)}
        >
          <div className="pl1-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="pl1-modal-title">Импорт CSV</h2>
            <p className="pl1-modal-subtitle">
              Формат: первая строка — заголовки. Обязательные поля: name,
              clientKey, ownerEmail. Опционально: plan, activeUntil, ownerName,
              notes. Разделитель — запятая.
            </p>
            <textarea
              className="pl1-input"
              rows={10}
              placeholder='name,clientKey,plan,ownerEmail\n"Demo","demo-1","standard","owner@demo.com"'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            {importResult && (
              <div className="pl1-alert pl1-alert-error mt-2">
                <span className="pl1-alert-badge">INFO</span>
                <span>{importResult}</span>
              </div>
            )}
            <div className="pl1-modal-actions">
              <button
                type="button"
                className="pl1-btn-ghost"
                onClick={() => !importLoading && setImportOpen(false)}
              >
                Закрыть
              </button>
              <button
                type="button"
                className="pl1-btn-primary"
                onClick={() => void handleImport()}
                disabled={importLoading}
              >
                {importLoading ? "Импортируем…" : "Импортировать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantsPage;
