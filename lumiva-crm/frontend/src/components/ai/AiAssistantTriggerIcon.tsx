import React from 'react';

/** Иконка кнопки ИИ в шапке: монохромная «молния», без фиолетовой заливки */
export const AiAssistantTriggerIcon: React.FC<{ className?: string }> = ({
  className = 'h-5 w-5',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z" />
  </svg>
);
