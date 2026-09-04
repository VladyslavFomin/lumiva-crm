// src/common/legal-requisites.ts
// Единый каталог типов юридических/банковских реквизитов — используется и для реквизитов своей
// компании (Настройки → «Обёртка для писем» соседствует с «Реквизиты компании»), и для реквизитов
// компании-клиента (карточка компании). Список типов фиксирован на уровне кода (не настраивается
// тенантом) — в отличие от CustomField, где тенант сам заводит произвольные поля.

export type LegalRequisiteRegion = 'ru' | 'tr' | 'eu' | 'general';

export interface LegalRequisiteTypeDef {
  id: string;
  region: LegalRequisiteRegion;
  label: string;
}

export interface LegalRequisiteItem {
  id: string;
  type: string;
  value: string;
}

export const LEGAL_REQUISITE_TYPES: LegalRequisiteTypeDef[] = [
  // СНГ / Россия
  { id: 'ru_inn', region: 'ru', label: 'ИНН' },
  { id: 'ru_kpp', region: 'ru', label: 'КПП' },
  { id: 'ru_ogrn', region: 'ru', label: 'ОГРН' },
  { id: 'ru_bank', region: 'ru', label: 'Банк' },
  { id: 'ru_bic', region: 'ru', label: 'БИК' },
  { id: 'ru_racc', region: 'ru', label: 'Р/с' },
  { id: 'ru_corracc', region: 'ru', label: 'К/с' },
  { id: 'ru_legal_address', region: 'ru', label: 'Юр. адрес' },

  // Турция
  { id: 'tr_vkn', region: 'tr', label: 'VKN' },
  { id: 'tr_vergi_dairesi', region: 'tr', label: 'Vergi Dairesi (налоговая инспекция)' },
  { id: 'tr_iban', region: 'tr', label: 'IBAN' },
  { id: 'tr_bank', region: 'tr', label: 'Banka (банк)' },
  { id: 'tr_address', region: 'tr', label: 'Adres' },

  // Европа / международные
  { id: 'eu_reg_no', region: 'eu', label: 'Company Reg. No' },
  { id: 'eu_vat_id', region: 'eu', label: 'VAT ID' },
  { id: 'eu_iban', region: 'eu', label: 'IBAN' },
  { id: 'eu_swift', region: 'eu', label: 'SWIFT / BIC' },
  { id: 'eu_bank_name', region: 'eu', label: 'Bank Name' },
  { id: 'eu_bank_address', region: 'eu', label: 'Bank Address' },

  // Общие — для любого направления
  { id: 'gen_director_name', region: 'general', label: 'ФИО директора' },
  { id: 'gen_director_position', region: 'general', label: 'Должность' },
  { id: 'gen_basis', region: 'general', label: 'Действует на основании' },
  { id: 'gen_legal_address', region: 'general', label: 'Юр. адрес' },
  { id: 'gen_other', region: 'general', label: 'Другое' },
];

export const LEGAL_REQUISITE_LABEL: Record<string, string> = Object.fromEntries(
  LEGAL_REQUISITE_TYPES.map((t) => [t.id, t.label]),
);

/**
 * Склеивает непустые реквизиты в текст вида "Метка: значение" по одному на строку — то, что
 * реально уходит в {ORG_TAX}/{COMPANY_REQUISITES} при генерации документа. Пустые значения и
 * записи с неизвестным type пропускаются молча (не ломают документ незнакомым текстом).
 */
export function buildLegalRequisitesText(
  items: LegalRequisiteItem[] | null | undefined,
): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .map((item) => {
      const value = (item?.value || '').trim();
      if (!value) return null;
      const label = LEGAL_REQUISITE_LABEL[item.type] || item.type;
      return `${label}: ${value}`;
    })
    .filter((line): line is string => Boolean(line))
    .join('\n');
}
