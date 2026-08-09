import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { fetchCategories, fetchProducts } from "../../../api/storeProducts";
import type { StoreCategory, StoreProduct } from "../../../api/storeProducts";
import { getApiErrorMessage } from "../../../api/publicClient";
import { resolveMediaUrl } from "../../../api/mediaUrl";
import { useCart } from "../useCart";

const CatalogPage: React.FC = () => {
  const { clientKey = "" } = useParams<{ clientKey: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get("category") || "";

  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cart = useCart(clientKey);

  useEffect(() => {
    fetchCategories(clientKey)
      .then(setCategories)
      .catch(() => {});
  }, [clientKey]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProducts(clientKey, categoryId || undefined)
      .then(setProducts)
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [clientKey, categoryId]);

  const selectCategory = (id: string) => {
    if (id) setSearchParams({ category: id });
    else setSearchParams({});
  };

  return (
    <StoreLayout title="Товары">
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => selectCategory("")}
            className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
              !categoryId ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-white text-stone-600 hover:border-amber-400"
            }`}
          >
            Все
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCategory(c.id)}
              className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                categoryId === c.id ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-white text-stone-600 hover:border-amber-400"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {error && <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-4 py-3 mb-4 text-sm">{error}</div>}
      {loading && <div className="text-stone-500 text-sm">Загрузка…</div>}
      {!loading && products.length === 0 && !error && (
        <div className="text-stone-500 text-sm">В каталоге пока нет товаров.</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {products.map((p) => {
          const cover = p.images?.find((i) => i.isCover) || p.images?.[0];
          return (
            <div key={p.id} className="rounded-2xl border border-amber-200 bg-white p-4 shadow-lumiva flex flex-col">
              <Link to={`/store/${clientKey}/products/${encodeURIComponent(p.sku)}`} className="flex-1">
                <div className="h-32 rounded-xl bg-amber-100 mb-3 flex items-center justify-center overflow-hidden">
                  {cover ? (
                    <img src={resolveMediaUrl(cover.url)} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl">📦</span>
                  )}
                </div>
                <div className="font-medium text-sm mb-1">{p.name}</div>
                <div className="text-xs text-stone-500 mb-2">{p.sku}</div>
              </Link>
              <div className="flex items-center justify-between mt-auto">
                <span className="font-semibold">
                  {p.price} {p.currency}
                </span>
                <button
                  onClick={() => cart.addItem({ sku: p.sku, name: p.name, price: Number(p.price), currency: p.currency })}
                  className="rounded-full bg-amber-500 text-white text-xs font-medium px-3 py-1.5 hover:bg-amber-600 transition-colors"
                >
                  В корзину
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </StoreLayout>
  );
};

export default CatalogPage;
