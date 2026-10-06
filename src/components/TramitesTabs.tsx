"use client";

import { LayoutDashboard, LibraryBig, FolderOpen, Users, PenLine, Map, CalendarDays } from "lucide-react";
import { BarraModulo, type GrupoMenu } from "@/components/BarraModulo";
import { SIN_PENDIENTES_FIRMA, textoPendientesFirma, type ResumenPendientesFirma } from "@/lib/calidad-firma";

export function TramitesTabs({
  mostrarSolicitantes = true,
  mostrarFirmas = true,
  pendientesFirma = SIN_PENDIENTES_FIRMA,
}: {
  mostrarSolicitantes?: boolean;
  mostrarFirmas?: boolean;
  pendientesFirma?: ResumenPendientesFirma;
}) {
  const insigniaFirmas = {
    valor: pendientesFirma.total,
    alerta: pendientesFirma.listos > 0,
    titulo: textoPendientesFirma(pendientesFirma),
  };
  const grupos: GrupoMenu[] = [
    { label: "Panel", icon: LayoutDashboard, href: "/" },
    { label: "Catálogo de trámites", icon: LibraryBig, href: "/tramites" },
    {
      label: "Expedientes",
      icon: FolderOpen,
      items: [
        { href: "/expedientes", label: "Expedientes" },
        { href: "/expedientes?asignados=mi", label: "Asignados a mí" },
        { href: "/expedientes/disposicion", label: "Disposición final (TRD)", prefijo: true, separador: true },
      ],
    },
    { label: "Visor de trámites", icon: Map, href: "/visor-tramites" },
    { label: "Planeador", icon: CalendarDays, href: "/planeador" },
    ...(mostrarSolicitantes ? [{ label: "Solicitantes", icon: Users, href: "/solicitantes" }] : []),
    ...(mostrarFirmas
      ? [
          {
            label: "Firmas",
            icon: PenLine,
            insignia: insigniaFirmas,
            items: [
              { href: "/firmas/buzon", label: "Buzón de firmas", insignia: insigniaFirmas },
              { href: "/firmas/mis-firmas", label: "Mis firmas" },
              { href: "/firmas/rechazos", label: "Rechazos al firmar" },
            ],
          },
        ]
      : []),
  ];

  return (
    <BarraModulo
      grupos={grupos}
      ariaLabel="Trámites ambientales"
      esItemActivo={(it, pathname) => {
        const ruta = it.href.split("?")[0]!;
        if (ruta === "/expedientes") return pathname === "/expedientes" || /^\/expedientes\/(?!disposicion)[^/]+/.test(pathname);
        return pathname === ruta || pathname.startsWith(ruta + "/");
      }}
    />
  );
}
