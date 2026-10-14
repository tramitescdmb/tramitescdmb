"use client";

import { ListChecks, Briefcase, ChartColumn, ShieldAlert, Landmark } from "lucide-react";
import { CicloVistasNav, type NodoCiclo } from "@/components/CicloVistasNav";

export function PanelGeconNav({ gestion, contratos, pendientes }: { gestion: boolean; contratos: boolean; pendientes: number }) {
  const nodos: NodoCiclo[] = [
    { href: "/contratacion/panel", label: "Mi trabajo pendiente", desc: "Firmas e informes por atender", icon: ListChecks, insignia: pendientes },
    { href: "/contratacion/panel/expedientes", label: "Expedientes", desc: "Por etapa y más recientes", icon: Briefcase },
    { href: "/contratacion/panel/indicadores", label: "Indicadores", desc: "Tiempos, firmas y modalidades", icon: ChartColumn },
    ...(contratos ? [{ href: "/contratacion/panel/contratos", label: "Contratos y recursos", desc: "Valores, pagos y estados", icon: Landmark }] : []),
    ...(gestion ? [{ href: "/contratacion/panel/sistema", label: "Sistema", desc: "Actividad y registros", icon: ShieldAlert }] : []),
  ];
  return <CicloVistasNav nodos={nodos} rutaRaiz="/contratacion/panel" ariaLabel="Vistas del tablero de GECON" />;
}
