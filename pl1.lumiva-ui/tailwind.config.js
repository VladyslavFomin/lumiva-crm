/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        "lumiva-bg": "#020617",
        "lumiva-card": "#020617",
        "lumiva-accent": "#38bdf8",
        "lumiva-accent-soft": "#0ea5e9",
      },
      boxShadow: {
        lumiva: "0 22px 40px rgba(15,23,42,0.9)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};