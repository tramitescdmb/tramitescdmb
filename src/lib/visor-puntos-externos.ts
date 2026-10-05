import { db } from "@/lib/db";
import { formatearFecha } from "@/lib/fecha";
import { NOMBRE_TRAMITE_VITAL } from "@/lib/vital";
import { puntoDesdeCampos } from "@/lib/coordenadas-texto";
import { estadoDeCamposVital, municipioDeCamposVital } from "@/lib/vital-campos";
import { cabeceraDeMunicipio } from "@/lib/cabeceras-cdmb";
import type { PuntoExterno } from "@/lib/geovisor-capas-externas";

function recortar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

export const tipoSinca = (r: { tipoSolicitudNombre: string | null; tipoSolicitud: string | null }) => r.tipoSolicitudNombre ?? r.tipoSolicitud ?? "Sin tipo";
export const tipoVital = (idTramiteVital: number) => NOMBRE_TRAMITE_VITAL[idTramiteVital] ?? `Trámite ${idTramiteVital}`;

const SELECT_SINCA = {
  nroSolicitud: true,
  numeroResolucion: true,
  tipoSolicitudNombre: true,
  tipoSolicitud: true,
  proyecto: true,
  municipio: true,
  estado: true,
  fechaResolucion: true,
  lat: true,
  lon: true,
} as const;

type FilaSinca = {
  nroSolicitud: number;
  numeroResolucion: string | null;
  tipoSolicitudNombre: string | null;
  tipoSolicitud: string | null;
  proyecto: string;
  municipio: string | null;
  estado: string | null;
  fechaResolucion: Date | null;
};

function puntoSinca(p: FilaSinca, lat: number, lon: number, municipio: string | null, aproximado: boolean): PuntoExterno {
  return {
    clave: String(p.nroSolicitud),
    numero: p.numeroResolucion ? `Res. ${p.numeroResolucion}` : `Solicitud ${p.nroSolicitud}`,
    tipo: tipoSinca(p),
    detalle: p.proyecto ? recortar(p.proyecto, 140) : null,
    municipio,
    estado: p.estado,
    fecha: p.fechaResolucion ? formatearFecha(p.fechaResolucion) : null,
    lat,
    lon,
    enlace: `/historico/solicitudes/${p.nroSolicitud}`,
    ...(aproximado ? { aproximado: true } : {}),
  };
}

export async function puntosSinca(): Promise<{ puntos: PuntoExterno[]; ordenTipos: string[] }> {
  const [conCoordenadas, porTipo] = await Promise.all([
    db.sincaResolucion.findMany({ where: { lat: { not: null }, lon: { not: null } }, orderBy: { fechaResolucion: "desc" }, select: SELECT_SINCA }),
    db.sincaResolucion.groupBy({ by: ["tipoSolicitudNombre", "tipoSolicitud"], _count: true }),
  ]);
  const conteo = new Map<string, number>();
  for (const g of porTipo) conteo.set(tipoSinca(g), (conteo.get(tipoSinca(g)) ?? 0) + g._count);
  return {
    puntos: conCoordenadas.map((p) => puntoSinca(p, p.lat!, p.lon!, p.municipio, false)),
    ordenTipos: [...conteo.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
  };
}

export async function puntosSincaSinCoordenadas(): Promise<PuntoExterno[]> {
  const filas = await db.sincaResolucion.findMany({ where: { OR: [{ lat: null }, { lon: null }] }, select: SELECT_SINCA });
  return filas.flatMap((p) => {
    const cabecera = cabeceraDeMunicipio(p.municipio);
    return cabecera ? [puntoSinca(p, cabecera.lat, cabecera.lon, cabecera.municipio, true)] : [];
  });
}

async function filasVital() {
  return db.solicitudVital.findMany({
    orderBy: { fechaRadicacion: "desc" },
    select: { id: true, idVital: true, idTramiteVital: true, nombreActividad: true, solicitanteNombre: true, fechaRadicacion: true, camposTramite: true },
  });
}

function puntoVital(s: Awaited<ReturnType<typeof filasVital>>[number], lat: number, lon: number, municipio: string | null, aproximado: boolean): PuntoExterno {
  return {
    clave: s.idVital,
    numero: s.idVital,
    tipo: tipoVital(s.idTramiteVital),
    detalle: [s.nombreActividad, s.solicitanteNombre].filter(Boolean).join(" · ") || null,
    municipio,
    estado: estadoDeCamposVital(s.camposTramite),
    fecha: s.fechaRadicacion ? formatearFecha(s.fechaRadicacion) : null,
    lat,
    lon,
    enlace: `/vital/${s.id}`,
    ...(aproximado ? { aproximado: true } : {}),
  };
}

export async function puntosVital(): Promise<{ puntos: PuntoExterno[]; ordenTipos: string[] }> {
  const filas = await filasVital();
  const conteo = new Map<string, number>();
  for (const s of filas) conteo.set(tipoVital(s.idTramiteVital), (conteo.get(tipoVital(s.idTramiteVital)) ?? 0) + 1);
  return {
    puntos: filas.flatMap((s) => {
      const p = puntoDesdeCampos(s.camposTramite);
      return p ? [puntoVital(s, p.lat, p.lon, municipioDeCamposVital(s.camposTramite), false)] : [];
    }),
    ordenTipos: [...conteo.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
  };
}

export async function puntosVitalSinCoordenadas(): Promise<PuntoExterno[]> {
  const filas = await filasVital();
  return filas.flatMap((s) => {
    if (puntoDesdeCampos(s.camposTramite)) return [];
    const cabecera = cabeceraDeMunicipio(municipioDeCamposVital(s.camposTramite));
    return cabecera ? [puntoVital(s, cabecera.lat, cabecera.lon, cabecera.municipio, true)] : [];
  });
}
