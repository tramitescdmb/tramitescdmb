/**
 * Trae Negocios Verdes desde la base de la plataforma anterior al SIC (tablas Nv*) y copia sus
 * imágenes al almacén público «negocios-verdes» del NAS. Ver docs/NEGOCIOS-VERDES.md.
 *
 *   NV_ORIGEN_URL='postgresql://…'  npm run nv:migrar -- --ensayo     (cuenta y valida; no guarda nada)
 *   NV_ORIGEN_URL='postgresql://…'  npm run nv:migrar                  (traslado real)
 *
 * Opciones:
 *   --ensayo        Convierte e inserta todo dentro de una transacción que se deshace al final.
 *                   Verifica llaves, únicos y tipos sin dejar rastro. No descarga imágenes.
 *   --reemplazar    Si ya hay negocios en el SIC, los borra (con todo lo del módulo) antes de cargar.
 *                   Sin esta opción, el script se detiene si encuentra datos.
 *   --sin-archivos  No copia imágenes (útil para repetir solo los datos).
 *   --sin-usuarios  No asigna perfiles de Negocios Verdes a los administradores encontrados.
 *
 * La dirección de la base de origen va SOLO en la variable NV_ORIGEN_URL (nunca en un archivo del
 * repositorio ni en el informe). La conexión es de solo lectura (BEGIN READ ONLY).
 */
import "../src/lib/cargar-env";
import { writeFile } from "fs/promises";
import os from "os";
import path from "path";
import pg from "pg";
import { db } from "../src/lib/db";
import { subir, almacenLocal, tipoPorExtension } from "../src/lib/almacen";
import { registrarAuditoria } from "../src/lib/auditoria";
import { asegurarPerfilesIniciales } from "../src/lib/perfiles";
import { BUCKET_NEGOCIOS_VERDES } from "../src/lib/negocios-verdes";
import { TABLAS_ORIGEN, conteos, convertirOrigen, type ArchivoPorCopiar, type Convertido, type Origen } from "../src/lib/negocios-verdes-migracion";

const args = new Set(process.argv.slice(2));
const ENSAYO = args.has("--ensayo");
const REEMPLAZAR = args.has("--reemplazar");
const SIN_ARCHIVOS = args.has("--sin-archivos") || ENSAYO;
const SIN_USUARIOS = args.has("--sin-usuarios") || ENSAYO;
const TOPE_IMAGEN = 10 * 1024 * 1024;

class EnsayoTerminado extends Error {}

async function leerOrigen(url: string): Promise<Origen> {
  // Las columnas «date» llegan como texto (2026-05-01), sin corrimiento de zona horaria.
  pg.types.setTypeParser(1082, (v) => v);
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const cliente = new pg.Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false } });
  await cliente.connect();
  try {
    await cliente.query("BEGIN READ ONLY");
    const origen = {} as Origen;
    for (const tabla of TABLAS_ORIGEN) {
      try {
        await cliente.query("SAVEPOINT t");
        origen[tabla] = (await cliente.query(`SELECT * FROM public."${tabla}"`)).rows;
        await cliente.query("RELEASE SAVEPOINT t");
      } catch (e) {
        await cliente.query("ROLLBACK TO SAVEPOINT t");
        if ((e as { code?: string }).code !== "42P01") throw e;
        console.warn(`  (la tabla ${tabla} no existe en el origen: se toma vacía)`);
        origen[tabla] = [];
      }
    }
    await cliente.query("ROLLBACK");
    return origen;
  } finally {
    await cliente.end();
  }
}

async function cargar(c: Convertido) {
  await db.$transaction(
    async (tx) => {
      const existentes = await tx.nvNegocio.count();
      if (existentes > 0 && !REEMPLAZAR) {
        throw new Error(`El SIC ya tiene ${existentes} negocios verdes. Para cargar de nuevo y reemplazarlos, agregue --reemplazar.`);
      }
      if (REEMPLAZAR) {
        // Orden inverso a las llaves foráneas.
        await tx.nvNegocioPersona.deleteMany();
        await tx.nvNegocioPuntaje.deleteMany();
        await tx.nvNegocioProducto.deleteMany();
        await tx.nvNegocioFoto.deleteMany();
        await tx.nvNegocioActividad.deleteMany();
        await tx.nvNegocioSubcategoria.deleteMany();
        await tx.nvNegocioCategoria.deleteMany();
        await tx.nvNegocio.deleteMany();
        await tx.nvPersona.deleteMany();
        await tx.nvActividad.deleteMany();
        await tx.nvSubcategoria.deleteMany();
        await tx.nvCategoria.deleteMany();
        await tx.nvVereda.deleteMany();
        await tx.nvOpcionCampo.deleteMany();
        await tx.nvBanner.deleteMany();
        await tx.nvConfiguracion.deleteMany();
      }
      await tx.nvCategoria.createMany({ data: c.categorias });
      await tx.nvSubcategoria.createMany({ data: c.subcategorias });
      await tx.nvActividad.createMany({ data: c.actividades });
      await tx.nvVereda.createMany({ data: c.veredas });
      await tx.nvNegocio.createMany({ data: c.negocios });
      await tx.nvNegocioCategoria.createMany({ data: c.negocioCategorias, skipDuplicates: true });
      await tx.nvNegocioSubcategoria.createMany({ data: c.negocioSubcategorias, skipDuplicates: true });
      await tx.nvNegocioActividad.createMany({ data: c.negocioActividades, skipDuplicates: true });
      await tx.nvNegocioFoto.createMany({ data: c.fotos });
      await tx.nvNegocioProducto.createMany({ data: c.productos });
      await tx.nvNegocioPuntaje.createMany({ data: c.puntajes });
      await tx.nvPersona.createMany({ data: c.personas });
      await tx.nvNegocioPersona.createMany({ data: c.vinculos });
      await tx.nvOpcionCampo.createMany({ data: c.opciones, skipDuplicates: true });
      await tx.nvBanner.createMany({ data: c.banners });
      if (c.configuracion) await tx.nvConfiguracion.create({ data: c.configuracion });

      const despues = {
        NvCategoria: await tx.nvCategoria.count(),
        NvNegocio: await tx.nvNegocio.count(),
        NvNegocioProducto: await tx.nvNegocioProducto.count(),
        NvPersona: await tx.nvPersona.count(),
        NvNegocioPersona: await tx.nvNegocioPersona.count(),
      };
      console.log("Filas en el SIC dentro de la transacción:", despues);
      if (ENSAYO) throw new EnsayoTerminado();
    },
    { timeout: 10 * 60_000, maxWait: 30_000 }
  );
}

async function copiarArchivos(archivos: ArchivoPorCopiar[]) {
  const fallidos: { ruta: string; motivo: string }[] = [];
  let copiados = 0;
  let bytes = 0;
  const cola = [...archivos];
  async function trabajador() {
    for (let a = cola.shift(); a; a = cola.shift()) {
      try {
        const r = await fetch(a.url, { signal: AbortSignal.timeout(60_000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const tipo = r.headers.get("content-type") ?? tipoPorExtension(a.ruta);
        if (!/^image\//.test(tipo)) throw new Error(`no es una imagen (${tipo})`);
        const contenido = Buffer.from(await r.arrayBuffer());
        if (contenido.length === 0) throw new Error("archivo vacío");
        if (contenido.length > TOPE_IMAGEN) throw new Error(`supera ${TOPE_IMAGEN / 1024 / 1024} MB`);
        await subir(BUCKET_NEGOCIOS_VERDES, a.ruta, contenido, tipo, true);
        copiados++;
        bytes += contenido.length;
      } catch (e) {
        fallidos.push({ ruta: a.ruta, motivo: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, trabajador));
  return { copiados, bytes, fallidos };
}

async function asignarAdministradores(admins: Convertido["administradores"]) {
  await asegurarPerfilesIniciales();
  const perfiles = await db.perfil.findMany({ where: { claveOrigen: { in: ["NEGOCIOS_VERDES:GESTION", "NEGOCIOS_VERDES:CONFIGURACION"] } }, select: { id: true, claveOrigen: true } });
  const idPerfil = (clave: string) => perfiles.find((p) => p.claveOrigen === clave)?.id;
  const resultado: { correo: string; perfil: string; estado: string }[] = [];
  for (const a of admins) {
    const clave = a.superAdmin ? "NEGOCIOS_VERDES:CONFIGURACION" : "NEGOCIOS_VERDES:GESTION";
    const perfilId = idPerfil(clave);
    const usuario = await db.usuario.findFirst({ where: { email: { equals: a.correo, mode: "insensitive" } }, select: { id: true, activo: true, modulosAcceso: true } });
    if (!usuario || !perfilId) {
      resultado.push({ correo: a.correo, perfil: clave, estado: "sin usuario en el SIC: crearlo y asignarle el perfil a mano" });
      continue;
    }
    await db.usuarioPerfil.upsert({ where: { usuarioId_perfilId: { usuarioId: usuario.id, perfilId } }, create: { usuarioId: usuario.id, perfilId }, update: {} });
    if (!usuario.modulosAcceso.includes("NEGOCIOS_VERDES")) {
      await db.usuario.update({ where: { id: usuario.id }, data: { modulosAcceso: { push: "NEGOCIOS_VERDES" } } });
    }
    resultado.push({ correo: a.correo, perfil: clave, estado: usuario.activo ? "asignado" : "asignado (usuario inactivo en el SIC)" });
  }
  return resultado;
}

async function main() {
  const url = process.env.NV_ORIGEN_URL?.trim();
  if (!url) {
    console.error("Falta la variable NV_ORIGEN_URL con la dirección de la base de origen (no se guarda en ningún archivo).");
    process.exit(1);
  }
  if (!SIN_ARCHIVOS && !almacenLocal()) {
    console.error("Falta ALMACEN_LOCAL_DIR (NAS). Use --sin-archivos para trasladar solo los datos.");
    process.exit(1);
  }

  console.log(ENSAYO ? "ENSAYO: no se guardará nada." : "Traslado real de Negocios Verdes al SIC.");
  console.log("Leyendo la base de origen (solo lectura)…");
  const origen = await leerOrigen(url);
  const convertido = convertirOrigen(origen);
  const tabla = conteos(origen, convertido);
  console.table(tabla);
  console.log(`Imágenes referenciadas: ${convertido.archivos.length}. Administradores en el origen: ${convertido.administradores.length}.`);

  const informe: Record<string, unknown> = { fecha: new Date().toISOString(), ensayo: ENSAYO, conteos: tabla, imagenes: convertido.archivos.length };

  try {
    await cargar(convertido);
  } catch (e) {
    if (!(e instanceof EnsayoTerminado)) throw e;
    console.log("Ensayo correcto: todas las filas entran sin errores. Transacción deshecha; no se guardó nada.");
  }

  if (!SIN_ARCHIVOS) {
    console.log(`Copiando ${convertido.archivos.length} imágenes al NAS (almacén «${BUCKET_NEGOCIOS_VERDES}»)…`);
    const r = await copiarArchivos(convertido.archivos);
    console.log(`Imágenes copiadas: ${r.copiados} (${(r.bytes / 1024 / 1024).toFixed(1)} MB). Fallidas: ${r.fallidos.length}.`);
    for (const f of r.fallidos.slice(0, 30)) console.log(`  ✗ ${f.ruta}: ${f.motivo}`);
    informe.archivos = r;
  }

  if (!SIN_USUARIOS) {
    const usuarios = await asignarAdministradores(convertido.administradores);
    console.table(usuarios);
    informe.usuarios = usuarios;
  }

  if (!ENSAYO) {
    await registrarAuditoria({
      tipo: "CONFIGURACION_ACTUALIZADA",
      descripcion: `Traslado de Negocios Verdes desde la plataforma anterior: ${convertido.negocios.length} negocios, ${convertido.personas.length} personas, ${convertido.archivos.length} imágenes referenciadas.`,
    });
  }

  // Fuera de la carpeta de la aplicación (no ensucia el repositorio del despliegue).
  const archivo = path.join(os.tmpdir(), `negocios-verdes-migracion-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(archivo, JSON.stringify(informe, null, 2));
  console.log(`Informe guardado en ${archivo}.`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("FALLÓ:", e instanceof Error ? e.message : e);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
