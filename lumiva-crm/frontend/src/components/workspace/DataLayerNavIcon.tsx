import React from 'react';

/** Маркер «данные» в сайдбаре без текстовой плашки — слой импорта/интеграций. */
export const DataLayerNavIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    className={`h-3.5 w-3.5 ${className}`}
    aria-hidden
  >
    <path d="M4 7c0-1.1 2.2-2 5-2s5 .9 5 2-2.2 2-5 2-5-.9-5-2Z" />
    <path d="M4 7v10c0 1.1 2.2 2 5 2s5-.9 5-2V7" />
    <path d="M4 12c0 1.1 2.2 2 5 2s5-.9 5-2" opacity={0.45} />
  </svg>
);
