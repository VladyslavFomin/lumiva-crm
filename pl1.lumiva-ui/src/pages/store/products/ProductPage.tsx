import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { fetchProduct } from "../../../api/storeProducts";
import type { StoreProduct } from "../../../api/storeProducts";
import { getApiErrorMessage } from "../../../api/publicClient";
import { resolveMediaUrl } from "../../../api/mediaUrl";
import { useCart } from "../useCart";

const ProductPage: React.FC = () => {
  const { clientKey = "", sku = "" } = useParams<{ clientKey: string; sku: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const cart = useCart(clientKey);

  useEffect(() => {
    fetchProduct(clientKey, sku)
      .then((r) => setProduct(r.product))
      .catch((e) => setError(getApiErrorMessage(e)));
  }, [clientKey, sku]);

  if (error) {
    return (
      <StoreLayout title="Товар">
        <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-4 py-3 text-sm">{error}</div>
      </StoreLayout>
    );
  }
  if (!product) {
    return (
      <StoreLayout title="Товар">
        <div className="text-stone-500 text-sm">Загрузка…</div>
      </StoreLayout>
    );
  }

  const cover = product.images?.find((i) => i.isCover) || product.images?.[0];

  return (
    <StoreLayout>
      <Link to={`/store/${clientKey}/products`} className="text-sm text-amber-700 hover:underline">
        ← Назад в каталог
      </Link>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="h-64 md:h-80 rounded-2xl bg-amber-100 flex items-center justify-center overflow-hidden">
          {cover ? <img src={resolveMediaUrl(cover.url)} alt={product.name} className="h-full w-full object-cover" /> : <span className="text-5xl">📦</span>}
        </div>
        <div>
          <h1 className="text-xl font-semibold mb-1">{product.name}</h1>
          <div className="text-xs text-stone-500 mb-4">{product.sku}</div>
          <div className="text-2xl font-semibold mb-4">
            {product.price} {product.currency}
          </div>
          {product.description && <p className="text-sm text-stone-600 mb-6 whitespace-pre-line">{product.description}</p>}

          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-stone-500">Кол-во</label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-xl border border-amber-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                cart.addItem({ sku: product.sku, name: product.name, price: Number(product.price), currency: product.currency }, qty);
                setAdded(true);
              }}
              className="rounded-full bg-amber-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-amber-600 transition-colors"
            >
              Добавить в корзину
            </button>
            {added && (
              <button
                onClick={() => navigate(`/store/${clientKey}/cart`)}
                className="rounded-full border border-amber-300 text-sm font-medium px-5 py-2.5 hover:bg-amber-100 transition-colors"
              >
                Перейти в корзину →
              </button>
            )}
          </div>
        </div>
      </div>
    </StoreLayout>
  );
};

export default ProductPage;
