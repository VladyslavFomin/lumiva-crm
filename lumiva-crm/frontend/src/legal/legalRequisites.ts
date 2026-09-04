// src/legal/legalRequisites.ts
// Единый каталог типов юридических/банковских реквизитов — зеркало
// backend/src/common/legal-requisites.ts (лейблы дублируются намеренно, т.к. в проекте нет
// общего пакета между backend/frontend). Используется компонентом LegalRequisitesEditor
// в Настройках компании и в карточке компании-клиента.

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
  { id: 'ru_inn', region: 'ru', label: 'ИНН' },
  { id: 'ru_kpp', region: 'ru', label: 'КПП' },
  { id: 'ru_ogrn', region: 'ru', label: 'ОГРН' },
  { id: 'ru_bank', region: 'ru', label: 'Банк' },
  { id: 'ru_bic', region: 'ru', label: 'БИК' },
  { id: 'ru_racc', region: 'ru', label: 'Р/с' },
  { id: 'ru_corracc', region: 'ru', label: 'К/с' },
  { id: 'ru_legal_address', region: 'ru', label: 'Юр. адрес' },

  { id: 'tr_vkn', region: 'tr', label: 'VKN' },
  { id: 'tr_vergi_dairesi', region: 'tr', label: 'Vergi Dairesi (налоговая инспекция)' },
  { id: 'tr_iban', region: 'tr', label: 'IBAN' },
  { id: 'tr_bank', region: 'tr', label: 'Banka (банк)' },
  { id: 'tr_address', region: 'tr', label: 'Adres' },

  { id: 'eu_reg_no', region: 'eu', label: 'Company Reg. No' },
  { id: 'eu_vat_id', region: 'eu', label: 'VAT ID' },
  { id: 'eu_iban', region: 'eu', label: 'IBAN' },
  { id: 'eu_swift', region: 'eu', label: 'SWIFT / BIC' },
  { id: 'eu_bank_name', region: 'eu', label: 'Bank Name' },
  { id: 'eu_bank_address', region: 'eu', label: 'Bank Address' },

  { id: 'gen_director_name', region: 'general', label: 'ФИО директора' },
  { id: 'gen_director_position', region: 'general', label: 'Должность' },
  { id: 'gen_basis', region: 'general', label: 'Действует на основании' },
  { id: 'gen_legal_address', region: 'general', label: 'Юр. адрес' },
  { id: 'gen_other', region: 'general', label: 'Другое' },
];

export const LEGAL_REQUISITE_LABEL: Record<string, string> = Object.fromEntries(
  LEGAL_REQUISITE_TYPES.map((t) => [t.id, t.label]),
);

export const LEGAL_REQUISITE_REGION_LABEL: Record<LegalRequisiteRegion, string> = {
  ru: 'СНГ / Россия',
  tr: 'Турция',
  eu: 'Европа / международные',
  general: 'Общие',
};

export const LEGAL_REQUISITE_REGION_ORDER: LegalRequisiteRegion[] = ['ru', 'tr', 'eu', 'general'];

export function makeRequisiteId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
