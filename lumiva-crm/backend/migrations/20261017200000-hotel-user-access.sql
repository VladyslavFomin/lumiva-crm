-- Доступ сотрудника к отелям: директор отеля видит отзывы и аналитику только своих отелей.
-- Нет строки — доступ ко всем отелям (как было). Бренд даёт доступ ко всем его отелям, в т.ч. добавленным позже.
CREATE TABLE IF NOT EXISTS hotel_user_access (
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "hotelIds" uuid[] NOT NULL DEFAULT '{}',
  "brandIds" uuid[] NOT NULL DEFAULT '{}',
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("tenantId", "userId")
);
