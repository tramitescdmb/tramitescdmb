"use client";

import { Inbox, ListOrdered, LayoutDashboard } from "lucide-react";
import { BarraModulo, type GrupoMenu } from "@/components/BarraModulo";
import { MigaModulo, type RutaMiga } from "@/components/MigaModulo";

const RUTAS: RutaMiga[] = [
  { re: /^\/vital\/dashboard/, trail: ["Dashboard"] },
  { re: /^\/vital\/recientes/, trail: ["Recientes"] },
  { re: /^\/vital\/[^/]+/, trail: ["Solicitudes", "Solicitud"] },
  { re: /^\/vital$/, trail: ["Solicitudes"] },
];

export function VitalTabs({ permitido }: { permitido: { base: boolean; dashboard: boolean } }) {
  const grupos: GrupoMenu[] = [
    ...(permitido.base
      ? [
          { label: "Solicitudes", icon: ListOrdered, href: "/vital", coincide: /^\/vital(\/(?!dashboard|recientes)[^/]+)?$/ },
          { label: "Recientes", icon: Inbox, href: "/vital/recientes" },
        ]
      : []),
    ...(permitido.dashboard ? [{ label: "Dashboard", icon: LayoutDashboard, href: "/vital/dashboard" }] : []),
  ];
  return (
    <>
      <BarraModulo grupos={grupos} ariaLabel="Secciones de VITAL" />
      <MigaModulo inicio={{ label: "VITAL", href: "/vital" }} inicioGrupo={{ Solicitudes: "/vital" }} rutas={RUTAS} />
    </>
  );
}
