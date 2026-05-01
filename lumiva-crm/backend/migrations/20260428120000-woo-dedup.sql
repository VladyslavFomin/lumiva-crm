-- Сначала удаляем дубли: оставляем самую свежую запись по (tenant_id, object_id, external_id)
DELETE FROM custom_object_records
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id, object_id, external_id
        ORDER BY updated_at DESC, created_at DESC
      ) AS rn
    FROM custom_object_records
    WHERE external_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Уникальный частичный индекс: только для записей с external_id (NULL разрешены)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  idx_custom_object_records_tenant_object_external_id_unique
  ON custom_object_records (tenant_id, object_id, external_id)
  WHERE external_id IS NOT NULL;
