// src/components/CompanySelect.tsx
import React, { useState, useEffect, useRef } from 'react';
import { fetchCompanies, createCompany, type Company } from '../api/companies';

interface CompanySelectProps {
  value: string | null;
  onChange: (companyId: string | null, company?: Company) => void;
  placeholder?: string;
  className?: string;
  allowCreate?: boolean;
  onCompanyCreated?: (company: Company) => void;
  theme?: 'light' | 'dark';
}

export const CompanySelect: React.FC<CompanySelectProps> = ({
  value,
  onChange,
  placeholder = 'Выберите компанию...',
  className = '',
  allowCreate = true,
  onCompanyCreated,
  theme = 'light',
}) => {
  const [search, setSearch] = useState<string>('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Загружаем компании
  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchCompanies({ limit: 100 })
      .then((data) => {
        if (!alive) return;
        setCompanies(data.items);
        setFilteredCompanies(data.items);
      })
      .catch((e) => {
        console.error('Ошибка загрузки компаний:', e);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // Находим выбранную компанию
  useEffect(() => {
    if (value) {
      const company = companies.find((c) => c.id === value);
      setSelectedCompany(company || null);
      if (company) {
        setSearch(company.name);
      }
    } else {
      setSelectedCompany(null);
      setSearch('');
    }
  }, [value, companies]);

  // Фильтруем компании по поиску
  useEffect(() => {
    if (!search.trim()) {
      setFilteredCompanies(companies);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = companies.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower) ||
        c.website?.toLowerCase().includes(searchLower),
    );
    setFilteredCompanies(filtered);
  }, [search, companies]);

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

  const handleSelect = (company: Company) => {
    setSelectedCompany(company);
    setSearch(company.name);
    setIsOpen(false);
    onChange(company.id, company);
  };

  const handleClear = () => {
    setSelectedCompany(null);
    setSearch('');
    setIsOpen(false);
    onChange(null);
  };

  const handleCreate = async () => {
    if (!search.trim() || !allowCreate) return;

    setCreating(true);
    try {
      const newCompany = await createCompany({
        name: search.trim(),
        status: 'active',
      });
      setCompanies([newCompany, ...companies]);
      setFilteredCompanies([newCompany, ...companies]);
      handleSelect(newCompany);
      if (onCompanyCreated) {
        onCompanyCreated(newCompany);
      }
    } catch (e: any) {
      console.error('Ошибка создания компании:', e);
      alert(e.message || 'Ошибка создания компании');
    } finally {
      setCreating(false);
    }
  };

  const showCreateOption =
    allowCreate &&
    search.trim() &&
    !filteredCompanies.some((c) => c.name.toLowerCase() === search.toLowerCase().trim());

  const inputClassName =
    theme === 'dark'
      ? 'w-full px-3 py-2 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-lumiva-accent-soft focus:ring-2 focus:ring-lumiva-accent-soft/20 transition-colors'
      : 'w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors';

  const dropdownClassName =
    theme === 'dark'
      ? 'absolute z-50 w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-lg max-h-60 overflow-auto'
      : 'absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-lg max-h-60 overflow-auto';

  const clearButtonClassName =
    theme === 'dark'
      ? 'absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 text-lg leading-none'
      : 'absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none';

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
        {selectedCompany && (
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
          ) : filteredCompanies.length === 0 && !showCreateOption ? (
            <div className="px-3 py-2 text-xs text-slate-500">Компании не найдены</div>
          ) : (
            <>
              {filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => handleSelect(company)}
                  className={optionClassName}
                >
                  <div className={theme === 'dark' ? 'font-medium text-slate-100' : 'font-medium text-slate-900'}>
                    {company.name}
                  </div>
                  {company.email && (
                    <div className="text-[10px] text-slate-500">{company.email}</div>
                  )}
                </button>
              ))}
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
                        + Создать компанию:{' '}
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











