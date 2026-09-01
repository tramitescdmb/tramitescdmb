/**
 * Enriquecimiento completo del espejo SINCA 1.0: recorre TODAS las resoluciones
 * sin detalle y les completa fechaRecibido / diasResolucion / solicitante.
 *
 * Uso:  npx tsx scripts/sinca-enrich.ts
 *
 * Es lento (una llamada de detalle por registro, ~4 en paralelo). Correr una vez
 * tras el primer backfill; luego el cron diario mantiene al día lo nuevo.
 */
import { enriquecerResoluciones } from "../src/lib/sinca-sync";

async function main() {
  console.log("Enriqueciendo SINCA 1.0 (detalle por resolución)…");
  const t = Date.now();
  const n = await enriquecerResoluciones({ concurrencia: 5 });
  console.log(`OK — ${n} registros enriquecidos en ${((Date.now() - t) / 1000).toFixed(0)} s`);
  process.exit(0);
}

main();
