import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { lookupOrder } from "../../../api/storeProducts";
import type { StoreOrderResult } from "../../../api/storeProducts";
import { getApiErrorMessage } from "../../../api/publicClient";

type Order = StoreOrderResult & { status: string; createdAt: string; customerName: string };

const OrderConfirmationPage: React.FC = () => {
  const { clientKey = "", code: codeParam } = useParams<{ clientKey: string; code?: string }>();
  const [searchParams] = useSearchParams();

  const [code, setCode] = useState(codeParam || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doLookup = async (c: string, e: string) => {
    if (!c.trim() || !e.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await lookupOrder(clientKey, c.trim(), e.trim());
      setOrder(result);
    } catch (err) {
      setError(getApiErrorMessage(err));
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (codeParam && searchParams.get("email")) {
      doLookup(codeParam, searchParams.get("email") || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  return (
    <StoreLayout title="Заказ">
      {!order && (
        <div className="rounded-2xl border border-amber-200 bg-white shadow-lumiva p-5 max-w-md mb-6">
          <h2 className="font-semibold mb-4">Найти заказ</h2>
          {error && <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2 mb-3 text-sm">{error}</div>}
          <div className="space-y-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Код заказа (ORD-XXXXXXXX)"
              className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email, указанный при заказе"
              className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => doLookup(code, email)}
            disabled={loading}
            className="mt-4 w-full rounded-full bg-amber-500 text-white font-medium py-2.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Ищем…" : "Найти"}
          </button>
        </div>
      )}

      {order && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 max-w-md">
          <div className="text-emerald-700 font-semibold mb-2">Заказ {order.orderCode}</div>
          <div className="text-sm text-stone-600 mb-1">Покупатель: {order.customerName}</div>
          <div className="text-sm text-stone-600 mb-1">Статус: {order.status}</div>
          <div className="text-sm text-stone-600 mb-3">Создан: {new Date(order.createdAt).toLocaleString("ru-RU")}</div>
          <div className="divide-y divide-emerald-200 mb-3">
            {order.items.map((i) => (
              <div key={i.sku} className="flex justify-between py-1.5 text-sm">
                <span>
                  {i.name} × {i.qty}
                </span>
                <span>
                  {(i.unitPrice * i.qty).toFixed(2)} {order.currency}
                </span>
              </div>
            ))}
          </div>
          <div className="font-semibold">
            Итого: {order.total} {order.currency}
          </div>
        </div>
      )}
    </StoreLayout>
  );
};

export default OrderConfirmationPage;
