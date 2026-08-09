import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import StoreLayout from "./StoreLayout";

const STORAGE_KEY = "pl1_store_client_key";
const DEFAULT_CLIENT_KEY = "atghotels";

const StoreHome: React.FC = () => {
  const navigate = useNavigate();
  const [clientKey, setClientKey] = useState(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_CLIENT_KEY,
  );

  const go = (path: string) => {
    const key = clientKey.trim() || DEFAULT_CLIENT_KEY;
    localStorage.setItem(STORAGE_KEY, key);
    navigate(`/store/${key}${path}`);
  };

  return (
    <StoreLayout title="Тестовая витрина Lumiva">
      <p className="text-stone-600 mb-6 max-w-xl">
        Здесь можно пройти путь настоящего клиента для трёх модулей CRM — товары, запись на
        услугу и бронирование отеля — и увидеть, как заявка приходит в панель. Укажите{" "}
        <code className="px-1 py-0.5 rounded bg-amber-100 text-amber-900">clientKey</code>{" "}
        тенанта (тот же публичный идентификатор, что в Настройках → Компания).
      </p>

      <div className="mb-8 max-w-sm">
        <label className="block text-xs font-medium text-stone-500 mb-1">Client key</label>
        <input
          value={clientKey}
          onChange={(e) => setClientKey(e.target.value)}
          className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="atghotels"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => go("/products")}
          className="text-left rounded-2xl border border-amber-200 bg-white p-5 shadow-lumiva hover:border-amber-400 transition-colors"
        >
          <div className="text-2xl mb-2">🛍️</div>
          <div className="font-semibold mb-1">Товары</div>
          <div className="text-sm text-stone-500">Каталог по категориям, карточка товара, корзина, заказ.</div>
        </button>
        <button
          type="button"
          onClick={() => go("/booking")}
          className="text-left rounded-2xl border border-amber-200 bg-white p-5 shadow-lumiva hover:border-amber-400 transition-colors"
        >
          <div className="text-2xl mb-2">📅</div>
          <div className="font-semibold mb-1">Бронирование</div>
          <div className="text-sm text-stone-500">Заявка на запись — попадает в панель на модерацию.</div>
        </button>
        <button
          type="button"
          onClick={() => go("/hotels")}
          className="text-left rounded-2xl border border-amber-200 bg-white p-5 shadow-lumiva hover:border-amber-400 transition-colors"
        >
          <div className="text-2xl mb-2">🏨</div>
          <div className="font-semibold mb-1">Система резервации</div>
          <div className="text-sm text-stone-500">Поиск отеля, выбор номера, бронь, тестовая оплата.</div>
        </button>
      </div>
    </StoreLayout>
  );
};

export default StoreHome;
