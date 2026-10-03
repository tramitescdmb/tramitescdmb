import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const neutros = {
  50: "#faf8f3",
  100: "#f1f2ed",
  200: "#e1e5df",
  300: "#c7cec5",
  400: "#9aa59d",
  500: "#76847a",
  600: "#5b6b60",
  700: "#435047",
  800: "#2d3a31",
  900: "#1b2a20",
  950: "#111a14",
};

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        md: "0.5rem",
      },
      colors: {
        stone: neutros,
        graphite: neutros,
        cdmb: {
          50: "#eef8f4",
          100: "#dceee6",
          200: "#b6dfcd",
          300: "#82c9ab",
          400: "#40ab85",
          500: "#139a72",
          600: "#038f67",
          700: "#026b4d",
          800: "#035640",
          900: "#044735",
          950: "#022a1f",
        },
        acento: {
          50: "#fff4eb",
          100: "#ffe5cf",
          200: "#ffc99c",
          300: "#ffa863",
          400: "#ff9440",
          500: "#ff8623",
          600: "#cc6b1c",
          700: "#a35616",
          800: "#7a4011",
          900: "#522b0b",
        },
        vivo: {
          100: "#d9f7e1",
          500: "#01bd32",
          600: "#019a29",
        },
        menu: {
          100: "#eef7d6",
          500: "#85c800",
          600: "#6ea500",
        },
        govco: "#3366cc",
        techblue: {
          50: "#eef5f9",
          100: "#d6e7f0",
          200: "#aecfe1",
          300: "#7cb1cc",
          400: "#4c8fb3",
          500: "#2a6f97",
          600: "#235d80",
          700: "#1d4c69",
          800: "#173c53",
          900: "#122e3f",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(27,42,32,0.04), 0 8px 24px -8px rgba(27,42,32,0.10)",
        "soft-lg": "0 2px 6px rgba(27,42,32,0.05), 0 16px 40px -12px rgba(27,42,32,0.14)",
      },
    },
  },
  plugins: [],
} satisfies Config;
