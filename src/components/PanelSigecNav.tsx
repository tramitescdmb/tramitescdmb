"use client";

import { ListChecks, Briefcase, ChartColumn, ShieldAlert } from "lucide-react";
import { CicloVistasNav, type NodoCiclo } from "@/components/CicloVistasNav";

export function PanelSigecNav({ gestion, pendientes }: { gestion: boolean; pendientes: number }) {
  const nodos: NodoCiclo[] = [
    { href: "/contratacion/panel", label: "Mi trabajo pendiente", desc: "Firmas e informes por atender", icon: ListChecks, insignia: pendientes },
    { href: "/contratacion/panel/expedientes", label: "Expedientes", desc: "Por etapa y más recientes", icon: Briefcase },
    { href: "/contratacion/panel/indicadores", label: "Indicadores", desc: "Tiempos, firmas y modalidades", icon: ChartColumn },
    ...(gestion ? [{ href: "/contratacion/panel/sistema", label: "Sistema", desc: "Actividad y registros", icon: ShieldAlert }] : []),
  ];
  return <CicloVistasNav nodos={nodos} rutaRaiz="/contratacion/panel" ariaLabel="Vistas del tablero de SIGEC" />;
}
