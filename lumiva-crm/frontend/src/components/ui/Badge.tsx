import React from 'react';
import { cn } from '../../lib/cn';

type BadgeVariant = 'active' | 'inactive' | 'warning' | 'error' | 'info' | 'default';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantClass: Record<BadgeVariant, string> = {
  active:   'badge-active',
  inactive: 'badge-inactive',
  warning:  'badge-warning',
  error:    'badge-error',
  info:     'badge-info',
  default:  'badge bg-surface-subtle text-text-secondary',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', dot, className, children, ...rest }) => (
  <span className={cn(variantClass[variant], className)} {...rest}>
    {dot && (
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 opacity-80" />
    )}
    {children}
  </span>
);
