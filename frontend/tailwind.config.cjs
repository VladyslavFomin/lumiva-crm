/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'lumiva-bg': '#f6f7fb',
        'lumiva-card': '#ffffff',
        'lumiva-accent': '#222222',
        'lumiva-accent-soft': '#303030',
      },
      boxShadow: {
        'lumiva': '0 18px 45px rgba(17,24,39,0.12)',
      },
      borderRadius: {
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
};
