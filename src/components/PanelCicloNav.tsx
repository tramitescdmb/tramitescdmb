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

export function PanelCicloNav({ esAdmin }: { esAdmin: boolean }) {
  return (
    <CicloVistasNav
      nodos={NODOS.filter((n) => !n.soloAdmin || esAdmin)}
      rutaRaiz="/correspondencia/panel"
      ariaLabel="Vistas del tablero"
    />
  );
}
