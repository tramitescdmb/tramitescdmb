import { db } from "@/lib/db";
import {
  CLAVE_DISENO,
  definicionPlantilla,
  DISENO_PREDETERMINADO,
  envolverCorreo,
  escaparHtmlPlantilla,
  esClavePlantilla,
  fechaEnLetras,
  renderizarDiseno,
  renderizarPlantilla,
  type ClavePlantilla,
  type ContenidoPlantilla,
  type DisenoCorreo,
  type Valores,
} from "@/lib/plantillas-correo-base";
import type { Mensaje } from "@/lib/avisos-correo";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "PlantillaCorreo" (
    "clave" TEXT NOT NULL,
    "asunto" TEXT NOT NULL DEFAULT '',
    "titulo" TEXT NOT NULL DEFAULT '',
    "cuerpo" TEXT NOT NULL DEFAULT '',
    "boton" TEXT NOT NULL DEFAULT '',
    "pie" TEXT NOT NULL DEFAULT '',
    "actualizadoPor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlantillaCorreo_pkey" PRIMARY KEY ("clave")
  )`,
  `ALTER TABLE "PlantillaCorreo" ENABLE ROW LEVEL SECURITY`,
];

let tablaLista: Promise<void> | null = null;

export function asegurarTablaPlantillas(): Promise<void> {
  tablaLista ??= (async () => {
    const [fila] = await db.$queryRawUnsafe<{ existe: boolean }[]>(`SELECT to_regclass('public."PlantillaCorreo"') IS NOT NULL AS existe`);
    if (fila?.existe) return;
    for (const sql of DDL) await db.$executeRawUnsafe(sql);
  })().catch((err) => {
    tablaLista = null;
    throw err;
  });
  return tablaLista;
}

export type PlantillaGuardada = ContenidoPlantilla & { actualizadoPor: string | null; updatedAt: Date };

export type PlantillasVigentes = {
  personalizadas: Map<ClavePlantilla, PlantillaGuardada>;
  diseno: DisenoCorreo;
  disenoPersonalizado: { actualizadoPor: string | null; updatedAt: Date } | null;
};

export const SIN_PERSONALIZAR: PlantillasVigentes = { personalizadas: new Map(), diseno: DISENO_PREDETERMINADO, disenoPersonalizado: null };

export async function leerPlantillas(): Promise<PlantillasVigentes> {
  await asegurarTablaPlantillas();
  const filas = await db.plantillaCorreo.findMany();
  const personalizadas = new Map<ClavePlantilla, PlantillaGuardada>();
  let diseno = DISENO_PREDETERMINADO;
  let disenoPersonalizado: PlantillasVigentes["disenoPersonalizado"] = null;
  for (const f of filas) {
    if (f.clave === CLAVE_DISENO) {
      diseno = { antetitulo: f.titulo, encabezado: f.cuerpo, pie: f.pie };
      disenoPersonalizado = { actualizadoPor: f.actualizadoPor, updatedAt: f.updatedAt };
    } else if (esClavePlantilla(f.clave)) {
      personalizadas.set(f.clave, { asunto: f.asunto, titulo: f.titulo, cuerpo: f.cuerpo, boton: f.boton, actualizadoPor: f.actualizadoPor, updatedAt: f.updatedAt });
    }
  }
  return { personalizadas, diseno, disenoPersonalizado };
}

export async function cargarPlantillas(): Promise<PlantillasVigentes> {
  try {
    return await leerPlantillas();
  } catch (err) {
    console.error("No se pudieron leer las plantillas de correo; se usan las predeterminadas:", err);
    return SIN_PERSONALIZAR;
  }
}

export function valoresGlobales(base: string | null, ruta?: string): Valores {
  return {
    FECHA_HOY: fechaEnLetras(new Date()),
    URL_PLATAFORMA: base ?? "",
    ENLACE: base && ruta ? `${base}${ruta}` : "",
  };
}

export type Borrador = { plantilla?: { clave: ClavePlantilla; contenido: ContenidoPlantilla }; diseno?: DisenoCorreo };

function conBorrador(vigentes: PlantillasVigentes, borrador?: Borrador): PlantillasVigentes {
  if (!borrador) return vigentes;
  const personalizadas = new Map(vigentes.personalizadas);
  if (borrador.plantilla) personalizadas.set(borrador.plantilla.clave, { ...borrador.plantilla.contenido, actualizadoPor: null, updatedAt: new Date() });
  return { ...vigentes, personalizadas, diseno: borrador.diseno ?? vigentes.diseno };
}

export function aplicarPlantilla(m: Mensaje, vigentes: PlantillasVigentes, base: string | null): Mensaje {
  if (!m.plantilla) return m;
  const contenido = vigentes.personalizadas.get(m.plantilla.clave);
  if (!contenido) return m;
  const def = definicionPlantilla(m.plantilla.clave);
  const ruta = m.plantilla.ruta;
  const r = renderizarPlantilla(m.plantilla.clave, contenido, { ...m.plantilla.valores, ...valoresGlobales(base, ruta) });
  return {
    ...m,
    asunto: r.asunto || m.asunto,
    titulo: r.titulo || m.titulo,
    cuerpoHtml: r.cuerpoHtml,
    enlace: !def.sinEnlace && ruta && r.boton ? { texto: r.boton, ruta } : undefined,
  };
}

export function prepararCorreo(m: Mensaje, vigentes: PlantillasVigentes, base: string | null, nota = "", borrador?: Borrador): { asunto: string; html: string } {
  const v = conBorrador(vigentes, borrador);
  const final = aplicarPlantilla(m, v, base);
  const enlace = final.enlace && base ? { texto: final.enlace.texto, url: `${base}${final.enlace.ruta}` } : undefined;
  const diseno = renderizarDiseno(v.diseno, valoresGlobales(base, final.enlace?.ruta));
  return { asunto: final.asunto, html: envolverCorreo(escaparHtmlPlantilla(final.titulo), `${nota}${final.cuerpoHtml}`, enlace, diseno) };
}
