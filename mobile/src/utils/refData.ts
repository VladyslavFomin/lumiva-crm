// Reference lists the website's contact/company forms use (pages/contacts/CrmFormShared.tsx, CompaniesListPage.tsx).
// Values are the STORED values — never translate them; only the labels shown next to them.

/** Stored as ISO code, shown by name (the website labels are English in every UI language). */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'TR', name: 'Turkey' }, { code: 'RU', name: 'Russia' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
  { code: 'AE', name: 'UAE' }, { code: 'KZ', name: 'Kazakhstan' }, { code: 'AZ', name: 'Azerbaijan' }, { code: 'UZ', name: 'Uzbekistan' },
];

export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  return COUNTRIES.find((c) => c.code === code.toUpperCase())?.name || code;
}

export const RECORD_STATUSES = ['active', 'inactive', 'archived'] as const;
export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;
export const COMPANY_TYPES = ['lead', 'nego', 'client', 'partner', 'own', 'archived'] as const;
