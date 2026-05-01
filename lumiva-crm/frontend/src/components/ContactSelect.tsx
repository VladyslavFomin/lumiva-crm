// src/components/ContactSelect.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchContacts, createContact, type Contact } from '../api/contacts';
import { useAlertModal } from '../contexts/AlertModalContext';

interface ContactSelectProps {
  value: string | null;
  onChange: (contactId: string | null, contact?: Contact) => void;
  companyId?: string | null;
  placeholder?: string;
  className?: string;
  allowCreate?: boolean;
  onContactCreated?: (contact: Contact) => void;
  theme?: 'light' | 'dark';
}

export const ContactSelect: React.FC<ContactSelectProps> = ({
  value,
  onChange,
  companyId,
  placeholder = 'Выберите контакт...',
  className = '',
  allowCreate = true,
  onContactCreated,
  theme = 'light',
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [search, setSearch] = useState<string>('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Загружаем контакты
  useEffect(() => {
    let alive = true;
    setLoading(true);

    const query: any = { limit: 100 };
    if (companyId) {
      query.companyId = companyId;
    }

    fetchContacts(query)
      .then((data) => {
        if (!alive) return;
        setContacts(data.items);
        setFilteredContacts(data.items);
      })
      .catch((e) => {
        console.error('Ошибка загрузки контактов:', e);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [companyId]);

  // Находим выбранный контакт
  useEffect(() => {
    if (value) {
      const contact = contacts.find((c) => c.id === value);
      setSelectedContact(contact || null);
      if (contact) {
        const fullName =
          contact.fullName ||
          `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
          contact.email ||
          'Без имени';
        setSearch(fullName);
      }
    } else {
      setSelectedContact(null);
      setSearch('');
    }
  }, [value, contacts]);

  // Фильтруем контакты по поиску
  useEffect(() => {
    if (!search.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = contacts.filter(
      (c) =>
        c.fullName?.toLowerCase().includes(searchLower) ||
        c.firstName?.toLowerCase().includes(searchLower) ||
        c.lastName?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower) ||
        c.phone?.toLowerCase().includes(searchLower),
    );
    setFilteredContacts(filtered);
  }, [search, contacts]);

  // Закрываем при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (contact: Contact) => {
    setSelectedContact(contact);
    const fullName =
      contact.fullName ||
      `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
      contact.email ||
      'Без имени';
    setSearch(fullName);
    setIsOpen(false);
    onChange(contact.id, contact);
  };

  const handleClear = () => {
    setSelectedContact(null);
    setSearch('');
    setIsOpen(false);
    onChange(null);
  };

  const handleCreate = async () => {
    if (!search.trim() || !allowCreate) return;

    setCreating(true);
    try {
      // Пытаемся определить имя и фамилию из поиска
      const parts = search.trim().split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || null;

      const newContact = await createContact({
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        companyId: companyId || undefined,
        status: 'active',
      });
      setContacts([newContact, ...contacts]);
      setFilteredContacts([newContact, ...contacts]);
      handleSelect(newContact);
      if (onContactCreated) {
        onContactCreated(newContact);
      }
    } catch (e: any) {
      console.error('Ошибка создания контакта:', e);
      showAlert(
        e.message || t('crm.contactSelect.errors.createFailed'),
        { variant: 'error' },
      );
    } finally {
      setCreating(false);
    }
  };

  const showCreateOption =
    allowCreate &&
    search.trim() &&
    !filteredContacts.some((c) => {
      const fullName =
        c.fullName ||
        `${c.firstName || ''} ${c.lastName || ''}`.trim() ||
        c.email ||
        '';
      return fullName.toLowerCase() === search.toLowerCase().trim();
    });

  const inputClassName =
    theme === 'dark'
      ? 'w-full px-3 py-2 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-lumiva-accent-soft focus:ring-2 focus:ring-lumiva-accent-soft/20 transition-colors'
      : 'w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors';
  const clearButtonClassName =
    theme === 'dark'
      ? 'absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 text-lg leading-none'
      : 'absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none';
  const dropdownClassName =
    theme === 'dark'
      ? 'absolute z-50 w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-lg max-h-60 overflow-auto'
      : 'absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-lg max-h-60 overflow-auto';
  const optionClassName =
    theme === 'dark'
      ? 'w-full text-left px-3 py-2 text-xs hover:bg-slate-900 transition-colors border-b border-slate-800 last:border-b-0'
      : 'w-full text-left px-3 py-2 text-xs hover:bg-slate-100 transition-colors border-b border-slate-100 last:border-b-0';

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={inputClassName}
        />
        {selectedContact && (
          <button
            type="button"
            onClick={handleClear}
            className={clearButtonClassName}
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div className={dropdownClassName}>
          {loading ? (
            <div className="px-3 py-2 text-xs text-slate-500">Загрузка...</div>
          ) : filteredContacts.length === 0 && !showCreateOption ? (
            <div className="px-3 py-2 text-xs text-slate-500">Контакты не найдены</div>
          ) : (
            <>
              {filteredContacts.map((contact) => {
                const fullName =
                  contact.fullName ||
                  `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
                  contact.email ||
                  'Без имени';
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleSelect(contact)}
                  className={optionClassName}
                  >
                  <div className={theme === 'dark' ? 'font-medium text-slate-100' : 'font-medium text-slate-900'}>
                    {fullName}
                  </div>
                    {contact.email && (
                      <div className="text-[10px] text-slate-500">{contact.email}</div>
                    )}
                    {contact.phone && (
                      <div className="text-[10px] text-slate-500">{contact.phone}</div>
                    )}
                  </button>
                );
              })}
              {showCreateOption && (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className={
                    theme === 'dark'
                      ? 'w-full text-left px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border-t border-slate-800 transition-colors disabled:opacity-50'
                      : 'w-full text-left px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100 border-t border-slate-200 transition-colors disabled:opacity-50'
                  }
                >
                  {creating ? (
                    <span className="text-slate-500">Создание...</span>
                  ) : (
                    <>
                      <span className={theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}>
                        + Создать контакт:{' '}
                      </span>
                      <span className={theme === 'dark' ? 'font-medium text-slate-100' : 'font-medium text-slate-900'}>
                        {search.trim()}
                      </span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};











