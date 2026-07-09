// src/dashboard/widgets/BirthdaysWidget.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getBirthdayContacts, type BirthdayContactItem } from '../../api/dashboardWidgets';

function formatBirthday(birthday: string | null): string {
  if (!birthday) return '';
  const d = new Date(birthday);
  if (isNaN(d.getTime())) return birthday;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

function getInitials(first: string | null, last: string | null): string {
  const f = first?.trim()?.[0] || '';
  const l = last?.trim()?.[0] || '';
  return (f + l).toUpperCase() || '?';
}

export const BirthdaysWidget: React.FC = () => {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<BirthdayContactItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getBirthdayContacts()
      .then((res) => { if (alive) setContacts(res.contacts); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  if (error) {
    return (
      <div className="text-[11px] text-neutral-400 italic py-2">
        {t('crm.common.loadError', { defaultValue: 'Failed to load' })}
      </div>
    );
  }

  if (contacts === null) {
    return (
      <div className="flex flex-col gap-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 bg-neutral-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
        <span className="text-2xl select-none" aria-hidden>🎂</span>
        <div className="text-[12px] text-neutral-400">
          {t('crm.dashboard.widgets.birthdaysEmpty', { defaultValue: 'No birthdays this week' })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {contacts.map((contact, i) => {
        const fullName =
          [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
          contact.email ||
          t('crm.dashboard.widgets.birthdaysUnknown', { defaultValue: 'Unknown' });
        const initials = getInitials(contact.firstName, contact.lastName);
        return (
          <Link
            key={contact.id}
            to={`/contacts/${contact.id}`}
            className="flex items-center gap-2.5 py-2 px-1 hover:bg-neutral-50 rounded-lg transition-colors group"
            style={{ borderBottom: i < contacts.length - 1 ? '1px solid #f5f5f5' : 'none' }}
          >
            <span className="w-8 h-8 rounded-full bg-[#222] text-white flex items-center justify-center text-[11px] font-semibold shrink-0">
              {initials}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium text-[#222] truncate group-hover:text-neutral-700">
                {fullName}
              </div>
              {contact.email && (
                <div className="text-[10px] text-neutral-400 truncate">{contact.email}</div>
              )}
            </div>
            {contact.birthday && (
              <div className="text-[11px] text-neutral-500 shrink-0 font-medium">
                {formatBirthday(contact.birthday)}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
};
