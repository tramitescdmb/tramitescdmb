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
      },
    },
  },
  plugins: [],
} satisfies Config;
