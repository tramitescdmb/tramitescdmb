import { enriquecerResoluciones } from "../src/lib/sinca-sync";

async function main() {
  console.log("Enriqueciendo SINCA 1.0 (detalle por resolución)…");
  const t = Date.now();
  const n = await enriquecerResoluciones({ concurrencia: 5 });
  console.log(`OK — ${n} registros enriquecidos en ${((Date.now() - t) / 1000).toFixed(0)} s`);
  process.exit(0);
}

main();
