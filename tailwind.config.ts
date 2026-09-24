import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        stone: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#dde1e7",
          300: "#c3c9d3",
          400: "#9aa3b2",
          500: "#727d8f",
          600: "#545e6f",
          700: "#3f4757",
          800: "#2b3140",
          900: "#1c212c",
          950: "#12151d",
        },
        cdmb: {
          50: "#eefaf1",
          100: "#d5f2dd",
          200: "#ade4bd",
          300: "#7ccf97",
          400: "#4bb473",
          500: "#2b9757",
          600: "#1c7a45",
          700: "#186139",
          800: "#164e30",
          900: "#134129",
          950: "#082417",
        },
        graphite: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#dde1e7",
          300: "#c3c9d3",
          400: "#9aa3b2",
          500: "#727d8f",
          600: "#545e6f",
          700: "#3f4757",
          800: "#2b3140",
          900: "#1c212c",
          950: "#12151d",
        },
        techblue: {
          50: "#eef4ff",
          100: "#dce8ff",
          200: "#bcd4fe",
          300: "#8fb8fd",
          400: "#5b94fa",
          500: "#346bf1",
          600: "#2151d6",
          700: "#1d42ac",
          800: "#1c398a",
          900: "#1b336f",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28,33,45,0.04), 0 8px 24px -8px rgba(28,33,45,0.10)",
        "soft-lg": "0 2px 6px rgba(28,33,45,0.05), 0 16px 40px -12px rgba(28,33,45,0.14)",
      },
    },
  },
  plugins: [],
} satisfies Config;
