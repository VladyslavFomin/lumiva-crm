import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { useCart } from "../useCart";
import { createOrder } from "../../../api/storeProducts";
import { getApiErrorMessage } from "../../../api/publicClient";

const CartPage: React.FC = () => {
  const { clientKey = "" } = useParams<{ clientKey: string }>();
  const navigate = useNavigate();
  const cart = useCart(clientKey);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = cart.items[0]?.currency;

  const submit = async () => {
    if (!name.trim()) {
      setError("Укажите имя");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder(clientKey, {
        items: cart.items.map((i) => ({ sku: i.sku, qty: i.qty })),
        customerName: name,
        customerEmail: email || undefined,
        customerPhone: phone || undefined,
      });
      cart.clear();
      navigate(`/store/${clientKey}/orders/${order.orderCode}?email=${encodeURIComponent(email)}`);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <StoreLayout title="Корзина">
        <div className="text-stone-500 text-sm mb-4">Корзина пуста.</div>
        <Link to={`/store/${clientKey}/products`} className="text-sm text-amber-700 hover:underline">
          ← В каталог
        </Link>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout title="Корзина">
      <div className="rounded-2xl border border-amber-200 bg-white shadow-lumiva divide-y divide-amber-100 mb-6">
        {cart.items.map((item) => (
          <div key={item.sku} className="flex items-center gap-4 p-4">
            <div className="flex-1">
              <div className="font-medium text-sm">{item.name}</div>
              <div className="text-xs text-stone-500">{item.sku}</div>
            </div>
            <input
              type="number"
              min={1}
              value={item.qty}
              onChange={(e) => cart.setQty(item.sku, Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded-xl border border-amber-300 px-2 py-1.5 text-sm text-center"
            />
            <div className="w-24 text-right text-sm font-medium">
              {(item.price * item.qty).toFixed(2)} {item.currency}
            </div>
            <button onClick={() => cart.removeItem(item.sku)} className="text-stone-400 hover:text-rose-500 text-sm">
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end mb-8">
        <div className="text-lg font-semibold">
          Итого: {cart.total.toFixed(2)} {currency}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-white shadow-lumiva p-5 max-w-md">
        <h2 className="font-semibold mb-4">Оформление заказа</h2>
        {error && <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2 mb-3 text-sm">{error}</div>}
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя"
            className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон"
            className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="mt-4 w-full rounded-full bg-amber-500 text-white font-medium py-2.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {submitting ? "Оформляем…" : "Оформить заказ"}
        </button>
      </div>
    </StoreLayout>
  );
};

export default CartPage;
