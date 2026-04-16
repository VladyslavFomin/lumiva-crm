// src/pages/PanelLoginPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setPanelAuthed } from "../auth/panelSession";
import { apiClient, getApiErrorMessage } from "../api/client";

const DEFAULT_EMAIL = import.meta.env.VITE_PANEL_EMAIL ?? "admin@lumiva.agency";
const PANEL_PASSWORD = import.meta.env.VITE_PANEL_PASSWORD ?? "";

const PanelLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Введите email и пароль");
      return;
    }

    setLoading(true);

    try {
      if (PANEL_PASSWORD && password !== PANEL_PASSWORD) {
        setError("Неверный email или пароль");
        return;
      }

      const res = await apiClient.post("/platform/auth/login", {
        email: email.trim(),
        password,
      });
      const accessToken = res.data?.accessToken;
      if (!accessToken) {
        setError("Не удалось получить токен доступа");
        return;
      }
      apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      setPanelAuthed(accessToken);
      navigate("/", { replace: true });
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(msg || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pl1-login-screen">
      <div className="pl1-login-box">
        <div className="pl1-login-logo">LUMIVA PLATFORM</div>

        <h1 className="pl1-login-title">Доступ к панели управления</h1>

        <p className="pl1-login-desc">
          Эта страница защищает панель управления тенантами.  
          Введите email и пароль для входа.
        </p>

        <form className="pl1-login-form" onSubmit={handleSubmit}>
          <label className="pl1-field">
            <span>Email</span>
            <input
              type="email"
              className="pl1-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </label>
          <label className="pl1-field">
            <span>Пароль</span>
            <input
              type="password"
              className="pl1-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <div className="pl1-error-box">{error}</div>}

          <button type="submit" className="pl1-btn" disabled={loading}>
            {loading ? "Проверяем…" : "Войти в панель"}
          </button>
        </form>

        <p className="pl1-login-footer">
          Доступ есть только у администраторов платформы.  
          Если вы видите эту страницу и не знаете пароль, просто закройте вкладку.
        </p>
      </div>
    </div>
  );
};

export default PanelLoginPage;
