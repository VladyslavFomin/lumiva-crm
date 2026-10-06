/** @type {import('tailwindcss').Config} */
module.exports = {
  // hover-эффекты только на устройствах с настоящим hover — на тач-экранах не «залипают» после тапа
  future: { hoverOnlyWhenSupported: true },
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Public-page dark visuals — use arbitrary values to bypass the !important light-theme override in index.css
    'bg-[#0f172a]', 'bg-[#1e293b]', 'bg-[#1e293b]/80',
    'border-[#1e293b]', 'border-[#0f172a]',
    'text-white',
    // Responsive stat-strip borders
    'border-r', 'border-b', 'border-[#e7e7e7]',
    'md:border-r', 'md:border-b-0',
    'grid-cols-2', 'md:grid-cols-4',
    'px-5', 'md:px-8',
  ],
  theme: {
    extend: {
      colors: {
        // Core brand
        'lumiva-bg':          '#f6f7fb',
        'lumiva-card':        '#ffffff',
        'lumiva-accent':      '#222222',
        'lumiva-accent-soft': '#303030',
        'lumiva-accent-hover':'#111111',

        // Semantic surface
        'surface':            '#ffffff',
        'surface-hover':      '#f8f9fc',
        'surface-active':     '#f1f3f8',
        'surface-subtle':     '#f6f7fb',

        // Borders
        'border-default':     '#e5e8ef',
        'border-strong':      '#d0d4dd',

        // Text scale
        'text-primary':       '#111827',
        'text-secondary':     '#4b5563',
        'text-tertiary':      '#9ca3af',
        'text-disabled':      '#d1d5db',

        // Status
        'status-success':     '#059669',
        'status-success-bg':  '#d1fae5',
        'status-warning':     '#d97706',
        'status-warning-bg':  '#fef3c7',
        'status-error':       '#dc2626',
        'status-error-bg':    '#fee2e2',
        'status-info':        '#0284c7',
        'status-info-bg':     '#e0f2fe',
      },
      boxShadow: {
        'lumiva':   '0 18px 45px rgba(17,24,39,0.12)',
        'card':     '0 1px 3px rgba(17,24,39,0.08), 0 1px 2px rgba(17,24,39,0.04)',
        'card-md':  '0 4px 12px rgba(17,24,39,0.08), 0 2px 4px rgba(17,24,39,0.04)',
        'card-lg':  '0 12px 32px rgba(17,24,39,0.10), 0 4px 8px rgba(17,24,39,0.05)',
        'btn':      '0 1px 2px rgba(17,24,39,0.05)',
        'btn-primary': '0 4px 12px rgba(34,34,34,0.25)',
        'modal':    '0 24px 64px rgba(17,24,39,0.18)',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'xxs': ['10px', { lineHeight: '14px' }],
      },
      transitionTimingFunction: {
        'lumiva': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)',
        'drawer': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'indeterminate-bar': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        'fade-in':  'fade-in 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
        'slide-up': 'slide-up 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
        'indeterminate-bar': 'indeterminate-bar 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
