/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'lumiva-bg': '#050816',
        'lumiva-card': '#0b1220',
        'lumiva-accent': '#38bdf8',
        'lumiva-accent-soft': '#0ea5e9',
      },
      boxShadow: {
        'lumiva': '0 18px 45px rgba(15,23,42,0.85)',
      },
      borderRadius: {
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
};
