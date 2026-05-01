/**
 * Adds CRM keys referenced in code but missing from locales (fixes raw i18n keys in UI).
 * Run: node scripts/patch-missing-crm-keys.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function deepMerge(target, source) {
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    return source;
  }
  const out = { ...target };
  for (const k of Object.keys(source)) {
    if (
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k]) &&
      typeof source[k] === "object" &&
      !Array.isArray(source[k])
    ) {
      out[k] = deepMerge(out[k], source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}

const byLang = {
  ru: {
    common: {
      all: "Все",
      done: "Готово",
      template: "Шаблон",
      sync: "Синхронизация",
    },
    dashboard: {
      activity: {
        types: { meeting: "Встреча" },
      },
    },
    marketingCampaigns: {
      kpi: {
        clicksHint: "Суммарные клики по кампаниям за период.",
        impressionsHint: "Суммарные показы.",
        sessionsHint: "Сессии из связанной аналитики.",
      },
      top: {
        subtitleClicks: "По кликам за выбранный период.",
        subtitleImpressions: "По показам за выбранный период.",
      },
    },
    marketingChannelBlocks: {
      title: "Трафик и кампании",
      titleCampaigns: "Кампании",
      subtitleTraffic: "Сводка по сессиям, кликам и расходу.",
      subtitleCampaigns: "Топ кампаний и эффективность.",
    },
    marketingSeo: {
      errors: {
        gscReauthRequired: "Нужно заново авторизовать Google Search Console.",
        loadMetrics: "Не удалось загрузить метрики SEO.",
        loadSettings: "Не удалось загрузить настройки SEO.",
      },
      oauthCallback: {
        connected: "Подключение выполнено.",
        generic: "Результат OAuth.",
      },
    },
    marketingTraffic: {
      summaryStripTitle: "Сводка периода",
      summaryStripSubtitle: "Ключевые метрики по выбранному интервалу.",
    },
    projects: {
      list: {
        search: "Поиск проектов…",
        export: "Экспорт",
        groupMode: { label: "Группировка" },
        summary: {
          active: "Активные",
          amount: "Сумма",
          count: "Количество",
          updated: "Обновлено",
        },
        columns: { search: "Поиск колонки…" },
      },
      views: { addTab: "Добавить вкладку" },
      analytics: {
        blockConditions: {
          title: "Условия блока",
          conditionLabel: "Условие",
          allValues: "Все значения",
          emptyHint: "Добавьте хотя бы одно условие.",
          emptyHintFormula: "Для формулы задайте условия SUMIF.",
          multiHint: "Несколько условий объединяются по И.",
        },
        formula: {
          mode: { sum: "Сумма" },
        },
        metric: {
          filteredPercent: "Доля отфильтрованного",
          suffix: { sum: "Σ", avg: "средн." },
        },
        modal: {
          sumField: "Поле суммы",
          valueMetric: "Метрика значения",
          valueMode: { count: "Количество", sum: "Сумма" },
        },
        pivot: {
          section: "Сводная таблица",
          rowDim: "Строки",
          colDim: "Столбцы",
          measures: "Показатели",
          addMeasure: "Добавить показатель",
          measure: { count: "Количество", sum: "Сумма" },
          emptyBucket: "(пусто)",
          noData: "Нет данных для сводной таблицы.",
          sameAxisHint: "Строки и столбцы не должны совпадать.",
          truncated: "обрезано",
          shortLabelPlaceholder: "Краткая подпись",
        },
        tableMetric: { sum: "Сумма" },
        tableMulti: {
          addColumn: "Добавить колонку",
          columnN: "Колонка {{n}}",
          extraHint: "Дополнительные колонки метрик.",
          extraSection: "Доп. колонки",
          maxColumnsHint: "Максимум колонок: {{max}}",
          removeColumn: "Убрать колонку",
        },
        widgets: {
          type: { pivot: "Сводная таблица" },
        },
      },
    },
    sales: {
      details: {
        loadingCustomFields: "Загружаем кастомные поля…",
      },
    },
    staff: {
      profile: {
        common: { empty: "—" },
      },
    },
    workspace: {
      import: {
        skippedEmptyHint: "Пустые строки пропущены.",
      },
    },
  },
  en: {
    common: {
      all: "All",
      done: "Done",
      template: "Template",
      sync: "Sync",
    },
    dashboard: {
      activity: {
        types: { meeting: "Meeting" },
      },
    },
    marketingCampaigns: {
      kpi: {
        clicksHint: "Total campaign clicks in the period.",
        impressionsHint: "Total impressions.",
        sessionsHint: "Sessions from linked analytics.",
      },
      top: {
        subtitleClicks: "By clicks for the selected period.",
        subtitleImpressions: "By impressions for the selected period.",
      },
    },
    marketingChannelBlocks: {
      title: "Traffic & campaigns",
      titleCampaigns: "Campaigns",
      subtitleTraffic: "Summary of sessions, clicks, and spend.",
      subtitleCampaigns: "Top campaigns and performance.",
    },
    marketingSeo: {
      errors: {
        gscReauthRequired: "Please re-authorize Google Search Console.",
        loadMetrics: "Could not load SEO metrics.",
        loadSettings: "Could not load SEO settings.",
      },
      oauthCallback: {
        connected: "Connection completed.",
        generic: "OAuth result.",
      },
    },
    marketingTraffic: {
      summaryStripTitle: "Period summary",
      summaryStripSubtitle: "Key metrics for the selected range.",
    },
    projects: {
      list: {
        search: "Search projects…",
        export: "Export",
        groupMode: { label: "Grouping" },
        summary: {
          active: "Active",
          amount: "Amount",
          count: "Count",
          updated: "Updated",
        },
        columns: { search: "Search columns…" },
      },
      views: { addTab: "Add tab" },
      analytics: {
        blockConditions: {
          title: "Block conditions",
          conditionLabel: "Condition",
          allValues: "All values",
          emptyHint: "Add at least one condition.",
          emptyHintFormula: "For a formula, set SUMIF conditions.",
          multiHint: "Multiple conditions are combined with AND.",
        },
        formula: {
          mode: { sum: "Sum" },
        },
        metric: {
          filteredPercent: "Filtered share",
          suffix: { sum: "Σ", avg: "avg" },
        },
        modal: {
          sumField: "Sum field",
          valueMetric: "Value metric",
          valueMode: { count: "Count", sum: "Sum" },
        },
        pivot: {
          section: "Pivot table",
          rowDim: "Rows",
          colDim: "Columns",
          measures: "Measures",
          addMeasure: "Add measure",
          measure: { count: "Count", sum: "Sum" },
          emptyBucket: "(empty)",
          noData: "No data for the pivot.",
          sameAxisHint: "Rows and columns must differ.",
          truncated: "truncated",
          shortLabelPlaceholder: "Short label",
        },
        tableMetric: { sum: "Sum" },
        tableMulti: {
          addColumn: "Add column",
          columnN: "Column {{n}}",
          extraHint: "Extra metric columns.",
          extraSection: "Extra columns",
          maxColumnsHint: "Maximum columns: {{max}}",
          removeColumn: "Remove column",
        },
        widgets: {
          type: { pivot: "Pivot table" },
        },
      },
    },
    sales: {
      details: {
        loadingCustomFields: "Loading custom fields…",
      },
    },
    staff: {
      profile: {
        common: { empty: "—" },
      },
    },
    workspace: {
      import: {
        skippedEmptyHint: "Empty rows were skipped.",
      },
    },
  },
  tr: {
    common: {
      all: "Tümü",
      done: "Tamam",
      template: "Şablon",
      sync: "Senkronizasyon",
    },
    dashboard: {
      activity: {
        types: { meeting: "Toplantı" },
      },
    },
    marketingCampaigns: {
      kpi: {
        clicksHint: "Dönemdeki toplam kampanya tıklaması.",
        impressionsHint: "Toplam gösterim.",
        sessionsHint: "Bağlı analitikten oturumlar.",
      },
      top: {
        subtitleClicks: "Seçilen dönemde tıklamalara göre.",
        subtitleImpressions: "Seçilen dönemde gösterimlere göre.",
      },
    },
    marketingChannelBlocks: {
      title: "Trafik ve kampanyalar",
      titleCampaigns: "Kampanyalar",
      subtitleTraffic: "Oturum, tıklama ve harcama özeti.",
      subtitleCampaigns: "En iyi kampanyalar ve performans.",
    },
    marketingSeo: {
      errors: {
        gscReauthRequired: "Google Search Console’u yeniden yetkilendirin.",
        loadMetrics: "SEO metrikleri yüklenemedi.",
        loadSettings: "SEO ayarları yüklenemedi.",
      },
      oauthCallback: {
        connected: "Bağlantı tamamlandı.",
        generic: "OAuth sonucu.",
      },
    },
    marketingTraffic: {
      summaryStripTitle: "Dönem özeti",
      summaryStripSubtitle: "Seçilen aralık için temel metrikler.",
    },
    projects: {
      list: {
        search: "Proje ara…",
        export: "Dışa aktar",
        groupMode: { label: "Gruplama" },
        summary: {
          active: "Aktif",
          amount: "Tutar",
          count: "Adet",
          updated: "Güncellendi",
        },
        columns: { search: "Sütun ara…" },
      },
      views: { addTab: "Sekme ekle" },
      analytics: {
        blockConditions: {
          title: "Blok koşulları",
          conditionLabel: "Koşul",
          allValues: "Tüm değerler",
          emptyHint: "En az bir koşul ekleyin.",
          emptyHintFormula: "Formül için SUMIF koşullarını ayarlayın.",
          multiHint: "Birden fazla koşul VE ile birleştirilir.",
        },
        formula: {
          mode: { sum: "Toplam" },
        },
        metric: {
          filteredPercent: "Filtrelenen pay",
          suffix: { sum: "Σ", avg: "ort." },
        },
        modal: {
          sumField: "Toplam alanı",
          valueMetric: "Değer metriği",
          valueMode: { count: "Adet", sum: "Toplam" },
        },
        pivot: {
          section: "Özet tablo",
          rowDim: "Satırlar",
          colDim: "Sütunlar",
          measures: "Ölçümler",
          addMeasure: "Ölçüm ekle",
          measure: { count: "Adet", sum: "Toplam" },
          emptyBucket: "(boş)",
          noData: "Özet tablo için veri yok.",
          sameAxisHint: "Satırlar ve sütunlar farklı olmalı.",
          truncated: "kesildi",
          shortLabelPlaceholder: "Kısa etiket",
        },
        tableMetric: { sum: "Toplam" },
        tableMulti: {
          addColumn: "Sütun ekle",
          columnN: "Sütun {{n}}",
          extraHint: "Ek metrik sütunları.",
          extraSection: "Ek sütunlar",
          maxColumnsHint: "En fazla sütun: {{max}}",
          removeColumn: "Sütunu kaldır",
        },
        widgets: {
          type: { pivot: "Özet tablo" },
        },
      },
    },
    sales: {
      details: {
        loadingCustomFields: "Özel alanlar yükleniyor…",
      },
    },
    staff: {
      profile: {
        common: { empty: "—" },
      },
    },
    workspace: {
      import: {
        skippedEmptyHint: "Boş satırlar atlandı.",
      },
    },
  },
};

for (const lang of ["ru", "en", "tr"]) {
  const p = path.join(root, `src/locales/${lang}/translation.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.crm = deepMerge(j.crm, byLang[lang]);
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n", "utf8");
}
console.log("Patched ru, en, tr with missing nested CRM keys.");
