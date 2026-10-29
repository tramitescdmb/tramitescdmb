import { db } from "@/lib/db";

export type ProcesoProgramado = {
  clave: string;
  nombre: string;
  descripcion: string;
  horario: string;
  rutaManual?: string;
};

export const PROCESOS_PROGRAMADOS: ProcesoProgramado[] = [
  {
    clave: "sinca",
    nombre: "Sincronización con SINCA 1.0",
    descripcion: "Trae las resoluciones nuevas o modificadas del sistema anterior y actualiza las estadísticas por NIT.",
    horario: "Todos los días, 2:00 a. m.",
  },
  {
    clave: "vital",
    nombre: "Sincronización con VITAL",
    descripcion: "Consulta las solicitudes de los trámites de VITAL de los últimos 45 días y detecta trámites nuevos.",
    horario: "Todos los días, 2:30 a. m.",
  },
  {
    clave: "secop",
    nombre: "Sincronización con SECOP II",
    descripcion: "Actualiza el espejo de solo lectura de los procesos y contratos de la CDMB en SECOP II.",
    horario: "Todos los días, 3:00 a. m.",
  },
  {
    clave: "directorio",
    nombre: "Sincronización con el directorio activo",
    descripcion:
      "Lee el directorio completo y cruza a cada usuario por cédula, usuario de red o correo: actualiza sus datos, pasa al dominio las cuentas temporales cuya cédula ya existe y crea el usuario de los contratistas que ya están en la red.",
    horario: "Todos los días, 3:30 a. m.",
    rutaManual: "/api/usuarios/directorio/sincronizar",
  },
  {
    clave: "flujos-vencimientos",
    nombre: "Vencimientos de flujos de trabajo",
    descripcion:
      "Revisa los pasos de flujo en curso de todos los módulos: los vencidos quedan marcados para su responsable o avanzan solos por la salida configurada.",
    horario: "Todos los días, 6:00 a. m.",
    rutaManual: "/api/flujos/vencimientos",
  },
];

function resumirResultado(resultado: unknown): { ok: boolean; resumen: string } {
  const ok = typeof resultado === "object" && resultado !== null && "ok" in resultado ? Boolean((resultado as { ok: unknown }).ok) : true;
  let texto: string;
  try {
    texto = JSON.stringify(resultado);
  } catch {
    texto = String(resultado);
  }
  return { ok, resumen: texto.length > 1500 ? `${texto.slice(0, 1500)}…` : texto };
}

export async function registrarEjecucion<T>(clave: string, origen: "programado" | "manual", ejecutadoPorId: string | null, tarea: () => Promise<T>): Promise<T> {
  const ejecucion = await db.ejecucionProceso.create({ data: { proceso: clave, origen, ejecutadoPorId } }).catch(() => null);
  try {
    const resultado = await tarea();
    if (ejecucion) {
      const { ok, resumen } = resumirResultado(resultado);
      await db.ejecucionProceso.update({ where: { id: ejecucion.id }, data: { fin: new Date(), ok, resumen } }).catch(() => {});
    }
    return resultado;
  } catch (err) {
    if (ejecucion) {
      await db.ejecucionProceso
        .update({ where: { id: ejecucion.id }, data: { fin: new Date(), ok: false, resumen: err instanceof Error ? err.message : String(err) } })
        .catch(() => {});
    }
    throw err;
  }
}

export async function ultimasEjecuciones(porProceso = 10) {
  const filas = await db.ejecucionProceso.findMany({ orderBy: { inicio: "desc" }, take: 300 });
  const mapa = new Map<string, typeof filas>();
  for (const f of filas) {
    const lista = mapa.get(f.proceso) ?? [];
    if (lista.length < porProceso) lista.push(f);
    mapa.set(f.proceso, lista);
  }
  return mapa;
}
