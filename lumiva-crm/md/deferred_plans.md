# Отложенные планы (реестр)

Планы, которые написаны, но код по ним не начат. Когда план берётся в работу, строка переносится в «Сделано» со ссылкой на коммит.

| Дата | План | О чём | Что нужно, чтобы начать |
|---|---|---|---|
| 2026-11-02 | [lumiva_hotels_pp_budget_plan_2026-11-02.md](lumiva_hotels_pp_budget_plan_2026-11-02.md) | Цены отелей: Brüt = PP, бюджет как порог, прайс сезона берёт PP и бюджет из цен по дням | Ничего, решения приняты |
| 2026-11-02 | [lumiva_hotels_tour_operator_integration_plan_2026-11-02.md](lumiva_hotels_tour_operator_integration_plan_2026-11-02.md) | Брони туроператоров попадают в PMS сами (Sejour API, экстранеты, письма-ваучеры) | Доступы отеля к системам ТО |
| 2026-11-02 | [lumiva_media_object_storage_plan_2026-11-02.md](lumiva_media_object_storage_plan_2026-11-02.md) | Медиа переезжает с диска сервера (96% занято) в Backblaze B2 + Cloudflare | Лимит B2, отдельный bucket и ключ от владельца |

Также отложено внутри других планов:
- Склад и закупки F&B: [lumiva_hotels_pms_v3_plan_2026-11-02.md](lumiva_hotels_pms_v3_plan_2026-11-02.md), раздел «Этап B — решения владельца».
- Мобильное приложение: [mobile-app-backlog.md](mobile-app-backlog.md).

## Сделано

- 2026-11-06 — Canva в посты ([content_engine_plan.md](content_engine_plan.md), раздел «Canva»): собрано, ждёт интеграции Canva для живой проверки; не закоммичено.
