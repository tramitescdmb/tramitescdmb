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

// SGDEA — organigrama REAL de la CDMB (códigos y nombres oficiales tal como
// aparecen en la TRD/CCD vigentes: A-GD-F013 v5 y A-GD-FO31 v2) + una serie
// "sin clasificar" para no bloquear la radicación mientras se cargan TRD
// adicionales desde el admin. Todo es upsert idempotente por código.
async function seedCorrespondencia() {
  const dependencias: { codigo: string; nombre: string; parent?: string; nivel: number; orden: number }[] = [
    { codigo: "100", nombre: "Dirección General", nivel: 0, orden: 0 },
    { codigo: "110", nombre: "Oficina Asesora de Direccionamiento Estratégico Institucional - ADEI", parent: "100", nivel: 1, orden: 1 },
    { codigo: "120", nombre: "Oficina de Control Interno - OCI", parent: "100", nivel: 1, orden: 2 },
    { codigo: "130", nombre: "Oficina de Contratación", parent: "100", nivel: 1, orden: 3 },
    { codigo: "140", nombre: "Oficina de Gestión Social y Ambiental - GESA", parent: "100", nivel: 1, orden: 4 },
    { codigo: "200", nombre: "Secretaría General - SG", parent: "100", nivel: 1, orden: 5 },
    { codigo: "210", nombre: "Secretaría General - SG - Grupo Gestión Estratégica de Talento Humano", parent: "200", nivel: 2, orden: 6 },
    { codigo: "220", nombre: "Secretaría General - SG - Grupo Jurídico Administrativo y Servicio al Ciudadano", parent: "200", nivel: 2, orden: 7 },
    { codigo: "230", nombre: "Secretaría General - SG - Grupo Defensa Jurídica Integral", parent: "200", nivel: 2, orden: 8 },
    { codigo: "240", nombre: "Secretaría General - SG - Grupo Gestión Documental, Información y Archivo", parent: "200", nivel: 2, orden: 9 },
    { codigo: "300", nombre: "Control Disciplinario Interno - CDI", parent: "100", nivel: 1, orden: 10 },
    { codigo: "400", nombre: "Subdirección Ordenamiento y Planificación Integral del Territorio - SOPIT", parent: "100", nivel: 1, orden: 11 },
    { codigo: "410", nombre: "Subdirección Ordenamiento y Planificación Integral del Territorio - SOPIT - Grupo Gestión del Conocimiento para la Sostenibilidad", parent: "400", nivel: 2, orden: 12 },
    { codigo: "420", nombre: "Subdirección Ordenamiento y Planificación Integral del Territorio - SOPIT - Grupo Ordenamiento y Planificación Territorial", parent: "400", nivel: 2, orden: 13 },
    { codigo: "500", nombre: "Subdirección de Gestión Integral de la Oferta Ambiental - SUGOA", parent: "100", nivel: 1, orden: 14 },
    { codigo: "510", nombre: "Subdirección de Gestión Integral de la Oferta Ambiental - SUGOA - Grupo Gestión Sostenible de la Biodiversidad", parent: "500", nivel: 2, orden: 15 },
    { codigo: "520", nombre: "Subdirección de Gestión Integral de la Oferta Ambiental - SUGOA - Grupo Crecimiento Verde", parent: "500", nivel: 2, orden: 16 },
    { codigo: "600", nombre: "Subdirección de Riesgo y Seguridad Territorial - SURYT", parent: "100", nivel: 1, orden: 17 },
    { codigo: "610", nombre: "Subdirección de Riesgo y Seguridad Territorial - SURYT - Grupo Gestión del Riesgo", parent: "600", nivel: 2, orden: 18 },
    { codigo: "620", nombre: "Subdirección de Riesgo y Seguridad Territorial - SURYT - Grupo Seguridad Hídrica y Cambio Climático", parent: "600", nivel: 2, orden: 19 },
    { codigo: "700", nombre: "Subdirección de Evaluación y Control Ambiental - SEYCA", parent: "100", nivel: 1, orden: 20 },
    { codigo: "710", nombre: "Subdirección de Evaluación y Control Ambiental - SEYCA - Grupo Evaluación para la Sostenibilidad", parent: "700", nivel: 2, orden: 21 },
    { codigo: "720", nombre: "Subdirección de Evaluación y Control Ambiental - SEYCA - Grupo Seguimiento para la Sostenibilidad", parent: "700", nivel: 2, orden: 22 },
    { codigo: "730", nombre: "Subdirección de Evaluación y Control Ambiental - SEYCA - Grupo Élite Ambiental para la Sostenibilidad \"GEA\"", parent: "700", nivel: 2, orden: 23 },
    { codigo: "800", nombre: "Subdirección Administrativa y Financiera - SAF", parent: "100", nivel: 1, orden: 24 },
    { codigo: "810", nombre: "Subdirección Administrativa y Financiera - SAF - Grupo Gestión Presupuestal y Eficiencia del Gasto Público", parent: "800", nivel: 2, orden: 25 },
    { codigo: "820", nombre: "Subdirección Administrativa y Financiera - SAF - Grupo Tesorería y Cartera", parent: "800", nivel: 2, orden: 26 },
    { codigo: "830", nombre: "Subdirección Administrativa y Financiera - SAF - Grupo Gestión Recursos Físicos para la Sostenibilidad", parent: "800", nivel: 2, orden: 27 },
    { codigo: "840", nombre: "Subdirección Administrativa y Financiera - SAF - Grupo Gestión y Administración de Predios Institucionales", parent: "800", nivel: 2, orden: 28 },
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

  // Serie/subserie por defecto para poder radicar sin TRD cargada aún. Prisma
  // no admite `null` dentro de una clave compuesta como filtro de upsert, así
  // que se busca primero y se crea solo si falta.
  const serie =
    (await db.serieDocumental.findFirst({ where: { codigo: "SIN-CLASIF", version: "1", dependenciaId: null } })) ??
    (await db.serieDocumental.create({ data: { codigo: "SIN-CLASIF", nombre: "Sin clasificar (pendiente TRD)", version: "1" } }));
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
