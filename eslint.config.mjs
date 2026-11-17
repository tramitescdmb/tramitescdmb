import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Reglas nuevas de eslint-plugin-react-hooks 7 (llegan con eslint-config-next 16, pensadas para
    // el React Compiler, que aquí NO se usa). Marcan patrones que ya existían y funcionan; se dejan
    // como aviso para corregirlos con calma en un cambio aparte, no de golpe en la actualización.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "src/generated/**"]),
]);

export default eslintConfig;
