import {
  puedeAccederContratacion,
  puedeAccederCorrespondencia,
  puedeCrearExpedienteContractual,
  puedeRadicar,
  type PermisosUsuario,
} from "@/lib/permisos";

export type ModuloAcceso = "GECON" | "TRAMITES" | "SGDEA";

export type EnlaceAcceso = { href: string; label: string };

export type AccesosExpediente = { nuevos: EnlaceAcceso[]; listado: EnlaceAcceso | null };

export function puedeCrearExpedienteTramite(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || [...permisos.tramites.values()].some((nivel) => nivel === "EDITAR");
}

export function accesosExpediente(permisos: PermisosUsuario, modulo: ModuloAcceso): AccesosExpediente {
  if (modulo === "GECON") {
    if (!puedeAccederContratacion(permisos)) return { nuevos: [], listado: null };
    return {
      nuevos: puedeCrearExpedienteContractual(permisos) ? [{ href: "/contratacion/expedientes/nuevo", label: "Nuevo expediente" }] : [],
      listado: { href: "/contratacion/expedientes", label: "Todos los expedientes" },
    };
  }
  if (modulo === "TRAMITES") {
    if (!permisos.modulos.has("TRAMITES")) return { nuevos: [], listado: null };
    return {
      nuevos: puedeCrearExpedienteTramite(permisos) ? [{ href: "/tramites", label: "Nuevo trámite ambiental" }] : [],
      listado: { href: "/expedientes", label: "Todos los expedientes" },
    };
  }
  const archivo = puedeAccederCorrespondencia(permisos);
  const radica = puedeRadicar(permisos);
  return {
    nuevos: [
      ...(archivo ? [{ href: "/correspondencia/expedientes/nuevo", label: "Abrir expediente" }] : []),
      ...(radica
        ? [
            { href: "/correspondencia/nueva", label: "Radicar recibida" },
            { href: "/correspondencia/nueva/enviada", label: "Radicar enviada" },
          ]
        : []),
    ],
    listado: archivo ? { href: "/correspondencia/expedientes", label: "Todos los expedientes" } : null,
  };
}

const NOMBRE_MODULO: Record<ModuloAcceso, string> = { GECON: "GECON", TRAMITES: "Trámites 2.0", SGDEA: "SGDEA" };

export type AccesosRapidos = { nuevos: EnlaceAcceso[]; listados: EnlaceAcceso[] };

export function accesosDeModulo(a: AccesosExpediente): AccesosRapidos {
  return { nuevos: a.nuevos, listados: a.listado ? [a.listado] : [] };
}

export function accesosExpedienteTodos(permisos: PermisosUsuario): AccesosRapidos {
  const modulos: ModuloAcceso[] = ["TRAMITES", "GECON", "SGDEA"];
  const nuevos: EnlaceAcceso[] = [];
  const listados: EnlaceAcceso[] = [];
  for (const m of modulos) {
    const a = accesosExpediente(permisos, m);
    for (const n of a.nuevos) nuevos.push({ href: n.href, label: `${NOMBRE_MODULO[m]} · ${n.label}` });
    if (a.listado) listados.push({ href: a.listado.href, label: `Expedientes de ${NOMBRE_MODULO[m]}` });
  }
  return { nuevos, listados };
}

export function moduloDeRuta(ruta: string): ModuloAcceso | null {
  if (ruta.startsWith("/contratacion")) return "GECON";
  if (ruta.startsWith("/correspondencia")) return "SGDEA";
  if (ruta.startsWith("/tramites-ambientales")) return "TRAMITES";
  return null;
}
