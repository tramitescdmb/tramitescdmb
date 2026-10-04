"use client";

import { LayoutDashboard, ListOrdered, Sparkles, IdCard } from "lucide-react";
import { BarraModulo, type GrupoMenu } from "@/components/BarraModulo";
import { MigaModulo, type RutaMiga } from "@/components/MigaModulo";

const RUTAS: RutaMiga[] = [
  { re: /^\/historico\/solicitudes\/[^/]+/, trail: ["Solicitudes", "Solicitud"] },
  { re: /^\/historico\/solicitudes$/, trail: ["Solicitudes"] },
  { re: /^\/historico\/nits\/[^/]+/, trail: ["NIT / Terceros", "Tercero"] },
  { re: /^\/historico\/nits$/, trail: ["NIT / Terceros"] },
  { re: /^\/historico\/mineria/, trail: ["Minería de datos"] },
  { re: /^\/historico$/, trail: ["Dashboard"] },
];

const INICIO_GRUPO = { Solicitudes: "/historico/solicitudes", "NIT / Terceros": "/historico/nits" };

export function HistoricoTabs({ permitido }: { permitido: { base: boolean; dashboard: boolean; mineria: boolean } }) {
  const grupos: GrupoMenu[] = [
    ...(permitido.base
      ? [
          { label: "Solicitudes", icon: ListOrdered, href: "/historico/solicitudes" },
          { label: "NIT / Terceros", icon: IdCard, href: "/historico/nits" },
        ]
      : []),
    ...(permitido.dashboard ? [{ label: "Dashboard", icon: LayoutDashboard, href: "/historico", coincide: /^\/historico$/ }] : []),
    ...(permitido.mineria ? [{ label: "Minería de datos", icon: Sparkles, href: "/historico/mineria" }] : []),
  ];
  return (
    <>
      <BarraModulo grupos={grupos} ariaLabel="Secciones de SINCA 1.0" />
      <MigaModulo inicio={{ label: "SINCA 1.0", href: "/historico/solicitudes" }} inicioGrupo={INICIO_GRUPO} rutas={RUTAS} />
    </>
  );
}
