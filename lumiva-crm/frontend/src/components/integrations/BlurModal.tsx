import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export type BlurModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full90';

export type BlurModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  /** Panel max width */
  size?: BlurModalSize;
};

const SIZE_CLASS: Record<BlurModalSize, string> = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  /** ~90% viewport — forms and two-column marketing setup */
  full90: 'w-[min(100vw-1rem,calc(100vw-16px)))] max-w-[min(96vw,1400px)] sm:max-w-[90vw]',
};

/**
 * Centered glass dialog: light translucent overlay + strong blur (no heavy grey dim).
 */
export const BlurModal: React.FC<BlurModalProps> = ({
  open,
  onClose,
  children,
  labelledBy,
  size = 'lg',
}) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const maxW = SIZE_CLASS[size];
  const maxH = size === 'full90' ? 'max-h-[90dvh]' : 'max-h-[min(90dvh,900px)]';
  const pad = size === 'full90' ? 'p-2 sm:p-4' : 'p-3 sm:p-5';

  return createPortal(
    <div
      className={`fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/[0.07] ${pad} backdrop-blur-xl`}
      role="dialog"
      aria-modal
      aria-labelledby={labelledBy}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex ${maxH} w-full ${maxW} flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:rounded-3xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};
