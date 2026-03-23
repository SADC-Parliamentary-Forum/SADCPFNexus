import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens (Design/Web/admin_overview_dashboard_1)
        "background-light": "#f6f7f8",
        "background-dark": "#101922",
        // SADC PF Brand primary
        primary: {
          DEFAULT: "#1d85ed",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#1d85ed",
          600: "#1a75d4",
          700: "#1a65bb",
          800: "#1e4e8a",
          900: "#1e3a5f",
          950: "#172554",
        },
        // Surface colours
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f6f7f8",
          dark: "#101922",
        },
        // Sidebar (now light)
        sidebar: {
          DEFAULT: "#ffffff",
          foreground: "#334155",
          border: "#e2e8f0",
          accent: "#1d85ed",
        },
        // Neutral palette (maps to slate)
        neutral: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      fontFamily: {
        sans: ["Public Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        elevated: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        sidebar: "2px 0 8px 0 rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
