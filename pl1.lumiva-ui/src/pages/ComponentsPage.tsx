// src/pages/ComponentsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { fetchTenants, type TenantSummary } from "../api/tenants";
import {
  fetchTenantComponents,
  toggleTenantComponent,
  type TenantComponent,
} from "../api/components";
import { getApiErrorMessage } from "../api/client";
import { clearPanelSession } from "../auth/panelSession";

type ComponentDef = {
  key: string;
  name: string;
  icon: string;
  children?: Array<{
    key: string;
    name: string;
  }>;
};

const COMPONENTS: ComponentDef[] = [
  {
    key: "leads",
    name: "Лиды",
    icon: "🧲",
  },
  {
    key: "contacts",
    name: "Контакты",
    icon: "👤",
  },
  {
    key: "companies",
    name: "Компании",
    icon: "🏢",
  },
  {
    key: "projects",
    name: "Проекты",
    icon: "📁",
    children: [
      { key: "projects_analytics", name: "Аналитика проектов" },
      { key: "projects_kanban", name: "Канбан" },
      { key: "projects_calendar", name: "Календарь" },
    ],
  },
  {
    key: "sales",
    name: "Продажи",
    icon: "💳",
    children: [
      { key: "sales_pipeline", name: "Воронка" },
      { key: "sales_analytics", name: "Аналитика продаж" },
    ],
  },
  {
    key: "marketing",
    name: "Маркетинг",
    icon: "📣",
    children: [
      { key: "marketing_campaigns", name: "Кампании" },
      { key: "marketing_analytics", name: "Аналитика маркетинга" },
    ],
  },
  {
    key: "tools",
    name: "Инструменты",
    icon: "🛠️",
    children: [
      { key: "tools_integrations", name: "Интеграции" },
      { key: "tools_automation", name: "Автоматизация" },
      { key: "tools_settings", name: "Настройки" },
      { key: "custom_objects", name: "No-code Workspace" },
    ],
  },
  {
    key: "email",
    name: "Email",
    icon: "📧",
  },
  {
    key: "telegram",
    name: "Telegram",
    icon: "✈️",
  },
  {
    key: "chat",
    name: "Чат",
    icon: "💬",
  },
  {
    key: "client_accounts",
    name: "Счета клиентов",
    icon: "🧾",
  },
];

const ComponentsPage: React.FC = () => {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [components, setComponents] = useState<TenantComponent[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    void loadTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      void loadComponents(selectedTenantId);
    } else {
      setComponents([]);
    }
  }, [selectedTenantId]);

  const handleUnauthorized = () => {
    setError("Ошибка аутентификации. Войдите в панель заново.");
    clearPanelSession();
    navigate("/panel-login", { replace: true });
  };

  const loadTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTenants();
      setTenants(data);
      if (!selectedTenantId && data.length > 0) {
        setSelectedTenantId(data[0].id);
      }
    } catch (e: any) {
      const msg = getApiErrorMessage(e);
      if (e?.response?.status === 401) {
        handleUnauthorized();
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadComponents = async (tenantId: string) => {
    setComponentsLoading(true);
    setError(null);
    try {
      console.log("[ComponentsPage] Загрузка компонентов для тенанта:", tenantId);
      const data = await fetchTenantComponents(tenantId);
      console.log("[ComponentsPage] Получены компоненты:", data);
      if (!Array.isArray(data)) {
        console.error("[ComponentsPage] Ожидался массив, получено:", typeof data, data);
        setError("Неверный формат ответа от сервера");
        return;
      }
      setComponents(data);
    } catch (e: any) {
      const msg = getApiErrorMessage(e);
      console.error("[ComponentsPage] Ошибка загрузки компонентов:", {
        error: e,
        message: msg,
        status: e?.response?.status,
        statusText: e?.response?.statusText,
        data: e?.response?.data,
      });
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        handleUnauthorized();
      } else {
        setError("Не удалось загрузить компоненты: " + msg);
      }
    } finally {
      setComponentsLoading(false);
    }
  };

  const handleToggle = async (
    tenantId: string,
    key: string,
    currentEnabled: boolean,
  ) => {
    const toggleId = `${tenantId}-${key}`;
    setToggling((prev) => new Set(prev).add(toggleId));
    try {
      await toggleTenantComponent(tenantId, key, !currentEnabled);
      setComponents((prev) => {
        const next = [...prev];
        const idx = next.findIndex((c) => c.key === key);
        if (idx >= 0) {
          next[idx] = { ...next[idx], enabled: !currentEnabled };
        } else {
          next.push({ key, enabled: !currentEnabled });
        }
        return next;
      });
    } catch (e) {
      const msg = getApiErrorMessage(e);
      console.error("Ошибка переключения компонента:", e);
      if (axios.isAxiosError(e) && (e.response?.status === 401 || e.response?.status === 403)) {
        handleUnauthorized();
        return;
      }
      alert("Не удалось изменить компонент: " + msg);
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(toggleId);
        return next;
      });
    }
  };

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
  const componentMap = useMemo(() => {
    return components.reduce<Record<string, TenantComponent>>((acc, item) => {
      acc[item.key] = item;
      return acc;
    }, {});
  }, [components]);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-50">Компоненты</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Управление разделами CRM для каждого тенанта. Отключённые компоненты
            скрываются из меню и недоступны по прямой ссылке.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white transition"
          onClick={() => void loadTenants()}
          disabled={loading}
        >
          {loading ? "Обновляем…" : "Обновить"}
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1">
          <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">
                  Выберите тенант
                </h2>
                <p className="text-xs text-slate-500">
                  Всего: {tenants.length}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {tenants.map((tenant) => {
                const isActive = tenant.id === selectedTenantId;
                return (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => setSelectedTenantId(tenant.id)}
                    className={[
                      "w-full text-left rounded-2xl border px-4 py-4 transition",
                      isActive
                        ? "border-sky-400/60 bg-sky-500/10 text-slate-50"
                        : "border-slate-800/70 bg-slate-900/40 text-slate-200 hover:border-slate-700",
                    ].join(" ")}
                  >
                    <div className="font-semibold">
                      {tenant.name ?? tenant.clientKey}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {tenant.clientKey}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Активен
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">
                  Компоненты тенанта
                </h2>
                {selectedTenant ? (
                  <p className="text-xs text-slate-500">
                    {selectedTenant.name ?? selectedTenant.clientKey} ·{" "}
                    {selectedTenant.clientKey}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">Не выбран</p>
                )}
              </div>
              {componentsLoading && (
                <span className="text-xs text-slate-400">Загрузка…</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COMPONENTS.map((component) => {
                const current = componentMap[component.key];
                const enabled = current?.enabled ?? false;
                const toggleId = selectedTenantId
                  ? `${selectedTenantId}-${component.key}`
                  : "";
                const isToggling = toggling.has(toggleId);

                return (
                  <div
                    key={component.key}
                    className={[
                      "rounded-2xl border p-4 transition",
                      enabled
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-slate-800/70 bg-slate-900/40",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-900/70 flex items-center justify-center text-lg">
                          {component.icon}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-50">
                            {component.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {component.key}
                          </div>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={enabled}
                          disabled={!selectedTenantId || isToggling}
                          onChange={() => {
                            if (!selectedTenantId) return;
                            void handleToggle(
                              selectedTenantId,
                              component.key,
                              enabled,
                            );
                          }}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 transition" />
                        <div className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white transition peer-checked:translate-x-5" />
                      </label>
                    </div>

                    {component.children && component.children.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Подменю
                        </div>
                        <div className="space-y-2">
                          {component.children.map((child) => {
                            const childState = componentMap[child.key];
                            const childEnabled = childState?.enabled ?? false;
                            const childToggleId = selectedTenantId
                              ? `${selectedTenantId}-${child.key}`
                              : "";
                            const childToggling = toggling.has(childToggleId);
                            return (
                              <div
                                key={child.key}
                                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2"
                              >
                                <div>
                                  <div className="text-sm text-slate-100">
                                    {child.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {child.key}
                                  </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={childEnabled}
                                    disabled={!selectedTenantId || childToggling}
                                    onChange={() => {
                                      if (!selectedTenantId) return;
                                      void handleToggle(
                                        selectedTenantId,
                                        child.key,
                                        childEnabled,
                                      );
                                    }}
                                  />
                                  <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:bg-emerald-500 transition" />
                                  <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ComponentsPage;
