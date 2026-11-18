// Configuración de la línea de comandos de Prisma (Prisma 7: la URL de la base ya no va en
// schema.prisma). Prisma 7 tampoco lee .env por sí solo: se carga aquí con dotenv.
// Para «prisma db push» se usa DIRECT_URL si existe (conexión directa, como antes con directUrl);
// si no, DATABASE_URL. La aplicación NO usa este archivo: se conecta con src/lib/db.ts.
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
