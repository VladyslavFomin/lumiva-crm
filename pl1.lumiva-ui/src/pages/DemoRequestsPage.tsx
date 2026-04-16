import React, { useEffect, useMemo, useState } from "react";
import {
  fetchDemoRequests,
  updateDemoRequestStatus,
  createTenant,
  type DemoRequest,
} from "../api/tenants";
import { getApiErrorMessage } from "../api/client";

const DemoRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDemoRequests();
      setRequests(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q),
    );
  }, [requests, search]);

  const createTenantFromRequest = async (req: DemoRequest) => {
    try {
      await createTenant({
        name: `${req.firstName} ${req.lastName}`.trim(),
        clientKey: req.email.split("@")[0].toLowerCase(),
        ownerEmail: req.email,
        ownerFullName: `${req.firstName} ${req.lastName}`.trim(),
        notes: `Demo request ${req.id}. Orders/month: ${req.ordersPerMonth || "n/a"}. Contact: ${req.contactMethod}. Phone: ${req.phone || "-"}`,
      });
      await updateDemoRequestStatus(req.id, "tenant_created");
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Запросы
          </p>
          <h1 className="text-xl font-semibold text-slate-50">
            Запросы на демо
          </h1>
          <p className="text-sm text-slate-400">
            Все входящие заявки с crm.lumiva.agency
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, почте, телефону"
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <button
            onClick={load}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-slate-500 transition-colors"
          >
            Обновить
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-700/50 bg-rose-900/30 px-4 py-3 text-sm text-rose-50">
          {error}
        </div>
      )}

      <div className="rounded-3xl border border-slate-800 bg-slate-950/70 backdrop-blur-lg p-4 md:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="grid grid-cols-[1.3fr,1fr,0.8fr,0.6fr,0.9fr] gap-3 px-2 py-2 text-[11px] uppercase tracking-wide text-slate-500">
          <span>Контакт</span>
          <span>Данные</span>
          <span>Связь</span>
          <span>Статус</span>
          <span className="text-right">Действия</span>
        </div>
        <div className="divide-y divide-slate-800/80">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1.3fr,1fr,0.8fr,0.6fr,0.9fr] gap-3 px-2 py-3 text-sm text-slate-200"
            >
              <div>
                <div className="font-semibold text-slate-50">
                  {r.firstName} {r.lastName}
                </div>
                <div className="text-[12px] text-slate-400">{r.email}</div>
                <div className="text-[12px] text-slate-500">
                  {r.phone || "—"}
                </div>
              </div>
              <div className="text-[12px] text-slate-400">
                <div>Заказов/мес: {r.ordersPerMonth || "—"}</div>
                <div>Создано: {new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div className="text-[12px] text-slate-400">
                {r.contactMethod}
              </div>
              <div className="text-[12px]">
                <span className="rounded-full border border-slate-700 px-2 py-1">
                  {r.status}
                </span>
              </div>
              <div className="text-right">
                <button
                  className="rounded-xl border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-100 hover:border-emerald-500 transition-colors"
                  onClick={() => createTenantFromRequest(r)}
                >
                  Создать тенант
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="px-2 py-6 text-center text-slate-500">
              Нет заявок.
            </div>
          )}
          {loading && (
            <div className="px-2 py-6 text-center text-slate-400">
              Загружаем...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoRequestsPage;
