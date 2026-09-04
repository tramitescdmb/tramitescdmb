import type { SincaNitListado } from "@/lib/sinca";

export type VinculacionNit = {
  nroSolicitud: number | null;
  fechaDesde: string;
  fechaHasta: string;
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

export function anioNit(v: string | null | undefined): number | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
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
export function agruparEntidadesNit(filas: SincaNitListado[], disponibles: Set<number>): EntidadNit[] {
  const mapa = new Map<string, EntidadNit>();
  for (const n of filas) {
    const clave = n.numero_nit != null ? String(n.numero_nit) : `sin-nit-${n.rn}`;
    const nroSolicitud = n.nrosolicitud_sol ? Number(n.nrosolicitud_sol) : null;
    const vinculacion: VinculacionNit = {
      nroSolicitud,
      fechaDesde: fechaNit(n.fechadesde_int),
      fechaHasta: fechaNit(n.fechahasta_int),
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
