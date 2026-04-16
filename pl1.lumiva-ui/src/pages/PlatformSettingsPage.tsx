import React, { useEffect, useState } from "react";
import {
  fetchPlatformSettings,
  fetchBillingHealth,
  updatePlatformSettings,
  sendTelegramTest,
  sendStripeTest,
} from "../api/settings";
import type { BillingPlanContent, BillingHealth } from "../api/settings";

const DEFAULT_BILLING_PLANS: BillingPlanContent[] = [
  {
    code: "standard",
    title: "Standard",
    price: "EUR 14",
    subtitle: "Для быстрого запуска команды",
    description: "Базовый контур CRM для ежедневной работы отдела продаж и маркетинга.",
    features: [
      "Лиды, контакты, компании и сделки",
      "Воронка продаж и базовая аналитика",
      "Маркетинг и UTM-метки",
      "Email шаблоны и отправки",
      "Проекты и задачи",
      "Интеграции CF7 / WooCommerce",
    ],
    highlighted: false,
    i18n: {
      en: {
        subtitle: "For quick team launch",
        description: "Core CRM setup for daily sales and marketing operations.",
        features: [
          "Leads, contacts, companies and deals",
          "Pipeline and basic sales analytics",
          "Marketing and UTM tags",
          "Email templates and campaigns",
          "Projects and tasks",
          "CF7 / WooCommerce integrations",
        ],
      },
      tr: {
        subtitle: "Ekip başlangıcı için",
        description: "Satış ve pazarlama ekiplerinin günlük çalışması için temel CRM yapısı.",
        features: [
          "Lead, kişi, şirket ve fırsat yönetimi",
          "Pipeline ve temel satış analitiği",
          "Pazarlama ve UTM etiketleri",
          "Email şablonları ve gönderimler",
          "Projeler ve görevler",
          "CF7 / WooCommerce entegrasyonları",
        ],
      },
    },
  },
  {
    code: "professional",
    title: "Professional",
    price: "EUR 23",
    subtitle: "Для роста и автоматизации",
    description: "Подходит для масштабирования и усиления управляемости процессов.",
    features: [
      "Все из Standard",
      "Автоматизации и триггерные сценарии",
      "Telegram и чат-модуль",
      "SMM и расширенные интеграции",
      "Sales pipeline + KPI аналитика",
      "Расширенные права и процессы команд",
    ],
    highlighted: false,
    i18n: {
      en: {
        subtitle: "For growth and automation",
        description: "Designed for scaling and improving process control.",
        features: [
          "Everything in Standard",
          "Automation and trigger scenarios",
          "Telegram and chat module",
          "SMM and advanced integrations",
          "Sales pipeline + KPI analytics",
          "Advanced roles and team workflows",
        ],
      },
      tr: {
        subtitle: "Büyüme ve otomasyon için",
        description: "Ölçeklenme ve süreç yönetimini güçlendirmek için uygundur.",
        features: [
          "Standard içindeki her şey",
          "Otomasyon ve tetikleyici senaryolar",
          "Telegram ve sohbet modülü",
          "SMM ve gelişmiş entegrasyonlar",
          "Satış pipeline + KPI analitiği",
          "Gelişmiş rol ve ekip süreçleri",
        ],
      },
    },
  },
  {
    code: "enterprise",
    title: "Enterprise",
    price: "EUR 40",
    subtitle: "Для системных корпоративных команд",
    description: "Максимум контроля, безопасности и глубокой аналитики для руководителей.",
    features: [
      "Все из Professional",
      "Client Accounts и клиентские порталы",
      "Глубокая BI/аналитика по отделам",
      "Планирование внедрения под ваш процесс",
      "Консалтинг по оптимизации продаж",
      "Поддержка 24/7 с SLA",
    ],
    highlighted: true,
    i18n: {
      en: {
        subtitle: "For enterprise teams",
        description: "Maximum control, security, and deep analytics for leadership.",
        features: [
          "Everything in Professional",
          "Client Accounts and client portals",
          "Deep BI analytics by departments",
          "Implementation planning for your process",
          "Sales optimization consulting",
          "24/7 support with SLA",
        ],
      },
      tr: {
        subtitle: "Kurumsal ekipler için",
        description: "Yönetim için maksimum kontrol, güvenlik ve derin analitik.",
        features: [
          "Professional içindeki her şey",
          "Client Accounts ve müşteri portalları",
          "Departman bazlı derin BI analitiği",
          "Süreçlerinize özel kurulum planı",
          "Satış optimizasyon danışmanlığı",
          "SLA ile 24/7 destek",
        ],
      },
    },
  },
  {
    code: "ultimate",
    title: "Ultimate",
    price: "EUR 52",
    subtitle: "Для сложных внедрений и масштабирования",
    description: "Премиальный пакет с сопровождением, консалтингом и кастомизацией.",
    features: [
      "Все из Enterprise",
      "Индивидуальная архитектура под бизнес",
      "Приоритетная техническая линия 24/7",
      "Выделенный консалтинг и roadmap",
      "Миграция и сопровождение релизов",
      "Экспертная поддержка сложных интеграций",
    ],
    highlighted: false,
    i18n: {
      en: {
        subtitle: "For complex implementations and scaling",
        description: "Premium package with consulting and custom implementation support.",
        features: [
          "Everything in Enterprise",
          "Business-tailored architecture",
          "Priority technical support 24/7",
          "Dedicated consulting and roadmap",
          "Migration and release support",
          "Expert support for complex integrations",
        ],
      },
      tr: {
        subtitle: "Karmaşık kurulum ve ölçekleme için",
        description: "Danışmanlık ve özelleştirme desteği içeren premium paket.",
        features: [
          "Enterprise içindeki her şey",
          "İşinize özel mimari",
          "Öncelikli teknik destek 24/7",
          "Özel danışmanlık ve roadmap",
          "Migrasyon ve release desteği",
          "Karmaşık entegrasyonlar için uzman destek",
        ],
      },
    },
  },
];

const PlatformSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [stripeTesting, setStripeTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [billingHealth, setBillingHealth] = useState<BillingHealth | null>(null);
  const [form, setForm] = useState({
    telegramBotToken: "",
    telegramChatId: "",
    googleOauthClientId: "",
    googleOauthClientSecret: "",
    metaOauthAppId: "",
    metaOauthAppSecret: "",
    vkOauthClientId: "",
    vkOauthClientSecret: "",
    stripeSecretKey: "",
    stripePublishableKey: "",
    stripeWebhookSecret: "",
    stripePriceStandard: "",
    stripePriceProfessional: "",
    stripePriceEnterprise: "",
    stripePriceUltimate: "",
    billingPlans: DEFAULT_BILLING_PLANS as BillingPlanContent[],
    openAiApiKey: "",
    openAiBaseUrl: "https://api.openai.com/v1",
    openAiModel: "gpt-4o-mini",
    openAiImageModel: "dall-e-3",
    aiPriceInputPerMtokUsd: "0.15",
    aiPriceOutputPerMtokUsd: "0.60",
    aiImageCostCents: "8",
    stripePriceAiCredits: "",
    stripePriceStoragePack: "",
    aiCreditsPackAmountCents: "1000",
    storagePackBytes: "1073741824",
    integrationOAuthAppsJson: "{}",
  });
  const crmApiBase =
    import.meta.env.VITE_CRM_API_URL ||
    import.meta.env.VITE_API_BASE ||
    "https://crm.lumiva.agency/v1";
  const billingWebhookUrl = `${crmApiBase}/billing/stripe/webhook`;
  const stripeConfigured =
    !!form.stripeSecretKey.trim() &&
    !!form.stripeWebhookSecret.trim() &&
    !!form.stripePriceStandard.trim() &&
    !!form.stripePriceProfessional.trim() &&
    !!form.stripePriceEnterprise.trim() &&
    !!form.stripePriceUltimate.trim();

  const loadHealth = async () => {
    try {
      const health = await fetchBillingHealth();
      setBillingHealth(health);
    } catch {
      setBillingHealth(null);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlatformSettings();
      setForm({
        telegramBotToken: data.telegramBotToken || "",
        telegramChatId: data.telegramChatId || "",
        googleOauthClientId: data.googleOauthClientId || "",
        googleOauthClientSecret: data.googleOauthClientSecret || "",
        metaOauthAppId: data.metaOauthAppId || "",
        metaOauthAppSecret: data.metaOauthAppSecret || "",
        vkOauthClientId: data.vkOauthClientId || "",
        vkOauthClientSecret: data.vkOauthClientSecret || "",
        stripeSecretKey: data.stripeSecretKey || "",
        stripePublishableKey: data.stripePublishableKey || "",
        stripeWebhookSecret: data.stripeWebhookSecret || "",
        stripePriceStandard: data.stripePriceStandard || "",
        stripePriceProfessional: data.stripePriceProfessional || "",
        stripePriceEnterprise: data.stripePriceEnterprise || "",
        stripePriceUltimate: data.stripePriceUltimate || "",
        billingPlans: data.billingPlans && data.billingPlans.length ? data.billingPlans : DEFAULT_BILLING_PLANS,
        openAiApiKey: data.openAiApiKey || "",
        openAiBaseUrl: data.openAiBaseUrl || "https://api.openai.com/v1",
        openAiModel: data.openAiModel || "gpt-4o-mini",
        openAiImageModel: data.openAiImageModel || "dall-e-3",
        aiPriceInputPerMtokUsd: data.aiPriceInputPerMtokUsd || "0.15",
        aiPriceOutputPerMtokUsd: data.aiPriceOutputPerMtokUsd || "0.60",
        aiImageCostCents:
          data.aiImageCostCents != null ? String(data.aiImageCostCents) : "8",
        stripePriceAiCredits: data.stripePriceAiCredits || "",
        stripePriceStoragePack: data.stripePriceStoragePack || "",
        aiCreditsPackAmountCents:
          data.aiCreditsPackAmountCents != null
            ? String(data.aiCreditsPackAmountCents)
            : "1000",
        storagePackBytes: data.storagePackBytes || "1073741824",
        integrationOAuthAppsJson: JSON.stringify(data.integrationOAuthApps || {}, null, 2),
      });
      await loadHealth();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      let integrationOAuthApps: Record<
        string,
        { clientId?: string | null; clientSecret?: string | null }
      > | null = null;
      const rawApps = form.integrationOAuthAppsJson.trim();
      if (rawApps) {
        try {
          const parsed = JSON.parse(rawApps) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            integrationOAuthApps = parsed as Record<
              string,
              { clientId?: string | null; clientSecret?: string | null }
            >;
          } else {
            throw new Error("integrationOAuthApps must be a JSON object");
          }
        } catch (e) {
          setError(
            `CRM integration OAuth JSON: ${(e as Error).message || "некорректный JSON"}`,
          );
          setSaving(false);
          return;
        }
      }
      await updatePlatformSettings({
        telegramBotToken: form.telegramBotToken.trim() || null,
        telegramChatId: form.telegramChatId.trim() || null,
        googleOauthClientId: form.googleOauthClientId.trim() || null,
        googleOauthClientSecret: form.googleOauthClientSecret.trim() || null,
        metaOauthAppId: form.metaOauthAppId.trim() || null,
        metaOauthAppSecret: form.metaOauthAppSecret.trim() || null,
        vkOauthClientId: form.vkOauthClientId.trim() || null,
        vkOauthClientSecret: form.vkOauthClientSecret.trim() || null,
        stripeSecretKey: form.stripeSecretKey.trim() || null,
        stripePublishableKey: form.stripePublishableKey.trim() || null,
        stripeWebhookSecret: form.stripeWebhookSecret.trim() || null,
        stripePriceStandard: form.stripePriceStandard.trim() || null,
        stripePriceProfessional: form.stripePriceProfessional.trim() || null,
        stripePriceEnterprise: form.stripePriceEnterprise.trim() || null,
        stripePriceUltimate: form.stripePriceUltimate.trim() || null,
        openAiApiKey: form.openAiApiKey.trim() || null,
        openAiBaseUrl: form.openAiBaseUrl.trim() || null,
        openAiModel: form.openAiModel.trim() || null,
        openAiImageModel: form.openAiImageModel.trim() || null,
        aiPriceInputPerMtokUsd: form.aiPriceInputPerMtokUsd.trim() || null,
        aiPriceOutputPerMtokUsd: form.aiPriceOutputPerMtokUsd.trim() || null,
        aiImageCostCents: parseInt(form.aiImageCostCents, 10) || null,
        stripePriceAiCredits: form.stripePriceAiCredits.trim() || null,
        stripePriceStoragePack: form.stripePriceStoragePack.trim() || null,
        aiCreditsPackAmountCents: parseInt(form.aiCreditsPackAmountCents, 10) || null,
        storagePackBytes: form.storagePackBytes.trim() || null,
        billingPlans: form.billingPlans.map((plan) => ({
          ...plan,
          title: plan.title.trim(),
          price: plan.price.trim(),
          subtitle: plan.subtitle.trim(),
          description: plan.description.trim(),
          features: plan.features.map((f) => f.trim()).filter(Boolean),
          i18n: {
            en: {
              subtitle: plan.i18n?.en?.subtitle?.trim() || "",
              description: plan.i18n?.en?.description?.trim() || "",
              features: (plan.i18n?.en?.features || []).map((f) => f.trim()).filter(Boolean),
            },
            tr: {
              subtitle: plan.i18n?.tr?.subtitle?.trim() || "",
              description: plan.i18n?.tr?.description?.trim() || "",
              features: (plan.i18n?.tr?.features || []).map((f) => f.trim()).filter(Boolean),
            },
          },
        })),
        integrationOAuthApps,
      });
      setStatus("Сохранено");
      await loadHealth();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const testTelegram = async () => {
    setTesting(true);
    setError(null);
    setStatus(null);
    try {
      await sendTelegramTest();
      setStatus("Тестовое сообщение отправлено.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const testStripe = async () => {
    setStripeTesting(true);
    setError(null);
    setStatus(null);
    try {
      await sendStripeTest();
      setStatus("Stripe настроен корректно.");
      await loadHealth();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStripeTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
          Настройки
        </p>
        <h1 className="text-xl font-semibold text-slate-50">
          Уведомления и интеграции
        </h1>
        <p className="text-sm text-slate-400">
          Настройка Telegram для входящих запросов на демо.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-700/50 bg-rose-900/30 px-4 py-3 text-sm text-rose-50">
          {error}
        </div>
      )}

      {status && (
        <div className="rounded-2xl border border-emerald-700/50 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-50">
          {status}
        </div>
      )}

      <div className="rounded-3xl border border-slate-800 bg-slate-950/70 backdrop-blur-lg p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] space-y-4">
        <div className="rounded-2xl border border-indigo-700/40 bg-indigo-950/30 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-indigo-300/90">
                Billing connection
              </div>
              <p className="mt-1 text-sm text-slate-200">
                Stripe, тарифы и checkout для CRM подключаются из этой страницы.
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                stripeConfigured
                  ? "border-emerald-500/50 bg-emerald-900/40 text-emerald-100"
                  : "border-amber-500/50 bg-amber-900/40 text-amber-100"
              }`}
            >
              {stripeConfigured ? "Stripe connected" : "Setup required"}
            </span>
          </div>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Webhook URL
            </div>
            <div className="mt-1 text-xs text-slate-300 break-all">{billingWebhookUrl}</div>
          </div>
          {billingHealth && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                Статус:{" "}
                <span className={billingHealth.configured ? "text-emerald-300" : "text-amber-300"}>
                  {billingHealth.configured ? "готово к оплатам" : "нужна настройка"}
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                Missing: {billingHealth.missing.length ? billingHealth.missing.join(", ") : "—"}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Telegram bot
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Заполните токен и chat ID, чтобы получать новые заявки.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Bot token
            <input
              value={form.telegramBotToken}
              onChange={(e) =>
                setForm((s) => ({ ...s, telegramBotToken: e.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="123456789:AA..."
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Chat ID
            <input
              value={form.telegramChatId}
              onChange={(e) =>
                setForm((s) => ({ ...s, telegramChatId: e.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="-1001234567890"
            />
          </label>
        </div>

        <div className="border-t border-slate-800/80 pt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Billing plans content
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Контент этих тарифов отображается в CRM billing и на публичной странице pricing.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {form.billingPlans.map((plan, idx) => (
            <div key={plan.code} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-100 uppercase">{plan.code}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((s) => ({
                        ...s,
                        billingPlans: s.billingPlans.map((p, i) =>
                          i === idx
                            ? {
                                ...p,
                                i18n: {
                                  ...(p.i18n || {}),
                                  en: {
                                    subtitle: p.subtitle,
                                    description: p.description,
                                    features: [...p.features],
                                  },
                                  tr: {
                                    subtitle: p.subtitle,
                                    description: p.description,
                                    features: [...p.features],
                                  },
                                },
                              }
                            : p,
                        ),
                      }))
                    }
                    className="rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-slate-500"
                  >
                    Копировать RU → EN/TR
                  </button>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(plan.highlighted)}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          billingPlans: s.billingPlans.map((p, i) =>
                            i === idx ? { ...p, highlighted: e.target.checked } : p,
                          ),
                        }))
                      }
                    />
                    Highlight
                  </label>
                </div>
              </div>
                <div className="rounded-lg border border-indigo-900/50 bg-indigo-950/30 px-3 py-2 text-[11px] text-indigo-200">
                  Переводы для сайта редактируются ниже в блоках <span className="font-semibold">EN translation</span> и{' '}
                  <span className="font-semibold">TR translation</span>.
                </div>
              <input
                value={plan.title}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    billingPlans: s.billingPlans.map((p, i) => (i === idx ? { ...p, title: e.target.value } : p)),
                  }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="Title"
              />
              <input
                value={plan.price}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    billingPlans: s.billingPlans.map((p, i) => (i === idx ? { ...p, price: e.target.value } : p)),
                  }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="Price, e.g. EUR 14"
              />
              <input
                value={plan.subtitle}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    billingPlans: s.billingPlans.map((p, i) =>
                      i === idx ? { ...p, subtitle: e.target.value } : p,
                    ),
                  }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="Subtitle"
              />
              <textarea
                rows={2}
                value={plan.description}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    billingPlans: s.billingPlans.map((p, i) =>
                      i === idx ? { ...p, description: e.target.value } : p,
                    ),
                  }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="Description"
              />
              <textarea
                rows={5}
                value={plan.features.join("\n")}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    billingPlans: s.billingPlans.map((p, i) =>
                      i === idx ? { ...p, features: e.target.value.split("\n") } : p,
                    ),
                  }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="Каждая фича с новой строки"
              />
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  EN translation
                </div>
                <input
                  value={plan.i18n?.en?.subtitle || ""}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      billingPlans: s.billingPlans.map((p, i) =>
                        i === idx
                          ? {
                              ...p,
                              i18n: {
                                ...(p.i18n || {}),
                                en: {
                                  ...(p.i18n?.en || {}),
                                  subtitle: e.target.value,
                                },
                              },
                            }
                          : p,
                      ),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder="English subtitle"
                />
                <textarea
                  rows={2}
                  value={plan.i18n?.en?.description || ""}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      billingPlans: s.billingPlans.map((p, i) =>
                        i === idx
                          ? {
                              ...p,
                              i18n: {
                                ...(p.i18n || {}),
                                en: {
                                  ...(p.i18n?.en || {}),
                                  description: e.target.value,
                                },
                              },
                            }
                          : p,
                      ),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder="English description"
                />
                <textarea
                  rows={4}
                  value={(plan.i18n?.en?.features || []).join("\n")}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      billingPlans: s.billingPlans.map((p, i) =>
                        i === idx
                          ? {
                              ...p,
                              i18n: {
                                ...(p.i18n || {}),
                                en: {
                                  ...(p.i18n?.en || {}),
                                  features: e.target.value.split("\n"),
                                },
                              },
                            }
                          : p,
                      ),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder="English features (one per line)"
                />
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  TR translation
                </div>
                <input
                  value={plan.i18n?.tr?.subtitle || ""}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      billingPlans: s.billingPlans.map((p, i) =>
                        i === idx
                          ? {
                              ...p,
                              i18n: {
                                ...(p.i18n || {}),
                                tr: {
                                  ...(p.i18n?.tr || {}),
                                  subtitle: e.target.value,
                                },
                              },
                            }
                          : p,
                      ),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder="Turkish subtitle"
                />
                <textarea
                  rows={2}
                  value={plan.i18n?.tr?.description || ""}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      billingPlans: s.billingPlans.map((p, i) =>
                        i === idx
                          ? {
                              ...p,
                              i18n: {
                                ...(p.i18n || {}),
                                tr: {
                                  ...(p.i18n?.tr || {}),
                                  description: e.target.value,
                                },
                              },
                            }
                          : p,
                      ),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder="Turkish description"
                />
                <textarea
                  rows={4}
                  value={(plan.i18n?.tr?.features || []).join("\n")}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      billingPlans: s.billingPlans.map((p, i) =>
                        i === idx
                          ? {
                              ...p,
                              i18n: {
                                ...(p.i18n || {}),
                                tr: {
                                  ...(p.i18n?.tr || {}),
                                  features: e.target.value.split("\n"),
                                },
                              },
                            }
                          : p,
                      ),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder="Turkish features (one per line)"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800/80 pt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            AI-ассистент (OpenAI-совместимый)
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Ключ хранится на сервере; клиенты CRM ходят только в ваш API. Квоты и докупка — в CRM и Stripe.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500 md:col-span-2">
            API key
            <input
              value={form.openAiApiKey}
              onChange={(e) => setForm((s) => ({ ...s, openAiApiKey: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="sk-..."
              autoComplete="off"
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500 md:col-span-2">
            Base URL
            <input
              value={form.openAiBaseUrl}
              onChange={(e) => setForm((s) => ({ ...s, openAiBaseUrl: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Модель чата
            <input
              value={form.openAiModel}
              onChange={(e) => setForm((s) => ({ ...s, openAiModel: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Модель изображений
            <input
              value={form.openAiImageModel}
              onChange={(e) => setForm((s) => ({ ...s, openAiImageModel: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            $ / 1M input tokens
            <input
              value={form.aiPriceInputPerMtokUsd}
              onChange={(e) => setForm((s) => ({ ...s, aiPriceInputPerMtokUsd: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            $ / 1M output tokens
            <input
              value={form.aiPriceOutputPerMtokUsd}
              onChange={(e) => setForm((s) => ({ ...s, aiPriceOutputPerMtokUsd: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Списание за 1 изображение (центы)
            <input
              value={form.aiImageCostCents}
              onChange={(e) => setForm((s) => ({ ...s, aiImageCostCents: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Stripe Price AI-кредиты (опционально)
            <input
              value={form.stripePriceAiCredits}
              onChange={(e) => setForm((s) => ({ ...s, stripePriceAiCredits: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="price_..."
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Stripe Price пакет хранилища
            <input
              value={form.stripePriceStoragePack}
              onChange={(e) => setForm((s) => ({ ...s, stripePriceStoragePack: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="price_..."
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Кредиты за покупку (центы, если без Stripe price)
            <input
              value={form.aiCreditsPackAmountCents}
              onChange={(e) => setForm((s) => ({ ...s, aiCreditsPackAmountCents: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            +байт за пакет хранилища
            <input
              value={form.storagePackBytes}
              onChange={(e) => setForm((s) => ({ ...s, storagePackBytes: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
            />
          </label>
        </div>

        <div className="border-t border-slate-800/80 pt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Stripe (Billing)
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Ключи для оплаты CRM и Price ID тарифов.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Secret key
            <input
              value={form.stripeSecretKey}
              onChange={(e) => setForm((s) => ({ ...s, stripeSecretKey: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="sk_test_..."
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Publishable key
            <input
              value={form.stripePublishableKey}
              onChange={(e) => setForm((s) => ({ ...s, stripePublishableKey: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="pk_test_..."
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500 md:col-span-2">
            Webhook secret
            <input
              value={form.stripeWebhookSecret}
              onChange={(e) => setForm((s) => ({ ...s, stripeWebhookSecret: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="whsec_..."
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Price Standard
            <input
              value={form.stripePriceStandard}
              onChange={(e) => setForm((s) => ({ ...s, stripePriceStandard: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="price_..."
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Price Professional
            <input
              value={form.stripePriceProfessional}
              onChange={(e) => setForm((s) => ({ ...s, stripePriceProfessional: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="price_..."
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Price Enterprise
            <input
              value={form.stripePriceEnterprise}
              onChange={(e) => setForm((s) => ({ ...s, stripePriceEnterprise: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="price_..."
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Price Ultimate
            <input
              value={form.stripePriceUltimate}
              onChange={(e) => setForm((s) => ({ ...s, stripePriceUltimate: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="price_..."
            />
          </label>
        </div>

        <div className="border-t border-slate-800/80 pt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Google OAuth (платформа)
          </div>
          <p className="text-sm text-slate-400 mt-1">
            SEO (Search Console) и общий OAuth‑клиент Lumiva для CRM: Google Ads, Google Analytics
            4 (мастер «Подключить через Google»), Google Sheets, Google Calendar — если не заданы
            отдельные ключи в JSON «CRM: OAuth приложения интеграций» или в переменных окружения.
          </p>
          <p className="text-xs text-slate-500 mt-2 font-mono leading-relaxed">
            В Google Cloud Console → OAuth client → Authorized redirect URIs добавьте пути
            callback API (значение <code className="text-slate-300">PUBLIC_API_URL</code> без
            слэша в конце):{" "}
            <code className="block mt-1 text-slate-300 break-all">
              {"{PUBLIC_API_URL}"}/v1/marketing/seo/google/callback
            </code>
            <code className="block mt-1 text-slate-300 break-all">
              {"{PUBLIC_API_URL}"}/v1/marketing/integrations/google-ads/oauth/callback
            </code>
            <code className="block mt-1 text-slate-300 break-all">
              {"{PUBLIC_API_URL}"}/v1/marketing/integrations/ga4/oauth/callback
            </code>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            OAuth Client ID
            <input
              value={form.googleOauthClientId}
              onChange={(e) =>
                setForm((s) => ({ ...s, googleOauthClientId: e.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="xxxx.apps.googleusercontent.com"
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            OAuth Client Secret
            <input
              value={form.googleOauthClientSecret}
              onChange={(e) =>
                setForm((s) => ({ ...s, googleOauthClientSecret: e.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="GOCSPX-..."
            />
          </label>
        </div>

        <div className="border-t border-slate-800/80 pt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            CRM: OAuth приложения интеграций
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Ключи приложений Slack, Microsoft, HubSpot и т.д. (client id + secret) хранятся на
            платформе. В CRM клиент нажимает «Подключить» и вводит только свой webhook / токен /
            email. Альтернатива — переменные окружения API:{" "}
            <code className="text-slate-300">
              INTEGRATION_OAUTH_SLACK_CLIENT_ID
            </code>
            ,{" "}
            <code className="text-slate-300">
              INTEGRATION_OAUTH_SLACK_CLIENT_SECRET
            </code>{" "}
            (суффиксы: SLACK, MS_TEAMS, GOOGLE_CALENDAR, …).
          </p>
          <textarea
            value={form.integrationOAuthAppsJson}
            onChange={(e) =>
              setForm((s) => ({ ...s, integrationOAuthAppsJson: e.target.value }))
            }
            rows={12}
            spellCheck={false}
            className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-mono text-xs text-slate-100"
            placeholder={`{\n  "slack": { "clientId": "...", "clientSecret": "..." },\n  "ms_teams": { "clientId": "...", "clientSecret": "..." }\n}`}
          />
        </div>

        <div className="border-t border-slate-800/80 pt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Meta OAuth (SMM)
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Используется для подключения Instagram / Facebook профилей.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            App ID
            <input
              value={form.metaOauthAppId}
              onChange={(e) =>
                setForm((s) => ({ ...s, metaOauthAppId: e.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="1234567890"
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            App Secret
            <input
              value={form.metaOauthAppSecret}
              onChange={(e) =>
                setForm((s) => ({ ...s, metaOauthAppSecret: e.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="••••••••••"
            />
          </label>
        </div>

        <div className="border-t border-slate-800/80 pt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            VK OAuth (SMM)
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Используется для подключения сообществ VK.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Client ID
            <input
              value={form.vkOauthClientId}
              onChange={(e) =>
                setForm((s) => ({ ...s, vkOauthClientId: e.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="12345678"
            />
          </label>
          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Client Secret
            <input
              value={form.vkOauthClientSecret}
              onChange={(e) =>
                setForm((s) => ({ ...s, vkOauthClientSecret: e.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              placeholder="••••••••••"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || loading}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 hover:border-slate-500 transition-colors disabled:opacity-60"
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            onClick={testTelegram}
            disabled={testing || loading}
            className="rounded-2xl border border-cyan-700/60 bg-cyan-900/30 px-4 py-2 text-sm text-cyan-50 hover:border-cyan-400 transition-colors disabled:opacity-60"
          >
            {testing ? "Отправляем..." : "Тест Telegram"}
          </button>
          <button
            onClick={testStripe}
            disabled={stripeTesting || loading}
            className="rounded-2xl border border-indigo-700/60 bg-indigo-900/30 px-4 py-2 text-sm text-indigo-50 hover:border-indigo-400 transition-colors disabled:opacity-60"
          >
            {stripeTesting ? "Проверяем..." : "Тест Stripe"}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-2xl border border-slate-800 px-4 py-2 text-sm text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-60"
          >
            Обновить
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlatformSettingsPage;
