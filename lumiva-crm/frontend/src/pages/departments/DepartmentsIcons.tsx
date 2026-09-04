// src/pages/departments/DepartmentsIcons.tsx
import React from 'react';

export const Ic: React.FC<{ d: React.ReactNode; size?: number; sw?: number; className?: string }> = ({
  d,
  size = 16,
  sw = 1.6,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

export const DIC: Record<string, React.ReactNode> = {
  dept: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 8h2" />
      <path d="M13 8h2" />
      <path d="M9 12h2" />
      <path d="M13 12h2" />
      <path d="M9 16h6" />
    </>
  ),
  crown: (
    <>
      <path d="M3 18h18" />
      <path d="M4 8l4 4 4-8 4 8 4-4-2 8H6L4 8z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-4 3-7 7-7s7 3 7 7" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-4 3-7 7-7s7 3 7 7" />
      <path d="M16 4.5a3.5 3.5 0 010 7" />
      <path d="M22 20c0-2.6-1.4-4.8-3.5-6" />
    </>
  ),
  move: (
    <>
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <path d="M9 6l3-3 3 3" />
      <path d="M9 18l3 3 3-3" />
      <path d="M6 9L3 12l3 3" />
      <path d="M18 9l3 3-3 3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9" />
      <path d="M17 3l3 3" />
      <path d="M14 6l3 3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  check: <path d="M5 12l4 4 10-10" />,
  chev: <path d="M6 9l6 6 6-6" />,
  chevR: <path d="M9 6l6 6-6 6" />,
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2 4 2 4H5" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 10h18" />
      <path d="M3 16h18" />
      <path d="M9 4v16" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
};
