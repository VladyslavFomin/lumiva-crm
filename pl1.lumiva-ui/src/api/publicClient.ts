// src/api/publicClient.ts
// Отдельный axios-инстанс для публичных (без авторизации) страниц тестовой витрины (/store/*).
// Не переиспользует `apiClient` из client.ts намеренно: там interceptors всегда цепляют
// admin-JWT и на любой 401 редиректят на /panel-login — для анонимного покупателя это не нужно
// и даже вредно (see текущий план "Test storefront" / lumiva_pl1_platform_admin.md).
import axios from "axios";

const baseURL =
  import.meta.env.VITE_PLATFORM_API_URL?.trim() ||
  "https://crm.lumiva.agency/v1";

export const publicClient = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: false,
});

export { getApiErrorMessage } from "./client";
