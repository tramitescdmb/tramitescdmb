"use client";

import { Inbox, FileEdit } from "lucide-react";
import { BarraModulo, type GrupoMenu } from "@/components/BarraModulo";

export type ConteoMemorandos = { porResponder: number; vencidos: number; sinLeer: number };

export function MemorandosTabs({ conteo, puedeEnviar }: { conteo: ConteoMemorandos; puedeEnviar: boolean }) {
  const insignia =
    conteo.porResponder > 0
      ? {
          valor: conteo.porResponder,
          alerta: conteo.vencidos > 0,
          titulo: `${conteo.porResponder} memorando(s) por responder${conteo.vencidos > 0 ? `, ${conteo.vencidos} con plazo vencido` : ""}`,
        }
      : { valor: conteo.sinLeer, alerta: false, titulo: `${conteo.sinLeer} memorando(s) sin leer` };
  const grupos: GrupoMenu[] = [
    { label: "Bandeja", icon: Inbox, href: "/memorandos", insignia, coincide: /^\/memorandos(\/(?!nuevo)[^/]+)?$/ },
    ...(puedeEnviar ? [{ label: "Nuevo memorando", icon: FileEdit, href: "/memorandos/nuevo", coincide: /^\/memorandos\/nuevo/ }] : []),
  ];
  return <BarraModulo grupos={grupos} ariaLabel="Secciones de memorandos" />;
}
