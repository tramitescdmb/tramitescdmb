import { FUNCIONALIDADES, type Accion, type Matriz } from "@/lib/perfiles-catalogo";

export type Excepcion = { funcionalidad: string; tipo: "CONCEDER" | "QUITAR"; acciones: Accion[]; motivo: string | null };

export type OrigenPermiso = { accion: Accion; perfiles: string[]; concedidaPorExcepcion: boolean; quitadaPorExcepcion: boolean };

export function permisosEfectivos(perfiles: { nombre: string; matriz: Matriz }[], excepciones: Excepcion[]): Record<string, OrigenPermiso[]> {
  const salida: Record<string, OrigenPermiso[]> = {};
  for (const f of FUNCIONALIDADES) {
    const filas: OrigenPermiso[] = [];
    for (const accion of f.acciones) {
      const desdePerfiles = perfiles.filter((p) => p.matriz[f.clave]?.includes(accion)).map((p) => p.nombre);
      const concedida = excepciones.some((e) => e.funcionalidad === f.clave && e.tipo === "CONCEDER" && e.acciones.includes(accion));
      const quitada = excepciones.some((e) => e.funcionalidad === f.clave && e.tipo === "QUITAR" && e.acciones.includes(accion));
      if (desdePerfiles.length > 0 || concedida || quitada) {
        filas.push({ accion, perfiles: desdePerfiles, concedidaPorExcepcion: concedida, quitadaPorExcepcion: quitada });
      }
    }
    if (filas.length > 0) salida[f.clave] = filas;
  }
  return salida;
}

export function tieneAccion(origen: OrigenPermiso): boolean {
  return !origen.quitadaPorExcepcion && (origen.perfiles.length > 0 || origen.concedidaPorExcepcion);
}
