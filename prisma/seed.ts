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
  pasos: PasoJson[];
};

type DocumentoRequeridoJson = {
  orden: number;
  nombre: string;
  obligatorio: boolean;
  notas: string | null;
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
  alcance: string;
  autoridadResponsabilidad: string;
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
        alcance: t.alcance,
        autoridadResponsabilidad: t.autoridadResponsabilidad,
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
        alcance: t.alcance,
        autoridadResponsabilidad: t.autoridadResponsabilidad,
      },
    });

    // Reset children para poder re-sembrar de forma idempotente
    await db.documentoRequeridoDefinicion.deleteMany({ where: { tramiteTipoId: tramite.id } });
    await db.pasoDefinicion.deleteMany({ where: { flujo: { tramiteTipoId: tramite.id } } });
    await db.flujo.deleteMany({ where: { tramiteTipoId: tramite.id } });

    if (t.documentosRequeridos?.length) {
      await db.documentoRequeridoDefinicion.createMany({
        data: t.documentosRequeridos.map((d) => ({
          tramiteTipoId: tramite.id,
          orden: d.orden,
          nombre: d.nombre,
          obligatorio: d.obligatorio,
          notas: d.notas,
        })),
      });
    }

    for (let i = 0; i < t.flujos.length; i++) {
      const f = t.flujos[i];
      const flujo = await db.flujo.create({
        data: {
          tramiteTipoId: tramite.id,
          codigo: f.codigo,
          nombre: f.nombre,
          esFlujoInicial: f.esFlujoInicial,
          orden: i,
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

async function main() {
  await seedTramites();
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
