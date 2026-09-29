import { cargoDelFirmante, nivelFirma, ETIQUETA_NIVEL_FIRMA, type ModuloFirma, type PersonaFirmante, type NivelFirma } from "@/lib/jerarquia-firma";
import { ETIQUETA_CALIDAD_FIRMA, calidadDeSolicitud } from "@/lib/calidad-firma";

type Persona = PersonaFirmante & { id: string; nombre: string };

export type SolicitudPanel = {
  id: string;
  rol: "FIRMA" | "VISTO_BUENO" | "LECTURA";
  calidad: string | null;
  orden: number;
  estado: "PENDIENTE" | "COMPLETADA" | "RECHAZADA";
  completadoEn: Date | null;
  comentario?: string | null;
  usuarioAsignado: Persona;
};

export type FirmaPanel = {
  id: string;
  calidad: string | null;
  fechaHora: Date;
  usuario: Persona;
};

export type EstadoFilaFirma = "FIRMADO" | "VISTO_BUENO" | "TURNO" | "EN_ESPERA" | "RECHAZADO" | "LECTURA";

export type FilaFirmante = {
  id: string;
  usuarioId: string;
  nombre: string;
  cargo: string;
  nivel: NivelFirma;
  nivelEtiqueta: string;
  calidad: string;
  estado: EstadoFilaFirma;
  fecha: Date | null;
  comentario: string | null;
};

export const ETIQUETA_ESTADO_FILA: Record<EstadoFilaFirma, string> = {
  FIRMADO: "Firmado",
  VISTO_BUENO: "Visto bueno dado",
  TURNO: "Pendiente — es su turno",
  EN_ESPERA: "En espera de un cargo superior",
  RECHAZADO: "Rechazado",
  LECTURA: "Solo lectura",
};

export function construirFilasFirmantes(solicitudes: SolicitudPanel[], firmas: FirmaPanel[], modulo: ModuloFirma): FilaFirmante[] {
  const pendientesFirma = solicitudes.filter((s) => s.rol === "FIRMA" && s.estado === "PENDIENTE");
  const firmaPorUsuario = new Map(firmas.map((f) => [f.usuario.id, f]));
  const usados = new Set<string>();
  const filas: FilaFirmante[] = [];

  for (const s of solicitudes) {
    const u = s.usuarioAsignado;
    const nivel = nivelFirma(u);
    const firma = firmaPorUsuario.get(u.id);
    let estado: EstadoFilaFirma;
    if (s.rol === "LECTURA") estado = "LECTURA";
    else if (s.estado === "RECHAZADA") estado = "RECHAZADO";
    else if (s.estado === "COMPLETADA") estado = s.rol === "VISTO_BUENO" ? "VISTO_BUENO" : "FIRMADO";
    else estado = pendientesFirma.some((p) => p.orden < s.orden) ? "EN_ESPERA" : "TURNO";
    if (s.rol !== "LECTURA" && firma) usados.add(firma.id);
    filas.push({
      id: s.id,
      usuarioId: u.id,
      nombre: u.nombre,
      cargo: cargoDelFirmante(u, modulo),
      nivel,
      nivelEtiqueta: ETIQUETA_NIVEL_FIRMA[nivel],
      calidad: s.rol === "LECTURA" ? "Lectura" : ETIQUETA_CALIDAD_FIRMA[calidadDeSolicitud(s)],
      estado,
      fecha: s.estado === "COMPLETADA" ? (firma?.fechaHora ?? s.completadoEn) : s.estado === "RECHAZADA" ? s.completadoEn : null,
      comentario: s.estado === "RECHAZADA" ? (s.comentario ?? null) : null,
    });
  }

  for (const f of firmas) {
    if (usados.has(f.id) || filas.some((x) => x.usuarioId === f.usuario.id && x.estado === "FIRMADO")) continue;
    const nivel = nivelFirma(f.usuario);
    filas.push({
      id: f.id,
      usuarioId: f.usuario.id,
      nombre: f.usuario.nombre,
      cargo: cargoDelFirmante(f.usuario, modulo),
      nivel,
      nivelEtiqueta: ETIQUETA_NIVEL_FIRMA[nivel],
      calidad: ETIQUETA_CALIDAD_FIRMA[calidadDeSolicitud({ rol: "FIRMA", calidad: f.calidad })],
      estado: "FIRMADO",
      fecha: f.fechaHora,
      comentario: null,
    });
  }

  const peso: Record<EstadoFilaFirma, number> = { FIRMADO: 0, VISTO_BUENO: 0, TURNO: 0, EN_ESPERA: 0, RECHAZADO: 1, LECTURA: 2 };
  return filas.sort((a, b) => peso[a.estado] - peso[b.estado] || a.nivel - b.nivel || (a.fecha?.getTime() ?? Infinity) - (b.fecha?.getTime() ?? Infinity));
}
