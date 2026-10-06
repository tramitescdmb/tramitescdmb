import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { formatearFecha } from "@/lib/fecha";
import { NOMBRE_TRAMITE_VITAL } from "@/lib/vital";
import { puntoDesdeCampos } from "@/lib/coordenadas-texto";
import { estadoDeCamposVital, municipioDeCamposVital } from "@/lib/vital-campos";
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

function puntoSinca(p: FilaSinca, lat: number, lon: number, municipio: string | null): PuntoExterno {
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
  };
}

export async function puntosSinca(): Promise<{ puntos: PuntoExterno[] }> {
  const conCoordenadas = await db.sincaResolucion.findMany({
    where: { lat: { not: null }, lon: { not: null } },
    orderBy: { fechaResolucion: "desc" },
    select: SELECT_SINCA,
  });
  return { puntos: conCoordenadas.map((p) => puntoSinca(p, p.lat!, p.lon!, p.municipio)) };
}

async function filasVital() {
  return db.solicitudVital.findMany({
    orderBy: { fechaRadicacion: "desc" },
    select: { id: true, idVital: true, idTramiteVital: true, nombreActividad: true, fechaRadicacion: true, camposTramite: true },
  });
}

function puntoVital(s: Awaited<ReturnType<typeof filasVital>>[number], lat: number, lon: number, municipio: string | null): PuntoExterno {
  return {
    clave: s.idVital,
    numero: s.idVital,
    tipo: tipoVital(s.idTramiteVital),
    detalle: s.nombreActividad ? recortar(s.nombreActividad, 140) : null,
    municipio,
    estado: estadoDeCamposVital(s.camposTramite),
    fecha: s.fechaRadicacion ? formatearFecha(s.fechaRadicacion) : null,
    lat,
    lon,
    enlace: `/vital/${s.id}`,
  };
}

export async function puntosVital(): Promise<{ puntos: PuntoExterno[] }> {
  const filas = await filasVital();
  return {
    puntos: filas.flatMap((s) => {
      const p = puntoDesdeCampos(s.camposTramite);
      return p ? [puntoVital(s, p.lat, p.lon, municipioDeCamposVital(s.camposTramite))] : [];
    }),
  };
}

export const ETIQUETA_CACHE_VISOR_VITAL = "visor-vital";

export const puntosSincaCacheado = unstable_cache(puntosSinca, ["visor-puntos-sinca"], { revalidate: 900, tags: ["sinca-analitica"] });

export const puntosVitalCacheado = unstable_cache(puntosVital, ["visor-puntos-vital"], { revalidate: 900, tags: [ETIQUETA_CACHE_VISOR_VITAL] });
