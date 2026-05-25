import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0F172A",
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617",
        },
        coral: {
          DEFAULT: "#FF6B6B",
          50: "#FFF1F1",
          100: "#FFE0E0",
          200: "#FFC2C2",
          300: "#FF9999",
          400: "#FF7F7F",
          500: "#FF6B6B",
          600: "#E04A4A",
          700: "#B83838",
          800: "#8F2C2C",
          900: "#6B2222",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "panic-pulse": {
          "0%, 100%": { backgroundColor: "rgb(255 107 107 / 0.95)" },
          "50%": { backgroundColor: "rgb(176 32 32 / 1)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "panic-pulse": "panic-pulse 1.2s ease-in-out infinite",
        "fade-in": "fade-in .2s ease-out",
        "slide-in-right": "slide-in-right .25s ease-out",
        "slide-in-left": "slide-in-left .25s ease-out",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
