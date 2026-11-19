import { anioColombia } from "@/lib/fecha";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatearRadicado, generarConsecutivo } from "@/lib/radicado";
import { claveConcepto, SERIE_CONCEPTO } from "@/lib/concepto-tecnico";
import { formatearCodigoProceso } from "@/lib/codigo-proceso";
import { formatearNumeroMemorando, leerDatosMemorando, serieConsecutivoMemorando, siglaDependencia } from "@/lib/memorandos-formato";
import { formatearNumeroSigla, normalizarSigla, serieSigla, SIGLA_POR_PROCEDIMIENTO, siglaDeTramite } from "@/lib/siglas-tramite";

export type ModuloConsecutivo = "TRAMITES" | "PLANEADOR" | "GECON" | "SGDEA" | "MEMORANDOS";

export const ETIQUETA_MODULO_CONSECUTIVO: Record<ModuloConsecutivo, string> = {
  TRAMITES: "Trámites ambientales 2.0 — número de expediente (SIGLA-0000-año)",
  PLANEADOR: "Planeador — conceptos técnicos de visita",
  GECON: "GECON — contratación",
  SGDEA: "SGDEA — correspondencia y archivo",
  MEMORANDOS: "Memorandos — número por oficina (SIGLA – 000 /año)",
};

export type SerieConsecutivo = {
  serie: string;
  anio: number;
  modulo: ModuloConsecutivo;
  nombre: string;
  ejemplo: string;
  configurada: boolean;
  ultimoAsignado: number;
  ultimoUsado: number;
  registros: number;
  siguiente: number;
};

export function serieTramite(codigo: string): string {
  return `TRAMITE-${codigo}`;
}

export function formatearNumeroTramite(codigo: string, anio: number, numero: number): string {
  return `${codigo}-${anio}-${String(numero).padStart(4, "0")}`;
}

export function numeroFinal(valor: string, prefijo: string, sufijo = ""): number | null {
  if (!valor.startsWith(prefijo) || !valor.endsWith(sufijo)) return null;
  const medio = valor.slice(prefijo.length, valor.length - sufijo.length);
  return /^\d+$/.test(medio) ? Number(medio) : null;
}

export function validarSiguiente(siguiente: number, ultimoUsado: number): string | null {
  if (!Number.isInteger(siguiente) || siguiente < 1 || siguiente > 999_999) return "Indique un número entero entre 1 y 999999.";
  if (siguiente <= ultimoUsado) {
    return `Ya existe un registro con el número ${ultimoUsado} en esa vigencia; el siguiente debe ser ${ultimoUsado + 1} o mayor. Para empezar en 1, primero deben eliminarse los registros de prueba.`;
  }
  return null;
}

type Usados = { maximo: number; registros: number };

function contar(valores: (string | null)[], prefijo: string, sufijo = ""): Usados {
  let maximo = 0;
  let registros = 0;
  for (const v of valores) {
    const n = v ? numeroFinal(v, prefijo, sufijo) : null;
    if (n == null) continue;
    registros++;
    if (n > maximo) maximo = n;
  }
  return { maximo, registros };
}

type Definicion = { serie: string; modulo: ModuloConsecutivo; nombre: string; ejemplo: (n: number) => string; usados: () => Promise<Usados> };

async function definiciones(anio: number, seriesExistentes: string[]): Promise<Definicion[]> {
  const tipos = await db.tramiteTipo.findMany({ where: { activo: true }, select: { codigo: true, nombre: true, sigla: true }, orderBy: { codigo: "asc" } });
  const defs: Definicion[] = [];
  const porSigla = new Map<string, string[]>();
  for (const t of tipos) {
    const sigla = siglaDeTramite(t);
    if (sigla) {
      porSigla.set(sigla, [...(porSigla.get(sigla) ?? []), t.nombre]);
      continue;
    }
    defs.push({
      serie: serieTramite(t.codigo),
      modulo: "TRAMITES",
      nombre: t.nombre,
      ejemplo: (n) => formatearNumeroTramite(t.codigo, anio, n),
      usados: async () => {
        const prefijo = `${t.codigo}-${anio}-`;
        const filas = await db.expediente.findMany({ where: { numero: { startsWith: prefijo } }, select: { numero: true } });
        return contar(filas.map((f) => f.numero), prefijo);
      },
    });
  }
  for (const [sigla, nombres] of [...porSigla.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    defs.push({
      serie: serieSigla(sigla),
      modulo: "TRAMITES",
      nombre: `${sigla} · ${nombres.join(" · ")}`,
      ejemplo: (n) => formatearNumeroSigla(sigla, anio, n),
      usados: () => usadosSigla(sigla, anio),
    });
  }
  defs.push({
    serie: SERIE_CONCEPTO,
    modulo: "PLANEADOR",
    nombre: "Conceptos técnicos (EV)",
    ejemplo: (n) => claveConcepto(n, anio),
    usados: async () => {
      const filas = await db.visitaTecnica.findMany({ where: { conceptoNumero: { endsWith: `-${anio}` } }, select: { conceptoNumero: true } });
      return contar(filas.map((f) => f.conceptoNumero), "EV-", `-${anio}`);
    },
  });
  defs.push({
    serie: "CTO",
    modulo: "GECON",
    nombre: "Expediente interno contractual",
    ejemplo: (n) => formatearRadicado("CTO", anio, n),
    usados: async () => {
      const prefijo = `CDMB-CTO-${anio}-`;
      const filas = await db.expedienteContractual.findMany({ where: { numero: { startsWith: prefijo } }, select: { numero: true } });
      return contar(filas.map((f) => f.numero), prefijo);
    },
  });
  for (const serie of seriesExistentes.filter((s) => s.startsWith("PROC-"))) {
    const prefijo = serie.slice(5);
    defs.push({
      serie,
      modulo: "GECON",
      nombre: `Código de proceso ${prefijo}`,
      ejemplo: (n) => formatearCodigoProceso(prefijo, n, anio),
      usados: async () => {
        const filas = await db.expedienteContractual.findMany({ where: { codigoProceso: { startsWith: `${prefijo}-`, endsWith: `-${anio}` } }, select: { codigoProceso: true } });
        return contar(filas.map((f) => f.codigoProceso), `${prefijo}-`, `-${anio}`);
      },
    });
  }
  const sgdea: [string, string][] = [
    ["R", "Radicado de correspondencia recibida"],
    ["E", "Radicado de correspondencia enviada"],
    ["I", "Radicado de comunicación interna"],
  ];
  for (const [serie, nombre] of sgdea) {
    defs.push({
      serie,
      modulo: "SGDEA",
      nombre,
      ejemplo: (n) => formatearRadicado(serie, anio, n),
      usados: async () => {
        const prefijo = `CDMB-${serie}-${anio}-`;
        const filas = await db.comunicacion.findMany({ where: { radicado: { startsWith: prefijo } }, select: { radicado: true } });
        return contar(filas.map((f) => f.radicado), prefijo);
      },
    });
  }
  defs.push({
    serie: "X",
    modulo: "SGDEA",
    nombre: "Expediente documental del archivo",
    ejemplo: (n) => formatearRadicado("X", anio, n),
    usados: async () => {
      const prefijo = `CDMB-X-${anio}-`;
      const filas = await db.expedienteDocumental.findMany({ where: { numero: { startsWith: prefijo } }, select: { numero: true } });
      return contar(filas.map((f) => f.numero), prefijo);
    },
  });
  defs.push(...(await definicionesMemorandos(anio)));
  return defs;
}

/**
 * Número de memorando por oficina («ADEI – 054 /2026»), serie MEMO-<código de la dependencia>.
 * Usado: el número guardado en los memorandos del módulo y, para los firmados antes en el SGDEA, su
 * posición por orden de radicación (el mismo número que se les muestra).
 */
export function maximoMemorandos(filas: { datosMemorando: unknown }[]): Usados {
  let maximo = 0;
  filas.forEach((f, i) => {
    const n = leerDatosMemorando(f.datosMemorando)?.consecutivo ?? i + 1;
    if (n > maximo) maximo = n;
  });
  return { maximo, registros: filas.length };
}

async function definicionesMemorandos(anio: number): Promise<Definicion[]> {
  const deps = await db.dependencia.findMany({ where: { activo: true }, select: { id: true, nombre: true, codigo: true }, orderBy: { nombre: "asc" } });
  let porDependencia: Promise<Map<string, { datosMemorando: unknown }[]>> | null = null;
  const memorandosDelAnio = () =>
    (porDependencia ??= db.comunicacion
      .findMany({
        where: { tipo: "INTERNA", anio, dependenciaOrigenId: { not: null } },
        orderBy: [{ fechaRadicacion: "asc" }, { id: "asc" }],
        select: { dependenciaOrigenId: true, datosMemorando: true },
      })
      .then((filas) => {
        const m = new Map<string, { datosMemorando: unknown }[]>();
        for (const f of filas) m.set(f.dependenciaOrigenId!, [...(m.get(f.dependenciaOrigenId!) ?? []), f]);
        return m;
      }));
  return deps.map((d) => ({
    serie: serieConsecutivoMemorando(d.codigo),
    modulo: "MEMORANDOS" as const,
    nombre: d.nombre,
    ejemplo: (n: number) => formatearNumeroMemorando(siglaDependencia(d.nombre, d.codigo), n, anio),
    usados: async () => maximoMemorandos((await memorandosDelAnio()).get(d.id) ?? []),
  }));
}

export async function listarConsecutivos(anio: number): Promise<SerieConsecutivo[]> {
  const filas = await db.consecutivoRadicado.findMany({ where: { anio } });
  const porSerie = new Map(filas.map((f) => [f.serie, f.ultimoNumero]));
  const todas = await db.consecutivoRadicado.findMany({ select: { serie: true }, distinct: ["serie"] });
  const defs = await definiciones(anio, todas.map((t) => t.serie));
  return Promise.all(
    defs.map(async (d) => {
      const u = await d.usados();
      const configurada = porSerie.has(d.serie);
      const ultimoAsignado = porSerie.get(d.serie) ?? 0;
      const siguiente = Math.max(ultimoAsignado, u.maximo) + 1;
      return { serie: d.serie, anio, modulo: d.modulo, nombre: d.nombre, ejemplo: d.ejemplo(siguiente), configurada, ultimoAsignado, ultimoUsado: u.maximo, registros: u.registros, siguiente };
    })
  );
}

export async function fijarSiguienteConsecutivo(serie: string, anio: number, siguiente: number): Promise<void> {
  const todas = await db.consecutivoRadicado.findMany({ select: { serie: true }, distinct: ["serie"] });
  const def = (await definiciones(anio, [...todas.map((t) => t.serie), serie])).find((d) => d.serie === serie);
  if (!def) throw new Error("La serie indicada no existe.");
  const { maximo } = await def.usados();
  const error = validarSiguiente(siguiente, maximo);
  if (error) throw new Error(error);
  await db.consecutivoRadicado.upsert({
    where: { serie_anio: { serie, anio } },
    update: { ultimoNumero: siguiente - 1 },
    create: { serie, anio, ultimoNumero: siguiente - 1 },
  });
}

/**
 * Números con sigla ya usados en la vigencia: los expedientes de SIC y los que asignó SINCA
 * (sincronizados en SincaResolucion), para que la serie siga después del último de SINCA.
 */
export async function usadosSigla(sigla: string, anio: number): Promise<Usados & { sinca: number }> {
  const prefijo = `${sigla}-`;
  const sufijo = `-${anio}`;
  const filtro = { startsWith: prefijo, endsWith: sufijo };
  const [sic, sinca] = await Promise.all([
    db.expediente.findMany({ where: { numero: filtro }, select: { numero: true } }),
    db.sincaResolucion.findMany({ where: { expediente: filtro }, select: { expediente: true }, distinct: ["expediente"] }),
  ]);
  const a = contar(sic.map((f) => f.numero), prefijo, sufijo);
  const b = contar(sinca.map((f) => f.expediente), prefijo, sufijo);
  return { maximo: Math.max(a.maximo, b.maximo), registros: a.registros + b.registros, sinca: b.maximo };
}

async function asegurarSerie(serie: string, anio: number, maximo: () => Promise<number>): Promise<void> {
  const existe = await db.consecutivoRadicado.findUnique({ where: { serie_anio: { serie, anio } }, select: { id: true } });
  if (existe) return;
  try {
    await db.consecutivoRadicado.create({ data: { serie, anio, ultimoNumero: await maximo() } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
}

/**
 * Número de expediente para un trámite nuevo: SIGLA-0000-año cuando el trámite tiene sigla
 * (consecutivo compartido por sigla y vigencia); si no la tiene, el formato anterior
 * código-año-0000. Los expedientes ya radicados conservan su número.
 */
export async function generarNumeroTramite(codigo: string, anio: number = anioColombia()): Promise<string> {
  const tipo = await db.tramiteTipo.findUnique({ where: { codigo }, select: { codigo: true, sigla: true } });
  const sigla = siglaDeTramite(tipo ?? { codigo });
  if (sigla) {
    const serie = serieSigla(sigla);
    await asegurarSerie(serie, anio, async () => (await usadosSigla(sigla, anio)).maximo);
    for (let intento = 0; intento < 50; intento++) {
      const { numero } = await generarConsecutivo(serie, anio);
      const candidato = formatearNumeroSigla(sigla, anio, numero);
      const [enSic, enSinca] = await Promise.all([
        db.expediente.findUnique({ where: { numero: candidato }, select: { id: true } }),
        db.sincaResolucion.findFirst({ where: { expediente: candidato }, select: { nroSolicitud: true } }),
      ]);
      if (!enSic && !enSinca) return candidato;
    }
    throw new Error("No se pudo asignar el número del expediente.");
  }

  const serie = serieTramite(codigo);
  const prefijo = `${codigo}-${anio}-`;
  await asegurarSerie(serie, anio, async () => {
    const filas = await db.expediente.findMany({ where: { numero: { startsWith: prefijo } }, select: { numero: true } });
    return contar(filas.map((f) => f.numero), prefijo).maximo;
  });
  for (let intento = 0; intento < 20; intento++) {
    const { numero } = await generarConsecutivo(serie, anio);
    const candidato = formatearNumeroTramite(codigo, anio, numero);
    if (!(await db.expediente.findUnique({ where: { numero: candidato }, select: { id: true } }))) return candidato;
  }
  throw new Error("No se pudo asignar el número del expediente.");
}

export async function reiniciarSeriesSinRegistros(anio: number): Promise<number> {
  const libres = (await listarConsecutivos(anio)).filter((s) => s.serie !== SERIE_CONCEPTO && s.registros === 0 && (s.ultimoAsignado !== 0 || !s.configurada));
  for (const s of libres) {
    await db.consecutivoRadicado.upsert({
      where: { serie_anio: { serie: s.serie, anio } },
      update: { ultimoNumero: 0 },
      create: { serie: s.serie, anio, ultimoNumero: 0 },
    });
  }
  return libres.length;
}

export type SiglaTramite = { codigo: string; nombre: string; sigla: string | null; siglaGuardada: string | null; siglaPorDefecto: string | null };

export async function listarSiglasTramite(): Promise<SiglaTramite[]> {
  const tipos = await db.tramiteTipo.findMany({ where: { activo: true }, select: { codigo: true, nombre: true, sigla: true }, orderBy: { codigo: "asc" } });
  return tipos.map((t) => ({
    codigo: t.codigo,
    nombre: t.nombre,
    sigla: siglaDeTramite(t),
    siglaGuardada: normalizarSigla(t.sigla),
    siglaPorDefecto: SIGLA_POR_PROCEDIMIENTO[t.codigo] ?? null,
  }));
}

/** Guarda la sigla de un trámite; vacía vuelve a la sigla por defecto. Solo afecta a los expedientes nuevos. */
export async function fijarSiglaTramite(codigo: string, texto: string): Promise<string | null> {
  const limpio = texto.trim();
  const sigla = limpio ? normalizarSigla(limpio) : null;
  if (limpio && !sigla) throw new Error("La sigla debe tener de 2 a 4 letras, sin tildes ni números.");
  const tipo = await db.tramiteTipo.findUnique({ where: { codigo }, select: { id: true } });
  if (!tipo) throw new Error("El trámite indicado no existe.");
  await db.tramiteTipo.update({ where: { id: tipo.id }, data: { sigla } });
  return sigla ?? SIGLA_POR_PROCEDIMIENTO[codigo] ?? null;
}
