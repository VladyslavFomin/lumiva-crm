import React from 'react';
import { cn } from '../../lib/cn';

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Pill-style on/off switch — same look as the RBAC permission matrix toggle. */
export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled, className, ...rest }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onChange}
    className={cn(
      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition',
      checked ? 'bg-emerald-500' : 'bg-slate-300 hover:bg-slate-400',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      className,
    )}
    {...rest}
  >
    <span
      className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
        checked ? 'translate-x-4' : 'translate-x-1',
      )}
    />
  </button>
);
