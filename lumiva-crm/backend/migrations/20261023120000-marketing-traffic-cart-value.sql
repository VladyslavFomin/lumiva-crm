-- Ценность корзин/начатых бронирований по данным Google Ads (ADD_TO_CART / BEGIN_CHECKOUT) —
-- «потенциальная выручка», отдельно от conversionValue, где теперь только покупки.
ALTER TABLE marketing_traffic ADD COLUMN IF NOT EXISTS "cartValue" numeric(16,2) NOT NULL DEFAULT 0;
