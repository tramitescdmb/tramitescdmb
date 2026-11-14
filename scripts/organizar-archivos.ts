/**
 * Reordena los archivos ya guardados en el almacén (NAS) a la estructura por módulo/año/tipo
 * (src/lib/carpetas-almacen.ts) y actualiza las rutas en la base.
 *
 * Por defecto SOLO MUESTRA lo que haría; no mueve ni borra nada:
 *   npx tsx scripts/organizar-archivos.ts
 * Para mover de verdad (mejor fuera del horario de trabajo y con copia de la base):
 *   npx tsx scripts/organizar-archivos.ts --aplicar
 * Opcional: --modulo=tramites|gecon|correspondencia|sgdea|vital para hacer uno solo.
 *
 * Además lista los archivos del almacén que ninguna fila de la base usa ("huérfanos", p. ej. subidas
 * abandonadas) en un CSV junto al almacén. ESTE SCRIPT NUNCA BORRA ARCHIVOS: la lista es para revisarla
 * con el usuario antes de decidir.
 *
 * Variables: DATABASE_URL y ALMACEN_LOCAL_DIR (las mismas del servicio; en la VM, /opt/tramites/.env).
 */
import fs from "fs/promises";
import path from "path";
import { db } from "../src/lib/db";
import { almacenLocal } from "../src/lib/almacen";
import { organizarArchivos, type AmbitoArchivos, type MovimientoArchivo } from "../src/lib/organizar-archivos";

const aplicar = process.argv.includes("--aplicar");
const modulo = process.argv.find((a) => a.startsWith("--modulo="))?.split("=")[1] ?? null;

async function ambitos(): Promise<{ nombre: string; lista: AmbitoArchivos[] }[]> {
  const grupos: { nombre: string; clave: string; lista: () => Promise<AmbitoArchivos[]> }[] = [
    { nombre: "Trámites", clave: "tramites", lista: async () => (await db.expediente.findMany({ select: { id: true } })).map((e) => ({ tipo: "tramite", id: e.id })) },
    { nombre: "GECON", clave: "gecon", lista: async () => (await db.expedienteContractual.findMany({ select: { id: true } })).map((e) => ({ tipo: "contrato", id: e.id })) },
    { nombre: "Correspondencia", clave: "correspondencia", lista: async () => (await db.comunicacion.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } })).map((e) => ({ tipo: "comunicacion", id: e.id })) },
    { nombre: "SGDEA", clave: "sgdea", lista: async () => (await db.expedienteDocumental.findMany({ select: { id: true } })).map((e) => ({ tipo: "documental", id: e.id })) },
    { nombre: "VITAL", clave: "vital", lista: async () => (await db.solicitudVital.findMany({ select: { id: true } })).map((e) => ({ tipo: "vital", id: e.id })) },
  ];
  const r = [];
  for (const g of grupos) if (!modulo || modulo === g.clave) r.push({ nombre: g.nombre, lista: await g.lista() });
  return r;
}

async function rutasEnUso(): Promise<Set<string>> {
  const s = { select: { storagePath: true } };
  const filas = await Promise.all([
    db.expedienteDocumento.findMany(s),
    db.visitaTecnicaFoto.findMany(s),
    db.documentoContrato.findMany(s),
    db.comunicacionDocumento.findMany(s),
    db.documentoArchivo.findMany(s),
    db.solicitudVitalDocumento.findMany(s),
  ]);
  return new Set(filas.flat().map((f) => f.storagePath));
}

async function archivosDelAlmacen(raiz: string, rel = ""): Promise<string[]> {
  const items = await fs.readdir(path.join(raiz, rel), { withFileTypes: true }).catch(() => []);
  const r: string[] = [];
  for (const i of items) {
    const sub = rel ? `${rel}/${i.name}` : i.name;
    if (i.isDirectory()) r.push(...(await archivosDelAlmacen(raiz, sub)));
    else if (i.isFile()) r.push(sub);
  }
  return r;
}

function csv(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

async function main() {
  console.log(aplicar ? "== MODO APLICAR: se moverán archivos ==" : "== SIMULACIÓN: no se mueve nada (use --aplicar para mover) ==");
  const todos: (MovimientoArchivo & { modulo: string })[] = [];
  for (const g of await ambitos()) {
    let n = 0;
    for (const a of g.lista) {
      const movs = await organizarArchivos(a, { simular: !aplicar });
      for (const m of movs) todos.push({ ...m, modulo: g.nombre });
      n += movs.length;
    }
    console.log(`${g.nombre}: ${g.lista.length} expedientes revisados, ${n} archivo(s) fuera de su carpeta.`);
  }
  for (const m of todos) console.log(`[${m.estado}] ${m.modulo}: ${m.origen} -> ${m.destino}${m.detalle ? ` (${m.detalle})` : ""}`);
  const cuenta = (e: string) => todos.filter((m) => m.estado === e).length;
  console.log(`\nResumen: ${cuenta("movido")} movidos, ${cuenta("simulado")} por mover, ${cuenta("omitido")} omitidos, ${cuenta("error")} con error.`);

  const raiz = almacenLocal();
  if (raiz) {
    const base = path.resolve(raiz, "documentos");
    const enUso = await rutasEnUso();
    // derivados/ es caché regenerable (PDF con sello de firma); no cuenta como huérfano.
    const huerfanos = (await archivosDelAlmacen(base)).filter((r) => !enUso.has(r) && !r.startsWith("derivados/"));
    const destino = path.join(raiz, `huerfanos-${new Date().toISOString().slice(0, 10)}.csv`);
    let bytes = 0;
    const lineas = ["ruta,tamano_bytes,modificado"];
    for (const r of huerfanos) {
      const st = await fs.stat(path.join(base, r));
      bytes += st.size;
      lineas.push([csv(r), st.size, st.mtime.toISOString()].join(","));
    }
    await fs.writeFile(destino, lineas.join("\n") + "\n");
    console.log(`\nArchivos que ninguna fila de la base usa: ${huerfanos.length} (${(bytes / 1048576).toFixed(1)} MB). Lista en ${destino}. No se borró ninguno.`);
  }
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
