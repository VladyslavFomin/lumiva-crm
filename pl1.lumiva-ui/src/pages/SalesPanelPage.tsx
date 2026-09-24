// src/pages/SalesPanelPage.tsx
import React, { useEffect, useState } from "react";
import {
  searchSalesProspects,
  fetchSalesProspects,
  fetchInvitationsForProspect,
  fetchSalesTemplates,
  sendSalesInvitation,
  updateSalesTemplate,
  uploadSalesAttachment,
  markProspectContacted,
  markProspectSkipped,
  unmarkProspectSkipped,
  markInvitationReplied,
  runReplyPollNow,
  type SalesProspect,
  type SalesInvitation,
  type SalesLanguage,
  type SalesOutreachStatus,
  type SalesTemplates,
  type SalesSearchUsage,
  type SalesAttachmentRef,
} from "../api/salesPanel";
import { getApiErrorMessage } from "../api/client";

type StatusFilter = "all" | SalesOutreachStatus;
type TriFilter = "any" | "has" | "missing";

function triToBool(value: TriFilter): boolean | undefined {
  if (value === "any") return undefined;
  return value === "has";
}

const LANGUAGE_LABELS: Record<SalesLanguage, string> = {
  en: "English",
  ru: "Русский",
  tr: "Türkçe",
};

const SalesPanelPage: React.FC = () => {
  const [prospects, setProspects] = useState<SalesProspect[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [city, setCity] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [websiteFilter, setWebsiteFilter] = useState<TriFilter>("any");
  const [emailFilter, setEmailFilter] = useState<TriFilter>("any");
  const [phoneFilter, setPhoneFilter] = useState<TriFilter>("any");

  const [usage, setUsage] = useState<SalesSearchUsage | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);

  const [templates, setTemplates] = useState<SalesTemplates | null>(null);

  // ---------- модал приглашения ----------
  const [inviteProspect, setInviteProspect] = useState<SalesProspect | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLanguage, setInviteLanguage] = useState<SalesLanguage>("ru");
  const [inviteSubject, setInviteSubject] = useState("");
  const [inviteBodyHtml, setInviteBodyHtml] = useState("");
  const [inviteAttachments, setInviteAttachments] = useState<SalesAttachmentRef[]>([]);
  const [inviteUploading, setInviteUploading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // ---------- модал шаблонов ----------
  const [templatesEditOpen, setTemplatesEditOpen] = useState(false);
  const [templatesEditLang, setTemplatesEditLang] = useState<SalesLanguage>("ru");
  const [templatesDraft, setTemplatesDraft] = useState<SalesTemplates | null>(null);
  const [templatesSaving, setTemplatesSaving] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // ---------- модал истории ----------
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProspect, setHistoryProspect] = useState<SalesProspect | null>(null);
  const [historyItems, setHistoryItems] = useState<SalesInvitation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadProspects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSalesProspects({
        city: city.trim() || undefined,
        businessType: businessType.trim() || undefined,
        search: quickSearch.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        hasWebsite: triToBool(websiteFilter),
        hasEmail: triToBool(emailFilter),
        hasPhone: triToBool(phoneFilter),
        pageSize: 200,
      });
      setProspects(res.items);
      setTotalCount(res.total);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProspects();
    fetchSalesTemplates()
      .then(setTemplates)
      .catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Фоновое обновление, чтобы подхватывать статус "Ответили" от автоматической проверки почты.
  useEffect(() => {
    const id = setInterval(() => {
      void loadProspects();
    }, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, businessType, quickSearch, statusFilter, websiteFilter, emailFilter, phoneFilter]);

  const handleSearch = async () => {
    if (!city.trim() || !businessType.trim()) {
      setError("Укажите город и тип бизнеса, чтобы искать через Google Places");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await searchSalesProspects({
        city: city.trim(),
        businessType: businessType.trim(),
      });
      setUsage(res.usage);
      setQuotaExceeded(res.quotaExceeded);
      // Google returns only this batch (~20), but the DB already has everything found
      // across all past searches — reload the full filtered list instead of replacing
      // the table with just this one search's results.
      await loadProspects();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allIds = prospects.map((p) => p.id);
      const next = new Set(prev);
      const allSelected = allIds.every((id) => next.has(id));
      if (allSelected) allIds.forEach((id) => next.delete(id));
      else allIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleMarkContactedBatch = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => markProspectContacted(id)));
      setProspects((prev) =>
        prev.map((p) =>
          selectedIds.has(p.id) && p.outreachStatus === "not_contacted"
            ? { ...p, outreachStatus: "sent" as SalesOutreachStatus }
            : p,
        ),
      );
      setSelectedIds(new Set());
      setToast(`Отмечено как связались: ${ids.length}`);
    } catch (e) {
      alert("Не удалось отметить: " + getApiErrorMessage(e));
    } finally {
      setBatchLoading(false);
    }
  };

  const handleMarkSkippedBatch = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => markProspectSkipped(id)));
      setProspects((prev) =>
        prev.map((p) =>
          selectedIds.has(p.id) ? { ...p, outreachStatus: "skipped" as SalesOutreachStatus } : p,
        ),
      );
      setSelectedIds(new Set());
      setToast(`Отмечено «не подходит»: ${ids.length}`);
    } catch (e) {
      alert("Не удалось отметить: " + getApiErrorMessage(e));
    } finally {
      setBatchLoading(false);
    }
  };

  const handleMarkSkipped = async (p: SalesProspect) => {
    try {
      await markProspectSkipped(p.id);
      setProspects((prev) =>
        prev.map((row) =>
          row.id === p.id ? { ...row, outreachStatus: "skipped" as SalesOutreachStatus } : row,
        ),
      );
    } catch (e) {
      alert("Не удалось отметить: " + getApiErrorMessage(e));
    }
  };

  const handleUnmarkSkipped = async (p: SalesProspect) => {
    try {
      await unmarkProspectSkipped(p.id);
      setProspects((prev) =>
        prev.map((row) =>
          row.id === p.id
            ? { ...row, outreachStatus: "not_contacted" as SalesOutreachStatus }
            : row,
        ),
      );
    } catch (e) {
      alert("Не удалось вернуть в работу: " + getApiErrorMessage(e));
    }
  };

  const loadTemplateIntoInvite = (lang: SalesLanguage, prospect: SalesProspect) => {
    if (!templates) return;
    const tpl = templates[lang];
    setInviteSubject(tpl.subject);
    setInviteBodyHtml(tpl.bodyHtml.split("{{businessName}}").join(prospect.name));
  };

  const openInviteModal = (p: SalesProspect) => {
    setInviteProspect(p);
    setInviteLanguage("ru");
    setInviteAttachments([]);
    setInviteError(null);
    loadTemplateIntoInvite("ru", p);
    setInviteOpen(true);
  };

  const handleInviteLanguageChange = (lang: SalesLanguage) => {
    setInviteLanguage(lang);
    if (inviteProspect) loadTemplateIntoInvite(lang, inviteProspect);
  };

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setInviteUploading(true);
    setInviteError(null);
    try {
      for (const file of Array.from(files)) {
        const ref = await uploadSalesAttachment(file);
        setInviteAttachments((prev) => [...prev, ref]);
      }
    } catch (e) {
      setInviteError(getApiErrorMessage(e));
    } finally {
      setInviteUploading(false);
    }
  };

  const removeAttachment = (relativePath: string) => {
    setInviteAttachments((prev) => prev.filter((a) => a.relativePath !== relativePath));
  };

  const handleSendInvite = async () => {
    if (!inviteProspect) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      const invitation = await sendSalesInvitation(inviteProspect.id, inviteLanguage, {
        subject: inviteSubject,
        bodyHtml: inviteBodyHtml,
        attachments: inviteAttachments,
      });
      if (invitation.status === "failed") {
        setInviteError(`Письмо не отправлено: ${invitation.failedReason || "неизвестная ошибка"}`);
        return;
      }
      setProspects((prev) =>
        prev.map((p) =>
          p.id === inviteProspect.id ? { ...p, outreachStatus: "sent" as SalesOutreachStatus } : p,
        ),
      );
      setInviteOpen(false);
      setToast(`Приглашение отправлено: ${inviteProspect.name}`);
    } catch (e) {
      setInviteError(getApiErrorMessage(e));
    } finally {
      setInviteLoading(false);
    }
  };

  const openTemplatesEditor = () => {
    if (templates) setTemplatesDraft(templates);
    setTemplatesEditLang("ru");
    setTemplatesError(null);
    setTemplatesEditOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templatesDraft) return;
    const draft = templatesDraft[templatesEditLang];
    if (!draft.subject.trim() || !draft.bodyHtml.trim()) {
      setTemplatesError("Тема и текст письма не могут быть пустыми");
      return;
    }
    setTemplatesSaving(true);
    setTemplatesError(null);
    try {
      await updateSalesTemplate(templatesEditLang, draft);
      const fresh = await fetchSalesTemplates();
      setTemplates(fresh);
      setToast(`Шаблон (${LANGUAGE_LABELS[templatesEditLang]}) сохранён`);
    } catch (e) {
      setTemplatesError(getApiErrorMessage(e));
    } finally {
      setTemplatesSaving(false);
    }
  };

  const openHistory = async (p: SalesProspect) => {
    setHistoryProspect(p);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const items = await fetchInvitationsForProspect(p.id);
      setHistoryItems(items);
    } catch (e) {
      alert("Не удалось загрузить историю: " + getApiErrorMessage(e));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleMarkReplied = async (p: SalesProspect) => {
    try {
      const items = await fetchInvitationsForProspect(p.id);
      const latest = items.find((i) => i.status === "sent") || items[0];
      if (!latest) {
        alert("Для этого бизнеса ещё нет отправленных приглашений");
        return;
      }
      await markInvitationReplied(latest.id);
      setProspects((prev) =>
        prev.map((row) =>
          row.id === p.id ? { ...row, outreachStatus: "replied" as SalesOutreachStatus } : row,
        ),
      );
    } catch (e) {
      alert("Не удалось отметить ответ: " + getApiErrorMessage(e));
    }
  };

  const handleCheckReplies = async () => {
    setPollLoading(true);
    try {
      const res = await runReplyPollNow();
      await loadProspects();
      setToast(`Проверено писем: ${res.scanned}, новых ответов: ${res.matched}`);
    } catch (e) {
      alert("Не удалось проверить ответы: " + getApiErrorMessage(e));
    } finally {
      setPollLoading(false);
    }
  };

  const statusPill = (status: SalesOutreachStatus) => {
    if (status === "sent") return <span className="pl1-pill pl1-pill-green">Отправлено</span>;
    if (status === "replied") return <span className="pl1-pill pl1-pill-blue">Ответили</span>;
    if (status === "skipped") return <span className="pl1-pill pl1-pill-muted">Не подходит</span>;
    return <span className="pl1-pill pl1-pill-gray">Не связывались</span>;
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("ru-RU");
  };

  return (
    <div className="pl1-page">
      <header className="pl1-page-header">
        <div>
          <h1 className="pl1-page-title">Панель продаж</h1>
          <p className="pl1-page-subtitle">
            Поиск потенциальных клиентов по городу и типу бизнеса, рассылка приглашений о
            сотрудничестве.
          </p>
        </div>
        <div className="pl1-header-actions">
          <button type="button" className="pl1-btn-outline" onClick={openTemplatesEditor}>
            Шаблоны писем
          </button>
          <button
            type="button"
            className="pl1-btn-outline"
            onClick={() => void loadProspects()}
            disabled={loading}
          >
            {loading ? "Обновляем…" : "Обновить список"}
          </button>
          <button
            type="button"
            className="pl1-btn-outline"
            onClick={() => void handleCheckReplies()}
            disabled={pollLoading}
          >
            {pollLoading ? "Проверяем…" : "Проверить ответы сейчас"}
          </button>
        </div>
      </header>

      {toast && (
        <div className="px-4 py-2 text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/40 rounded-xl mb-2">
          {toast}
          <button
            type="button"
            className="pl1-link-button ml-3"
            onClick={() => setToast(null)}
          >
            Закрыть
          </button>
        </div>
      )}

      {error && (
        <div className="pl1-alert pl1-alert-error">
          <span className="pl1-alert-badge">ERROR</span>
          <span>{error}</span>
        </div>
      )}

      {quotaExceeded && (
        <div className="pl1-alert pl1-alert-error">
          <span className="pl1-alert-badge">QUOTA</span>
          <span>
            Достигнут суточный лимит запросов Google Places Details. Показаны уже
            закэшированные данные, новые детали (телефон/сайт/email) подтянутся завтра.
          </span>
        </div>
      )}

      <section className="pl1-filters">
        <div className="pl1-filters-left">
          <input
            className="pl1-input"
            placeholder="Город (например: Стамбул)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <input
            className="pl1-input"
            placeholder="Тип бизнеса (например: ресторан)"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
          />
          <button
            type="button"
            className="pl1-btn-primary"
            onClick={() => void handleSearch()}
            disabled={searching}
            title="Использует платный Google Places API"
          >
            {searching ? "Ищем…" : "Искать (Google Places)"}
          </button>
        </div>
        <div className="pl1-filters-right">
          <input
            className="pl1-input"
            placeholder="Поиск по названию/email…"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void loadProspects();
            }}
          />
          <select
            className="pl1-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">Все статусы</option>
            <option value="not_contacted">Не связывались</option>
            <option value="sent">Отправлено</option>
            <option value="replied">Ответили</option>
            <option value="skipped">Не подходит</option>
          </select>
          <select
            className="pl1-select"
            value={websiteFilter}
            onChange={(e) => setWebsiteFilter(e.target.value as TriFilter)}
          >
            <option value="any">Сайт: любой</option>
            <option value="has">Сайт: есть</option>
            <option value="missing">Сайт: нет</option>
          </select>
          <select
            className="pl1-select"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value as TriFilter)}
          >
            <option value="any">Email: любой</option>
            <option value="has">Email: есть</option>
            <option value="missing">Email: нет</option>
          </select>
          <select
            className="pl1-select"
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value as TriFilter)}
          >
            <option value="any">Телефон: любой</option>
            <option value="has">Телефон: есть</option>
            <option value="missing">Телефон: нет</option>
          </select>
          <button type="button" className="pl1-btn-outline" onClick={() => void loadProspects()}>
            Применить
          </button>
        </div>
      </section>

      {usage && (
        <p className="text-[11px] text-slate-500 -mt-2 mb-2">
          Google Places сегодня: {usage.placesTextSearchCalls} поисков,{" "}
          {usage.placesDetailsCalls}/{usage.dailyDetailsCap} запросов деталей.
        </p>
      )}

      {totalCount > prospects.length && (
        <div className="pl1-alert pl1-alert-error">
          <span className="pl1-alert-badge">INFO</span>
          <span>
            По текущим фильтрам найдено {totalCount}, показаны первые {prospects.length}.
            Сузьте фильтры (город/тип/статус), чтобы увидеть остальные.
          </span>
        </div>
      )}

      <div className="pl1-card pl1-card-table">
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm text-slate-200">
            <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs text-slate-200">
              Выбрано: {selectedIds.size}
            </span>
            <button
              type="button"
              className="pl1-btn-outline"
              onClick={() => void handleMarkContactedBatch()}
              disabled={batchLoading}
            >
              Отметить как связались
            </button>
            <button
              type="button"
              className="pl1-btn-outline"
              onClick={() => void handleMarkSkippedBatch()}
              disabled={batchLoading}
            >
              Не подходит
            </button>
          </div>
        )}
        <table className="pl1-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={prospects.length > 0 && prospects.every((p) => selectedIds.has(p.id))}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Бизнес</th>
              <th>Телефон</th>
              <th>Email</th>
              <th>Сайт</th>
              <th>Адрес</th>
              <th>Статус</th>
              <th className="pl1-col-actions">Действия</th>
            </tr>
          </thead>
          <tbody>
            {prospects.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="pl1-table-empty">
                  Ничего не найдено. Укажите город и тип бизнеса и нажмите «Искать».
                </td>
              </tr>
            )}

            {prospects.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                  />
                </td>
                <td>
                  <div>{p.name}</div>
                  {p.searchCity && (
                    <div className="text-[11px] text-slate-500">{p.searchCity}</div>
                  )}
                </td>
                <td>{p.phone || "—"}</td>
                <td>
                  {p.email ? (
                    <a className="pl1-link-button" href={`mailto:${p.email}`}>
                      {p.email}
                    </a>
                  ) : p.emailStatus === "not_found" ? (
                    <span className="pl1-pill pl1-pill-gray">не найден</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td>
                  {p.website ? (
                    <a
                      className="pl1-link-button"
                      href={p.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Сайт
                    </a>
                  ) : (
                    <span className="pl1-pill pl1-pill-gray">нет сайта</span>
                  )}
                </td>
                <td className="max-w-[220px]">
                  <div className="truncate text-sm text-slate-200">
                    {p.formattedAddress || "—"}
                  </div>
                </td>
                <td>{statusPill(p.outreachStatus)}</td>
                <td className="pl1-col-actions">
                  {p.outreachStatus !== "skipped" && (
                    <button
                      type="button"
                      className="pl1-link-button"
                      onClick={() => openInviteModal(p)}
                      disabled={!p.email}
                      title={!p.email ? "У бизнеса не найден email" : undefined}
                    >
                      Написать
                    </button>
                  )}
                  <button type="button" className="pl1-link-button" onClick={() => void openHistory(p)}>
                    История
                  </button>
                  {p.googleMapsUrl && (
                    <a
                      className="pl1-link-button"
                      href={p.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Перейти
                    </a>
                  )}
                  {p.outreachStatus === "sent" && (
                    <button
                      type="button"
                      className="pl1-link-button"
                      onClick={() => void handleMarkReplied(p)}
                    >
                      Отметить как отвечено
                    </button>
                  )}
                  {p.outreachStatus === "skipped" ? (
                    <button
                      type="button"
                      className="pl1-link-button"
                      onClick={() => void handleUnmarkSkipped(p)}
                    >
                      Вернуть в работу
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pl1-link-button"
                      onClick={() => void handleMarkSkipped(p)}
                    >
                      Не подходит
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {loading && (
              <tr>
                <td colSpan={8} className="pl1-table-empty">
                  Загрузка…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- МОДАЛ ПРИГЛАШЕНИЯ ---------- */}
      {inviteOpen && inviteProspect && (
        <div
          className="pl1-modal-backdrop"
          onClick={() => !inviteLoading && setInviteOpen(false)}
        >
          <div className="pl1-modal" style={{ width: 900, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 className="pl1-modal-title">Приглашение к сотрудничеству</h2>
            <p className="pl1-modal-subtitle">
              {inviteProspect.name}
              {inviteProspect.formattedAddress ? ` — ${inviteProspect.formattedAddress}` : ""}
              <br />
              Кому: {inviteProspect.email}
            </p>

            <div className="pl1-modal-form">
              <label className="pl1-field">
                <span>Язык шаблона (загружает текст ниже заново)</span>
                <select
                  className="pl1-select"
                  value={inviteLanguage}
                  onChange={(e) => handleInviteLanguageChange(e.target.value as SalesLanguage)}
                >
                  {(Object.keys(LANGUAGE_LABELS) as SalesLanguage[]).map((lang) => (
                    <option key={lang} value={lang}>
                      {LANGUAGE_LABELS[lang]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pl1-field">
                <span>Тема письма</span>
                <input
                  className="pl1-input"
                  value={inviteSubject}
                  onChange={(e) => setInviteSubject(e.target.value)}
                />
              </label>

              <label className="pl1-field">
                <span>Текст письма (HTML)</span>
                <textarea
                  className="pl1-textarea"
                  rows={14}
                  value={inviteBodyHtml}
                  onChange={(e) => setInviteBodyHtml(e.target.value)}
                />
              </label>

              <label className="pl1-field">
                <span>Предпросмотр</span>
                <div
                  style={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: 12,
                    maxHeight: 260,
                    overflow: "auto",
                    background: "#fff",
                  }}
                  dangerouslySetInnerHTML={{ __html: inviteBodyHtml }}
                />
              </label>

              <label className="pl1-field">
                <span>Вложения (презентации, PDF и т.д., до 20МБ каждое)</span>
                <input
                  type="file"
                  multiple
                  onChange={(e) => void handleAttachFiles(e.target.files)}
                  disabled={inviteUploading}
                />
                {inviteUploading && (
                  <span className="text-[11px] text-slate-500">Загружаем…</span>
                )}
                {inviteAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {inviteAttachments.map((a) => (
                      <span
                        key={a.relativePath}
                        className="pl1-pill pl1-pill-gray"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        {a.filename}
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.relativePath)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "inherit",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </label>

              {inviteError && (
                <div className="pl1-alert pl1-alert-error">
                  <span className="pl1-alert-badge">ERROR</span>
                  <span>{inviteError}</span>
                </div>
              )}

              <div className="pl1-modal-actions">
                <button
                  type="button"
                  className="pl1-btn-ghost"
                  onClick={() => !inviteLoading && setInviteOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="pl1-btn-primary"
                  onClick={() => void handleSendInvite()}
                  disabled={inviteLoading}
                >
                  {inviteLoading ? "Отправляем…" : "Отправить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- МОДАЛ ИСТОРИИ ---------- */}
      {historyOpen && historyProspect && (
        <div className="pl1-modal-backdrop" onClick={() => setHistoryOpen(false)}>
          <div className="pl1-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="pl1-modal-title">История приглашений</h2>
            <p className="pl1-modal-subtitle">{historyProspect.name}</p>

            {historyLoading && <p className="text-sm text-slate-400">Загрузка…</p>}
            {!historyLoading && historyItems.length === 0 && (
              <p className="text-sm text-slate-400">Писем ещё не отправляли.</p>
            )}
            {!historyLoading && historyItems.length > 0 && (
              <div className="flex flex-col gap-3">
                {historyItems.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      border: "1px solid rgba(148,163,184,0.25)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {LANGUAGE_LABELS[inv.language]} · {inv.toEmail}
                      </span>
                      {inv.status === "replied" && (
                        <span className="pl1-pill pl1-pill-blue">Ответили</span>
                      )}
                      {inv.status === "sent" && (
                        <span className="pl1-pill pl1-pill-green">Отправлено</span>
                      )}
                      {inv.status === "failed" && (
                        <span className="pl1-pill pl1-pill-red">Ошибка</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Отправлено: {formatDateTime(inv.sentAt)}
                    </div>
                    {inv.repliedAt && (
                      <div className="text-[11px] text-slate-500">
                        Ответ получен: {formatDateTime(inv.repliedAt)}
                        {inv.replyMatchedBy === "manual" ? " (отмечено вручную)" : ""}
                      </div>
                    )}
                    {inv.replySnippet && (
                      <div className="text-xs text-slate-300 mt-2 whitespace-pre-wrap">
                        «{inv.replySnippet}»
                      </div>
                    )}
                    {inv.failedReason && (
                      <div className="text-xs text-red-300 mt-2">{inv.failedReason}</div>
                    )}
                    {inv.attachments && inv.attachments.length > 0 && (
                      <div className="text-[11px] text-slate-500 mt-2">
                        Вложения: {inv.attachments.map((a) => a.filename).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pl1-modal-actions">
              <button
                type="button"
                className="pl1-btn-ghost"
                onClick={() => setHistoryOpen(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- МОДАЛ ШАБЛОНОВ ---------- */}
      {templatesEditOpen && templatesDraft && (
        <div
          className="pl1-modal-backdrop"
          onClick={() => !templatesSaving && setTemplatesEditOpen(false)}
        >
          <div className="pl1-modal" style={{ width: 900, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 className="pl1-modal-title">Шаблоны писем</h2>
            <p className="pl1-modal-subtitle">
              Тема и HTML-текст на каждый язык. Плейсхолдер {"{{businessName}}"} подставится
              названием бизнеса при отправке.
            </p>

            <div className="flex gap-2 mb-3">
              {(Object.keys(LANGUAGE_LABELS) as SalesLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={templatesEditLang === lang ? "pl1-btn-primary" : "pl1-btn-outline"}
                  onClick={() => setTemplatesEditLang(lang)}
                >
                  {LANGUAGE_LABELS[lang]}
                </button>
              ))}
            </div>

            <div className="pl1-modal-form">
              <label className="pl1-field">
                <span>Тема письма</span>
                <input
                  className="pl1-input"
                  value={templatesDraft[templatesEditLang].subject}
                  onChange={(e) =>
                    setTemplatesDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            [templatesEditLang]: {
                              ...prev[templatesEditLang],
                              subject: e.target.value,
                            },
                          }
                        : prev,
                    )
                  }
                />
              </label>

              <label className="pl1-field">
                <span>Текст письма (HTML)</span>
                <textarea
                  className="pl1-textarea"
                  rows={18}
                  value={templatesDraft[templatesEditLang].bodyHtml}
                  onChange={(e) =>
                    setTemplatesDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            [templatesEditLang]: {
                              ...prev[templatesEditLang],
                              bodyHtml: e.target.value,
                            },
                          }
                        : prev,
                    )
                  }
                />
              </label>

              <label className="pl1-field">
                <span>Предпросмотр</span>
                <div
                  style={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: 12,
                    maxHeight: 260,
                    overflow: "auto",
                    background: "#fff",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: templatesDraft[templatesEditLang].bodyHtml
                      .split("{{businessName}}")
                      .join("ООО «Пример»"),
                  }}
                />
              </label>

              {templatesError && (
                <div className="pl1-alert pl1-alert-error">
                  <span className="pl1-alert-badge">ERROR</span>
                  <span>{templatesError}</span>
                </div>
              )}

              <div className="pl1-modal-actions">
                <button
                  type="button"
                  className="pl1-btn-ghost"
                  onClick={() => !templatesSaving && setTemplatesEditOpen(false)}
                >
                  Закрыть
                </button>
                <button
                  type="button"
                  className="pl1-btn-primary"
                  onClick={() => void handleSaveTemplate()}
                  disabled={templatesSaving}
                >
                  {templatesSaving
                    ? "Сохраняем…"
                    : `Сохранить (${LANGUAGE_LABELS[templatesEditLang]})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPanelPage;
