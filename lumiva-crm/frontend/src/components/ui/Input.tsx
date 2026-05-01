import React from 'react';
import { cn } from '../../lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, className, id, ...rest }, ref) => {
    const inputId = id ?? `input-${Math.random().toString(36).slice(2)}`;
    return (
      <div className="form-group">
        {label && <label htmlFor={inputId} className="form-label">{label}</label>}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary w-4 h-4">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn('base-input', icon ? 'pl-9' : '', error ? 'border-status-error focus:ring-red-100 focus:border-status-error' : '', className)}
            {...rest}
          />
        </div>
        {hint && !error && <p className="form-hint">{hint}</p>}
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...rest }, ref) => {
    const selectId = id ?? `select-${Math.random().toString(36).slice(2)}`;
    return (
      <div className="form-group">
        {label && <label htmlFor={selectId} className="form-label">{label}</label>}
        <select
          ref={ref}
          id={selectId}
          className={cn('base-select', error && 'border-status-error', className)}
          {...rest}
        >
          {children}
        </select>
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...rest }, ref) => {
    const textareaId = id ?? `textarea-${Math.random().toString(36).slice(2)}`;
    return (
      <div className="form-group">
        {label && <label htmlFor={textareaId} className="form-label">{label}</label>}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn('base-textarea', error && 'border-status-error', className)}
          {...rest}
        />
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
