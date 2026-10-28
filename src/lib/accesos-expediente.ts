import {
  puedeAccederContratacion,
  puedeAccederCorrespondencia,
  puedeCrearExpedienteContractual,
  puedeRadicar,
  type PermisosUsuario,
} from "@/lib/permisos";

export type ModuloAcceso = "GECON" | "TRAMITES" | "SGDEA";

export type EnlaceAcceso = { href: string; label: string };

export type AccesosRapidos = { nuevos: EnlaceAcceso[]; listados: EnlaceAcceso[]; propio?: EnlaceAcceso | null };

const SIN_ACCESOS: AccesosRapidos = { nuevos: [], listados: [] };

export function puedeCrearExpedienteTramite(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || [...permisos.tramites.values()].some((nivel) => nivel === "EDITAR");
}

export function accesosExpediente(permisos: PermisosUsuario, modulo: ModuloAcceso): AccesosRapidos {
  if (modulo === "GECON") {
    if (!puedeAccederContratacion(permisos)) return SIN_ACCESOS;
    return {
      nuevos: puedeCrearExpedienteContractual(permisos) ? [{ href: "/contratacion/expedientes/nuevo", label: "Nuevo expediente" }] : [],
      listados: [{ href: "/contratacion/expedientes", label: "Todos los expedientes" }],
      propio: { href: "/contratacion/expedientes?asignados=mi&vigencia=todas", label: "A mi cargo" },
    };
  }
  if (modulo === "TRAMITES") {
    if (!permisos.modulos.has("TRAMITES")) return SIN_ACCESOS;
    return {
      nuevos: puedeCrearExpedienteTramite(permisos) ? [{ href: "/tramites", label: "Nuevo trámite ambiental" }] : [],
      listados: [{ href: "/expedientes", label: "Todos los expedientes" }],
      propio: { href: "/expedientes?asignados=mi", label: "Asignados a mí" },
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
    listados: archivo ? [{ href: "/correspondencia/expedientes", label: "Todos los expedientes" }] : [],
    propio: archivo ? { href: "/correspondencia/flujos-a-cargo", label: "A mi cargo" } : null,
  };
}

const NOMBRE_MODULO: Record<ModuloAcceso, string> = { GECON: "GECON", TRAMITES: "Trámites 2.0", SGDEA: "SGDEA" };

export function accesosExpedienteTodos(permisos: PermisosUsuario): AccesosRapidos {
  const modulos: ModuloAcceso[] = ["TRAMITES", "GECON", "SGDEA"];
  const nuevos: EnlaceAcceso[] = [];
  const listados: EnlaceAcceso[] = [];
  for (const m of modulos) {
    const a = accesosExpediente(permisos, m);
    for (const n of a.nuevos) nuevos.push({ href: n.href, label: `${NOMBRE_MODULO[m]} · ${n.label}` });
    for (const l of a.listados) listados.push({ href: l.href, label: `Expedientes de ${NOMBRE_MODULO[m]}` });
  }
  return { nuevos, listados };
}

export function moduloDeRuta(ruta: string): ModuloAcceso | null {
  if (ruta.startsWith("/contratacion")) return "GECON";
  if (ruta.startsWith("/correspondencia")) return "SGDEA";
  if (ruta.startsWith("/tramites-ambientales")) return "TRAMITES";
  return null;
}
