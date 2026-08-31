/**
 * Sincroniza el espejo local `SincaResolucion` con el API de SINCA 1.0.
 *
 * Uso:  npx tsx scripts/sinca-sync.ts
 *
 * Sirve tanto para el backfill inicial (tabla vacía) como para refrescar.
 * Necesita SINCA_API_URL / SINCA_API_USUARIO / SINCA_API_PASSWORD en el entorno
 * (se cargan de .env / .env.local).
 */
import { sincronizarResoluciones } from "../src/lib/sinca-sync";

async function main() {
  console.log("Sincronizando SINCA 1.0 (resoluciones de fondo)…");
  const r = await sincronizarResoluciones("script");
  if (!r.ok) {
    console.error("FALLÓ:", r.error);
    process.exit(1);
  }
  console.log(
    `OK — total API: ${r.totalApi} | nuevos: ${r.creados} | actualizados: ${r.actualizados} | eliminados: ${r.eliminados} | ${(r.duracionMs / 1000).toFixed(1)}s`
  );
  process.exit(0);
}

main();
