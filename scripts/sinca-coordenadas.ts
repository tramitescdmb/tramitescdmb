import { completarCoordenadasDesdeSolicitudes } from "../src/lib/sinca-sync";

async function main() {
  console.log("Buscando coordenadas de SINCA 1.0 en las solicitudes…");
  const t = Date.now();
  const { actualizados, omitidas } = await completarCoordenadasDesdeSolicitudes();
  console.log(`OK — ${actualizados} resoluciones con coordenadas nuevas (${omitidas} solicitudes ilegibles en el API) en ${((Date.now() - t) / 1000).toFixed(0)} s`);
  process.exit(0);
}

main();
