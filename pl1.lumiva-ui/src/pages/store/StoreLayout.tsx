// src/pages/store/StoreLayout.tsx — тёплая светлая тема, намеренно не похожая на тёмную
// админку pl1 (см. текущий план "Test storefront") — это тестовая витрина, а не панель оператора.
import React from "react";
import { Link, useParams } from "react-router-dom";

const StoreLayout: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => {
  const { clientKey } = useParams<{ clientKey: string }>();

  return (
    <div className="min-h-screen bg-amber-50 text-stone-900">
      <header className="border-b border-amber-200 bg-white/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/store" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-sm font-semibold text-white shadow-lumiva">
              LM
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Lumiva — тестовая витрина</span>
              {clientKey && <span className="text-[11px] text-stone-500">{clientKey}</span>}
            </div>
          </Link>
          {clientKey && (
            <nav className="flex items-center gap-1 text-sm">
              <Link to={`/store/${clientKey}/products`} className="rounded-full px-3 py-1.5 text-stone-600 hover:bg-amber-100 hover:text-stone-900 transition-colors">
                Товары
              </Link>
              <Link to={`/store/${clientKey}/booking`} className="rounded-full px-3 py-1.5 text-stone-600 hover:bg-amber-100 hover:text-stone-900 transition-colors">
                Бронирование
              </Link>
              <Link to={`/store/${clientKey}/hotels`} className="rounded-full px-3 py-1.5 text-stone-600 hover:bg-amber-100 hover:text-stone-900 transition-colors">
                Отели
              </Link>
              <Link to={`/store/${clientKey}/cart`} className="rounded-full border border-amber-300 px-3 py-1.5 font-medium text-amber-800 hover:bg-amber-100 transition-colors">
                Корзина
              </Link>
            </nav>
          )}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {title && <h1 className="text-xl md:text-2xl font-semibold tracking-tight mb-6">{title}</h1>}
        {children}
      </main>
    </div>
  );
};

export default StoreLayout;
