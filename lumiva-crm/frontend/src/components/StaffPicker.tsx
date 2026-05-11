// src/components/StaffPicker.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { fetchStaff, type StaffUser } from '../api/staff';

// Module-level cache — one API call per session
let _staffCache: StaffUser[] | null = null;
let _staffPromise: Promise<StaffUser[]> | null = null;

function getStaffCached(): Promise<StaffUser[]> {
  if (_staffCache) return Promise.resolve(_staffCache);
  if (!_staffPromise) {
    _staffPromise = fetchStaff()
      .then((list) => { _staffCache = list; _staffPromise = null; return list; })
      .catch((e) => { _staffPromise = null; throw e; });
  }
  return _staffPromise;
}

export interface StaffPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  single?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
}

const INK = '#222';
const FG2 = '#555';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE2 = '#e7e7e7';
const LINE3 = '#f0f0f0';
const BG_MUTED = '#fafafa';
const BG_SOFT = '#f5f5f5';
const FF = 'inherit';
const FF_MONO = 'inherit';

export const StaffPicker: React.FC<StaffPickerProps> = ({
  value,
  onChange,
  single = false,
  placeholder = '— выберите сотрудника —',
  style,
}) => {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getStaffCached()
      .then((list) => setStaff(list.filter((u) => u.isActive !== false)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return staff;
    return staff.filter(
      (u) =>
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q),
    );
  }, [staff, search]);

  const groups = useMemo(() => {
    const map: Record<string, StaffUser[]> = {};
    filtered.forEach((u) => {
      const dept = u.department || 'Без отдела';
      if (!map[dept]) map[dept] = [];
      map[dept].push(u);
    });
    return Object.entries(map).sort(([a], [b]) => {
      if (a === 'Без отдела') return 1;
      if (b === 'Без отдела') return -1;
      return a.localeCompare(b, 'ru');
    });
  }, [filtered]);

  const selectedUsers = staff.filter((u) => value.includes(u.id));

  const displayText =
    selectedUsers.length === 0
      ? placeholder
      : selectedUsers.map((u) => u.fullName || u.email).join(', ');

  const toggle = (userId: string) => {
    if (single) {
      onChange([userId]);
      setOpen(false);
    } else {
      const next = value.includes(userId)
        ? value.filter((id) => id !== userId)
        : [...value, userId];
      onChange(next);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch(''); }}
        style={{
          width: '100%',
          padding: '9px 32px 9px 12px',
          border: `1px solid ${LINE2}`,
          borderRadius: 7,
          fontFamily: FF,
          fontSize: 12.5,
          color: selectedUsers.length === 0 ? FG3 : INK,
          background: '#fff',
          textAlign: 'left',
          cursor: 'pointer',
          outline: 0,
          boxSizing: 'border-box',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23898989' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
        } as React.CSSProperties}
      >
        {displayText}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 160,
            background: '#fff',
            border: `1px solid ${LINE2}`,
            borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderBottom: `1px solid ${LINE3}`,
            }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={FG3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>
            </svg>
            <input
              autoFocus
              placeholder="Поиск по имени..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                fontSize: 12.5,
                fontFamily: FF,
                color: INK,
                background: 'transparent',
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 264, overflowY: 'auto' }}>
            {groups.length === 0 && (
              <div style={{ padding: '12px 16px', fontSize: 12, color: FG3, fontFamily: FF }}>
                Сотрудники не найдены
              </div>
            )}
            {groups.map(([dept, users]) => (
              <div key={dept}>
                {groups.length > 1 && (
                  <div
                    style={{
                      padding: '6px 12px 3px',
                      fontSize: 10,
                      color: FG4,
                      fontFamily: FF_MONO,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {dept}
                  </div>
                )}
                {users.map((u) => {
                  const selected = value.includes(u.id);
                  const isHovered = hovered === u.id;
                  const initials = (u.fullName || u.email || '?').charAt(0).toUpperCase();
                  return (
                    <div
                      key={u.id}
                      onMouseEnter={() => setHovered(u.id)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => toggle(u.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '7px 12px',
                        cursor: 'pointer',
                        background: selected ? BG_MUTED : isHovered ? BG_SOFT : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      {!single && (
                        <input
                          type="checkbox"
                          checked={selected}
                          readOnly
                          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: INK, flexShrink: 0 }}
                        />
                      )}
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: BG_SOFT,
                          border: `1px solid ${LINE3}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 600,
                          color: FG2,
                          fontFamily: FF,
                          overflow: 'hidden',
                        }}
                      >
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          initials
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: INK,
                            fontFamily: FF,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {u.fullName || u.email}
                        </div>
                        {u.fullName && u.email && (
                          <div style={{ fontSize: 10.5, color: FG3, fontFamily: FF }}>
                            {u.email}
                          </div>
                        )}
                      </div>
                      {selected && single && (
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer: clear selection */}
          {!single && value.length > 0 && (
            <div
              style={{
                padding: '7px 12px',
                borderTop: `1px solid ${LINE3}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11.5,
                fontFamily: FF,
                color: FG2,
              }}
            >
              <span>Выбрано: {value.length}</span>
              <button
                type="button"
                onClick={() => onChange([])}
                style={{
                  background: 'none',
                  border: 0,
                  cursor: 'pointer',
                  color: FG3,
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontFamily: FF,
                }}
              >
                Очистить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
