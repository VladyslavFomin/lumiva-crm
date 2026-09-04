// frontend/src/pages/SetPasswordPage.tsx
import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const API_BASE = import.meta.env.VITE_PLATFORM_API_URL || "/v1";

const SetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token");

  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(t("crm.auth.setPassword.errors.missingToken"));
      return;
    }

    if (!password || password.length < 8) {
      return setError(t("crm.auth.setPassword.errors.shortPassword"));
    }
    if (password !== password2) {
      return setError(t("crm.auth.setPassword.errors.mismatch"));
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        throw new Error(msg?.message || t("crm.auth.setPassword.errors.failed"));
      }

      setSuccess(true);

      // через секунду уводим на логин
      setTimeout(() => navigate("/login"), 1200);
    } catch (e: any) {
      setError(e.message || t("crm.auth.setPassword.errors.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-white via-lumiva-bg to-lumiva-bg">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-[0_24px_70px_rgba(17,24,39,0.12)] p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1">
                {t("crm.auth.setPassword.brand")}
              </div>
              <div className="text-lg font-semibold text-lumiva-accent">
                {t("crm.auth.setPassword.title")}
              </div>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-black text-white border border-slate-200 flex items-center justify-center shadow-[0_10px_30px_rgba(17,24,39,0.18)]">
              <span className="text-xs font-semibold">CRM</span>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-6">
            {t("crm.auth.setPassword.subtitle")}
          </p>

          {!token && (
            <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {t("crm.auth.setPassword.tokenMissing")}
            </div>
          )}

          {error && (
            <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-3">
              {t("crm.auth.setPassword.success")}
              <br />
              {t("crm.auth.setPassword.redirect")}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  {t("crm.auth.setPassword.password")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("crm.auth.setPassword.passwordPlaceholder")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-lumiva-accent placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  {t("crm.auth.setPassword.confirm")}
                </label>
                <input
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder={t("crm.auth.setPassword.confirmPlaceholder")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-lumiva-accent placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-lumiva-accent shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full inline-flex items-center justify-center rounded-xl bg-lumiva-accent hover:bg-lumiva-accent-soft transition-all px-3 py-2.5 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(34,34,34,0.18)] hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading
                  ? t("crm.auth.setPassword.saving")
                  : t("crm.auth.setPassword.submit")}
              </button>

              <div className="text-center text-[11px] text-slate-500">
                {t("crm.auth.setPassword.footer")}
              </div>
            </form>
          )}
        </div>

        <div className="mt-4 text-center text-[11px] text-slate-500">
          © {new Date().getFullYear()} Lumiva
        </div>
      </div>
    </div>
  );
};

export default SetPasswordPage;
