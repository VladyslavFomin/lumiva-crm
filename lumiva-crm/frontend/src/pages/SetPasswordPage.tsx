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
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, #1f2937 0, #020617 55%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "#e5e7eb",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,system-ui,Segoe UI,Roboto,sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background:
            "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(15,23,42,0.98))",
          borderRadius: "16px",
          padding: "28px 26px 26px",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(148,163,184,0.12)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div style={{ marginBottom: "18px" }}>
          <div
            style={{
              fontSize: "13px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6b7280",
              marginBottom: "4px",
            }}
          >
            {t("crm.auth.setPassword.brand")}
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "6px" }}>
            {t("crm.auth.setPassword.title")}
          </h1>
          <p style={{ fontSize: "14px", color: "#9ca3af" }}>
            {t("crm.auth.setPassword.subtitle")}
          </p>
        </div>

        {!token && (
          <div
            style={{
              marginBottom: "14px",
              background: "rgba(248,113,113,0.12)",
              color: "#fecaca",
              padding: "10px 12px",
              borderRadius: "10px",
              fontSize: "13px",
              border: "1px solid rgba(248,113,113,0.4)",
            }}
          >
            {t("crm.auth.setPassword.tokenMissing")}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: "14px",
              background: "rgba(248,113,113,0.12)",
              color: "#fecaca",
              padding: "10px 12px",
              borderRadius: "10px",
              fontSize: "13px",
              border: "1px solid rgba(248,113,113,0.4)",
            }}
          >
            {error}
          </div>
        )}

        {success ? (
          <div
            style={{
              background: "rgba(34,197,94,0.12)",
              color: "#bbf7d0",
              padding: "12px 14px",
              borderRadius: "10px",
              fontSize: "14px",
              border: "1px solid rgba(34,197,94,0.45)",
              textAlign: "center",
            }}
          >
            {t("crm.auth.setPassword.success")}
            <br />
            {t("crm.auth.setPassword.redirect")}
          </div>
        ) : (
          <form onSubmit={submit}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                color: "#e5e7eb",
              }}
            >
              {t("crm.auth.setPassword.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("crm.auth.setPassword.passwordPlaceholder")}
              style={inputStyle}
            />

            <label
              style={{
                display: "block",
                marginTop: "16px",
                marginBottom: "6px",
                fontSize: "13px",
                color: "#e5e7eb",
              }}
            >
              {t("crm.auth.setPassword.confirm")}
            </label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder={t("crm.auth.setPassword.confirmPlaceholder")}
              style={inputStyle}
            />

            <button
              type="submit"
              disabled={loading || !token}
              style={{
                width: "100%",
                marginTop: "22px",
                padding: "11px 14px",
                borderRadius: "999px",
                background:
                  loading || !token
                    ? "linear-gradient(135deg,#4f46e5aa,#06b6d4aa)"
                    : "linear-gradient(135deg,#4f46e5,#06b6d4)",
                border: "none",
                color: "white",
                cursor:
                  loading || !token ? "default" : "pointer",
                fontSize: "15px",
                fontWeight: 500,
                boxShadow: "0 18px 40px rgba(37,99,235,0.45)",
                transition: "transform 0.12s ease, box-shadow 0.12s ease",
              }}
            >
              {loading
                ? t("crm.auth.setPassword.saving")
                : t("crm.auth.setPassword.submit")}
            </button>

            <div
              style={{
                marginTop: "14px",
                fontSize: "12px",
                color: "#6b7280",
                textAlign: "center",
              }}
            >
              {t("crm.auth.setPassword.footer")}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  background: "rgba(15,23,42,0.9)",
  borderRadius: "10px",
  border: "1px solid rgba(148,163,184,0.55)",
  color: "#e5e7eb",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

export default SetPasswordPage;
