import React from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'md' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantClass = {
  default:     'card',
  md:          'card-md',
  interactive: 'card-interactive',
};

const paddingClass = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(variantClass[variant], paddingClass[padding], className)}
      {...rest}
    >
      {children}
    </div>
  ),
);

Card.displayName = 'Card';

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <div className={cn('flex items-center justify-between gap-3 mb-4', className)} {...rest}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...rest }) => (
  <h3 className={cn('text-sm font-semibold text-[#111827]', className)} {...rest}>
    {children}
  </h3>
);
