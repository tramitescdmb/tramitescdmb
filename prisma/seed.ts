import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const db = new PrismaClient();

type PasoJson = {
  numero: number;
  titulo: string;
  descripcion: string;
  responsables: string[];
  documentos: string[];
  tiempo: string | null;
  tiempoDias: number | null;
  esDecision: boolean;
  opciones: unknown | null;
};

type FlujoJson = {
  codigo: string;
  nombre: string;
  esFlujoInicial: boolean;
  suitNumero?: string;
  resumen?: string;
  pasos: PasoJson[];
};

type DocumentoRequeridoJson = {
  orden: number;
  nombre: string;
  obligatorio: boolean;
  notas: string | null;
  aplicaA?: "NATURAL" | "JURIDICA" | null;
};

type TramiteJson = {
  codigo: string;
  version: string;
  fecha: string;
  proceso: string;
  nombre: string;
  nombreCompleto: string;
  slug: string;
  archivoFuente: string;
  objeto: string;
  resumen?: string;
  alcance: string;
  autoridadResponsabilidad: string;
  suitNumeros?: string[];
  documentosRequeridos: DocumentoRequeridoJson[];
  flujos: FlujoJson[];
};

async function seedTramites() {
  const dataDir = join(__dirname, "..", "data", "tramites");
  const files = readdirSync(dataDir).filter(
    (f) => f.endsWith(".json") && !f.startsWith("_")
  );

  console.log(`Encontrados ${files.length} archivos de trámites en ${dataDir}`);

  for (const file of files) {
    const raw = readFileSync(join(dataDir, file), "utf-8");
    const t: TramiteJson = JSON.parse(raw);

    const tramite = await db.tramiteTipo.upsert({
      where: { codigo: t.codigo },
      create: {
        codigo: t.codigo,
        version: t.version,
        fecha: new Date(t.fecha),
        proceso: t.proceso,
        nombre: t.nombre,
        nombreCompleto: t.nombreCompleto,
        slug: t.slug,
        archivoFuente: t.archivoFuente,
        objeto: t.objeto,
        resumen: t.resumen ?? null,
        alcance: t.alcance,
        autoridadResponsabilidad: t.autoridadResponsabilidad,
        suitNumeros: t.suitNumeros ?? [],
      },
      update: {
        version: t.version,
        fecha: new Date(t.fecha),
        proceso: t.proceso,
        nombre: t.nombre,
        nombreCompleto: t.nombreCompleto,
        slug: t.slug,
        archivoFuente: t.archivoFuente,
        objeto: t.objeto,
        resumen: t.resumen ?? null,
        alcance: t.alcance,
        autoridadResponsabilidad: t.autoridadResponsabilidad,
        suitNumeros: t.suitNumeros ?? [],
      },
    });

    // documentosRequeridos no tiene FK desde Expediente (a diferencia de Flujo/PasoDefinicion, que
    // sí referencia Expediente.flujoId) — así que borrarlo y re-sembrarlo es siempre seguro, tenga
    // o no expedientes reales el trámite. Esto debe ir ANTES del guard de abajo: si el trámite ya
    // tiene expedientes y hacemos `continue`, un `createMany` posterior a ese guard nunca se
    // ejecutaría y el trámite se quedaría sin su lista de "documentos para radicar".
    await db.documentoRequeridoDefinicion.deleteMany({ where: { tramiteTipoId: tramite.id } });
    if (t.documentosRequeridos?.length) {
      await db.documentoRequeridoDefinicion.createMany({
        data: t.documentosRequeridos.map((d) => ({
          tramiteTipoId: tramite.id,
          orden: d.orden,
          nombre: d.nombre,
          obligatorio: d.obligatorio,
          notas: d.notas,
          aplicaA: d.aplicaA ?? null,
        })),
      });
    }

    // Reset de flujos/pasos para poder re-sembrar de forma idempotente — pero si ya hay expedientes
    // reales que apuntan a un flujo de este trámite, borrarlo rompe la referencia (FK). En ese
    // caso se deja el flujo/pasos existentes tal cual (no se puede re-sembrar ese trámite sin
    // antes migrar sus expedientes a los flujos nuevos) y se sigue con los demás.
    const expedientesExistentes = await db.expediente.count({ where: { tramiteTipoId: tramite.id } });
    if (expedientesExistentes > 0) {
      console.log(
        `  ⚠ ${t.codigo} tiene ${expedientesExistentes} expediente(s) real(es) — se deja su flujo/pasos actuales sin tocar.`
      );
      continue;
    }

    await db.pasoDefinicion.deleteMany({ where: { flujo: { tramiteTipoId: tramite.id } } });
    await db.flujo.deleteMany({ where: { tramiteTipoId: tramite.id } });

    for (let i = 0; i < t.flujos.length; i++) {
      const f = t.flujos[i];
      const flujo = await db.flujo.create({
        data: {
          tramiteTipoId: tramite.id,
          codigo: f.codigo,
          nombre: f.nombre,
          esFlujoInicial: f.esFlujoInicial,
          orden: i,
          suitNumero: f.suitNumero ?? null,
          resumen: f.resumen ?? null,
        },
      });

      await db.pasoDefinicion.createMany({
        data: f.pasos.map((p) => ({
          flujoId: flujo.id,
          numero: p.numero,
          titulo: p.titulo,
          descripcion: p.descripcion,
          responsables: p.responsables ?? [],
          documentos: p.documentos ?? [],
          tiempo: p.tiempo,
          tiempoDias: p.tiempoDias,
          esDecision: p.esDecision,
          opciones: p.opciones ?? undefined,
        })),
      });
    }

    console.log(`  ✔ ${t.codigo} — ${t.nombre} (${t.flujos.length} flujo(s))`);
  }
}

async function seedCargos() {
  const { CARGOS_CDMB } = await import("../src/lib/cargos");
  for (let i = 0; i < CARGOS_CDMB.length; i++) {
    await db.cargo.upsert({
      where: { nombre: CARGOS_CDMB[i].nombre },
      create: { nombre: CARGOS_CDMB[i].nombre, orden: i },
      update: { orden: i },
    });
  }
  console.log(`Sembrados ${CARGOS_CDMB.length} cargos.`);
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || "tramitescdmb@gmail.com";
  const existing = await db.usuario.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuario admin ya existe: ${email}`);
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  await db.usuario.create({
    data: {
      email,
      nombre: "Administrador CDMB",
      passwordHash,
      rol: "ADMIN",
    },
  });

  console.log("\n=== USUARIO ADMIN CREADO ===");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log("=== Guarda esta contraseña, no se volverá a mostrar ===\n");
}

async function seedConfiguracionSitio() {
  await db.configuracionSitio.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  console.log("Configuración del sitio (fila singleton) lista.");
}

// SGDEA — organigrama mínimo editable (derivado de la estructura real de la CDMB)
// + una serie "sin clasificar" para no bloquear la radicación mientras se cargan
// las TRD reales desde el admin. Todo es upsert idempotente por código.
async function seedCorrespondencia() {
  const dependencias: { codigo: string; nombre: string; parent?: string; nivel: number; orden: number }[] = [
    { codigo: "DG", nombre: "Dirección General", nivel: 0, orden: 0 },
    { codigo: "SG", nombre: "Secretaría General", parent: "DG", nivel: 1, orden: 1 },
    { codigo: "SEYCA", nombre: "Subdirección de Evaluación y Control Ambiental (SEYCA)", parent: "DG", nivel: 1, orden: 2 },
    { codigo: "SPGA", nombre: "Subdirección de Planeación y Gestión Ambiental", parent: "DG", nivel: 1, orden: 3 },
    { codigo: "SADM", nombre: "Subdirección Administrativa y Financiera", parent: "DG", nivel: 1, orden: 4 },
    { codigo: "GD", nombre: "Grupo de Gestión Documental", parent: "SG", nivel: 2, orden: 5 },
    { codigo: "VENT", nombre: "Ventanilla Única de Correspondencia", parent: "GD", nivel: 3, orden: 6 },
    { codigo: "JUR", nombre: "Grupo Jurídico", parent: "SG", nivel: 2, orden: 7 },
  ];
  const idPorCodigo = new Map<string, string>();
  for (const d of dependencias) {
    const parentId = d.parent ? idPorCodigo.get(d.parent) ?? null : null;
    const fila = await db.dependencia.upsert({
      where: { codigo: d.codigo },
      create: { codigo: d.codigo, nombre: d.nombre, parentId, nivel: d.nivel, orden: d.orden },
      update: { nombre: d.nombre, parentId, nivel: d.nivel, orden: d.orden },
    });
    idPorCodigo.set(d.codigo, fila.id);
  }

  // Serie/subserie por defecto para poder radicar sin TRD cargada aún.
  const serie = await db.serieDocumental.upsert({
    where: { codigo_version: { codigo: "SIN-CLASIF", version: "1" } },
    create: { codigo: "SIN-CLASIF", nombre: "Sin clasificar (pendiente TRD)", version: "1" },
    update: {},
  });
  await db.subserieDocumental.upsert({
    where: { serieId_codigo: { serieId: serie.id, codigo: "GEN" } },
    create: { serieId: serie.id, codigo: "GEN", nombre: "General", retencionGestionAnios: 0, retencionCentralAnios: 0 },
    update: {},
  });

  console.log(`Sembradas ${dependencias.length} dependencias + serie por defecto "Sin clasificar".`);
}

async function main() {
  await seedTramites();
  await seedCargos();
  await seedConfiguracionSitio();
  await seedCorrespondencia();
  await seedAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
