// src/pages/store/StoreRoutes.tsx — публичное (без авторизации) дерево маршрутов тестовой
// витрины, смонтированное из App.tsx в обход AppShell/PanelProtectedRoute (см. текущий план
// "Test storefront" / lumiva_pl1_platform_admin.md).
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import StoreHome from "./StoreHome";
import CatalogPage from "./products/CatalogPage";
import ProductPage from "./products/ProductPage";
import CartPage from "./products/CartPage";
import OrderConfirmationPage from "./products/OrderConfirmationPage";
import BookingRequestPage from "./booking/BookingRequestPage";
import HotelSearchPage from "./hotels/HotelSearchPage";
import HotelResultsPage from "./hotels/HotelResultsPage";
import HotelDetailPage from "./hotels/HotelDetailPage";
import HotelBookingPage from "./hotels/HotelBookingPage";
import HotelPaymentPage from "./hotels/HotelPaymentPage";
import HotelConfirmationPage from "./hotels/HotelConfirmationPage";
import HotelLookupPage from "./hotels/HotelLookupPage";

const StoreRoutes: React.FC = () => (
  <Routes>
    <Route path="/store" element={<StoreHome />} />

    <Route path="/store/:clientKey/products" element={<CatalogPage />} />
    <Route path="/store/:clientKey/products/:sku" element={<ProductPage />} />
    <Route path="/store/:clientKey/cart" element={<CartPage />} />
    <Route path="/store/:clientKey/orders" element={<OrderConfirmationPage />} />
    <Route path="/store/:clientKey/orders/:code" element={<OrderConfirmationPage />} />

    <Route path="/store/:clientKey/booking" element={<BookingRequestPage />} />

    <Route path="/store/:clientKey/hotels" element={<HotelSearchPage />} />
    <Route path="/store/:clientKey/hotels/results" element={<HotelResultsPage />} />
    <Route path="/store/:clientKey/hotels/lookup" element={<HotelLookupPage />} />
    <Route path="/store/:clientKey/hotels/book" element={<HotelBookingPage />} />
    <Route path="/store/:clientKey/hotels/pay/:reservationId" element={<HotelPaymentPage />} />
    <Route path="/store/:clientKey/hotels/confirmation/:bookingCode" element={<HotelConfirmationPage />} />
    <Route path="/store/:clientKey/hotels/:hotelId" element={<HotelDetailPage />} />

    <Route path="*" element={<Navigate to="/store" replace />} />
  </Routes>
);

export default StoreRoutes;
