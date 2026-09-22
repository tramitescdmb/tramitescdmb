"use client";

import { ListChecks, Inbox, FolderOpen, ShieldAlert } from "lucide-react";
import { CicloVistasNav, type NodoCiclo } from "@/components/CicloVistasNav";

type Nodo = NodoCiclo & { soloAdmin?: boolean };

const NODOS: Nodo[] = [
  { href: "/correspondencia/panel", label: "Mi trabajo pendiente", desc: "Lo asignado a usted", icon: ListChecks },
  { href: "/correspondencia/panel/correspondencia", label: "Correspondencia", desc: "Recibidas, enviadas y memorandos", icon: Inbox },
  { href: "/correspondencia/panel/archivo", label: "Expedientes y archivo", desc: "Expedientes, TRD y transferencias", icon: FolderOpen },
  { href: "/correspondencia/panel/sistema", label: "Sistema", desc: "Incidencias y bitácora", icon: ShieldAlert, soloAdmin: true },
];

/**
 * Navegación circular del tablero del SGDEA: un anillo por vista, unidos como un
 * ciclo (círculo · línea · círculo). Reemplaza el scroll largo de secciones —
 * cada anillo lleva a su propia ruta, y solo se carga la vista que se abre.
 */
export function PanelCicloNav({ esAdmin }: { esAdmin: boolean }) {
  return (
    <CicloVistasNav
      nodos={NODOS.filter((n) => !n.soloAdmin || esAdmin)}
      rutaRaiz="/correspondencia/panel"
      ariaLabel="Vistas del tablero"
    />
  );
}
