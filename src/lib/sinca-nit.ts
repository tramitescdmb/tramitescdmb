import type { SincaNitListado, SincaNitColumna } from "@/lib/sinca";
import type { RangoPeriodo } from "@/lib/periodo-dashboard";
import { FUERA_DE_JURISDICCION, esMunicipioValido } from "@/lib/municipios";

export const REGIMENES_NIT = ["Responsable de Iva", "No responsable de Iva", "Otro"] as const;

/**
 * Opciones de orden que se muestran en /historico/nits — subconjunto de las columnas que el API
 * realmente admite (`SINCA_NIT_COLUMNAS` en sinca.ts), acotado a las que corresponden a algo
 * visible en la tabla agrupada por tercero (nombre, NIT, tipo). "vinculadas" no es una columna
 * del API: es un orden calculado aquí mismo, sobre la cantidad de solicitudes con detalle.
 */
export const OPCIONES_ORDEN_NIT = [
  { value: "nombre_nit" as SincaNitColumna, label: "Nombre / razón social" },
  { value: "numero_nit" as SincaNitColumna, label: "Número de NIT" },
  { value: "tipo_id_nit" as SincaNitColumna, label: "Tipo de identificación" },
  { value: "vinculadas" as const, label: "Vinculadas (cantidad)" },
] as const;

export type VinculacionNit = {
  nroSolicitud: number | null;
  fechaDesde: string;
  fechaHasta: string;
  /** ISO 8601, para filtrar por período — el snapshot pasa por JSON (DB), así que no se puede
   * guardar un Date real (se serializa a string de todos modos); se compara reconstruyendo el
   * Date en el momento del filtro, nunca confiando en que este campo siga siendo un Date. */
  fechaDesdeIso: string | null;
  tieneDetalle: boolean;
};

export type EntidadNit = {
  clave: string;
  numeroNit: number | null;
  identificacion: string;
  nombre: string;
  tipoLabel: string | null;
  tipoValue: "N" | "C" | null;
  regimen: string | null;
  granContribuyente: string | null;
  autorretenedor: string | null;
  direccion: string | null;
  telefono: string | null;
  celular: string | null;
  correo: string | null;
  municipio: string | null;
  departamento: string | null;
  actualizado: string | null;
  actualizadoPor: string | null;
  vinculaciones: VinculacionNit[];
};

export function texto(v: string | null | undefined): string {
  return v?.trim() || "";
}

export function nombreNit(n: SincaNitListado): string {
  return (
    texto(n.razon_soc_nit) ||
    [n.primer_nom_nit, n.segundo_nom_nit, n.primer_ape_nit, n.segundo_ape_nit].map(texto).filter(Boolean).join(" ") ||
    texto(n.nombre_nit) ||
    "—"
  );
}

export function identificacionNit(n: SincaNitListado): string {
  if (!n.numero_nit) return "—";
  const dv = n.digito_nit != null && n.digito_nit !== "" ? `-${n.digito_nit}` : "";
  return `${n.numero_nit}${dv}`;
}

export function fechaNit(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

/** Normaliza "YYYY-MM-DD HH:mm:ss" (formato del API) a ISO 8601, para poder comparar por rango. */
export function fechaIsoNit(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * SINCA 1.0 devuelve etiquetas corruptas en gran contribuyente/autorretenedor
 * ("no se D", "no lo se D"...) en vez de Sí/No — mostrar eso tal cual
 * confundiría más de lo que informa, así que solo se muestra cuando la
 * etiqueta es reconocible; si no, se omite el campo.
 */
export function siNoLimpio(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const label = (e as { label?: string | null }).label?.trim().toUpperCase();
  if (label === "SI" || label === "SÍ") return "Sí";
  if (label === "NO") return "No";
  return null;
}

/**
 * Agrupa filas planas de `/presinca/nit` (una por vinculación NIT↔solicitud)
 * en una entidad por tercero, con todas sus vinculaciones adentro.
 * `disponibles`: nroSolicitud que sí tienen detalle en el espejo local — pasar
 * un Set vacío si esa pantalla no va a enlazar solicitudes individuales.
 */
export function contarVinculadas(e: EntidadNit): number {
  return e.vinculaciones.filter((v) => v.tieneDetalle).length;
}

export function agruparEntidadesNit(filas: SincaNitListado[], disponibles: Set<number>): EntidadNit[] {
  const mapa = new Map<string, EntidadNit>();
  for (const n of filas) {
    const clave = n.numero_nit != null ? String(n.numero_nit) : `sin-nit-${n.rn}`;
    const nroSolicitud = n.nrosolicitud_sol ? Number(n.nrosolicitud_sol) : null;
    const vinculacion: VinculacionNit = {
      nroSolicitud,
      fechaDesde: fechaNit(n.fechadesde_int),
      fechaHasta: fechaNit(n.fechahasta_int),
      fechaDesdeIso: fechaIsoNit(n.fechadesde_int),
      tieneDetalle: nroSolicitud != null && disponibles.has(nroSolicitud),
    };
    const existente = mapa.get(clave);
    if (existente) {
      existente.vinculaciones.push(vinculacion);
      continue;
    }
    mapa.set(clave, {
      clave,
      numeroNit: n.numero_nit != null ? Number(n.numero_nit) : null,
      identificacion: identificacionNit(n),
      nombre: nombreNit(n),
      tipoLabel: n.tipo_nit?.label ?? null,
      tipoValue: n.tipo_nit?.value === "C" ? "C" : n.tipo_nit?.value === "N" ? "N" : null,
      regimen: n.regimen_nit?.label ?? null,
      granContribuyente: siNoLimpio(n.gcontri_nit),
      autorretenedor: siNoLimpio(n.autoret_nit),
      direccion: texto(n.direcc_nit) || null,
      telefono: texto(n.telef_nit) || null,
      celular: texto(n.celular_nit) || null,
      correo: texto(n.correo_nit) || null,
      municipio: texto(n.municipio) || null,
      departamento: texto(n.departamento) || null,
      actualizado: fechaNit(n.fechaact_nit) || null,
      actualizadoPor: texto(n.usuarioact_nit) || null,
      vinculaciones: [vinculacion],
    });
  }
  return [...mapa.values()];
}

export type FiltrosBrutosNit = {
  q?: string;
  municipio?: string;
  tipo?: string;
  regimen?: string;
  vinculadas?: string;
  orden?: string;
  dir?: string;
};

export type FiltrosNit = {
  q?: string;
  municipio?: string;
  tipo?: "N" | "C";
  regimen?: string;
  vinculacion?: "con" | "sin";
  orden: string;
  direccion: "ASC" | "DESC";
};

const ORDENES_VALIDOS_NIT = new Set(OPCIONES_ORDEN_NIT.map((o) => o.value as string));

/**
 * Interpreta los parámetros crudos de la URL — usada tanto por /historico/nits como por su
 * exportación a CSV, para que ambas apliquen exactamente los mismos filtros sin duplicar la
 * lógica (y sin que se puedan desincronizar en un cambio futuro).
 */
export function procesarFiltrosNit(filtros: FiltrosBrutosNit): FiltrosNit {
  const q = filtros.q?.trim() || undefined;
  const municipio = filtros.municipio?.trim() || undefined;
  const tipo = filtros.tipo === "N" || filtros.tipo === "C" ? filtros.tipo : undefined;
  const regimen = filtros.regimen && (REGIMENES_NIT as readonly string[]).includes(filtros.regimen) ? filtros.regimen : undefined;
  // "1" = con al menos una vinculación, "0" = sin ninguna (candidatos a revisar para depurar).
  const vinculacion = filtros.vinculadas === "1" ? ("con" as const) : filtros.vinculadas === "0" ? ("sin" as const) : undefined;
  // Si no se eligió un orden explícito y se filtró "con vinculación", el orden por defecto pasa a
  // ser esa cantidad descendente (el que más tiene, primero) — para "sin vinculación" no aplica
  // (ahí todos quedan en 0), así que se deja el orden normal.
  const orden = filtros.orden && ORDENES_VALIDOS_NIT.has(filtros.orden) ? filtros.orden : vinculacion === "con" ? "vinculadas" : "nombre_nit";
  const direccion: "ASC" | "DESC" = filtros.dir ? (filtros.dir === "DESC" ? "DESC" : "ASC") : orden === "vinculadas" ? "DESC" : "ASC";
  return { q, municipio, tipo, regimen, vinculacion, orden, direccion };
}

/** Aplica los filtros ya interpretados (`procesarFiltrosNit`) + el período sobre el snapshot completo. */
export function filtrarYOrdenarEntidadesNit(entidadesIn: EntidadNit[], f: FiltrosNit, rango: RangoPeriodo): EntidadNit[] {
  let entidades = entidadesIn;

  if (f.q) {
    const qNorm = f.q.toUpperCase();
    entidades = entidades.filter((e) => e.nombre.toUpperCase().includes(qNorm) || e.identificacion.toUpperCase().includes(qNorm));
  }
  if (rango) {
    entidades = entidades.filter((e) =>
      e.vinculaciones.some((v) => {
        if (!v.fechaDesdeIso) return false;
        const t = new Date(v.fechaDesdeIso).getTime();
        return t >= rango.desde.getTime() && t < rango.hasta.getTime();
      })
    );
  }
  if (f.municipio) {
    const municipio = f.municipio;
    entidades = entidades.filter((e) =>
      municipio === FUERA_DE_JURISDICCION ? !esMunicipioValido(e.municipio ?? "") : e.municipio === municipio
    );
  }
  if (f.tipo) entidades = entidades.filter((e) => e.tipoValue === f.tipo);
  if (f.regimen) entidades = entidades.filter((e) => e.regimen === f.regimen);
  if (f.vinculacion === "con") entidades = entidades.filter((e) => contarVinculadas(e) > 0);
  if (f.vinculacion === "sin") entidades = entidades.filter((e) => contarVinculadas(e) === 0);

  const dirFactor = f.direccion === "DESC" ? -1 : 1;
  return [...entidades].sort((a, b) => {
    if (f.orden === "vinculadas") return dirFactor * (contarVinculadas(a) - contarVinculadas(b));
    if (f.orden === "numero_nit") return dirFactor * ((a.numeroNit ?? 0) - (b.numeroNit ?? 0));
    if (f.orden === "tipo_id_nit") return dirFactor * (a.tipoValue ?? "").localeCompare(b.tipoValue ?? "");
    return dirFactor * a.nombre.localeCompare(b.nombre, "es");
  });
}
