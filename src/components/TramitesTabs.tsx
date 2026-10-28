"use client";

import { LayoutDashboard, LibraryBig, FolderOpen, Users, PenLine, Map, CalendarDays, HelpCircle } from "lucide-react";
import { BarraModulo, type GrupoMenu } from "@/components/BarraModulo";
import { SIN_PENDIENTES_FIRMA, textoPendientesFirma, type ResumenPendientesFirma } from "@/lib/calidad-firma";

export function TramitesTabs({
  mostrarSolicitantes = true,
  mostrarFirmas = true,
  pendientesFirma = SIN_PENDIENTES_FIRMA,
  alertasPlaneador = 0,
  avisosBuzon = 0,
  rechazosFirma = 0,
  conceptos = 0,
  esAdmin = false,
  editaFormatos = false,
}: {
  mostrarSolicitantes?: boolean;
  mostrarFirmas?: boolean;
  pendientesFirma?: ResumenPendientesFirma;
  alertasPlaneador?: number;
  avisosBuzon?: number;
  rechazosFirma?: number;
  conceptos?: number;
  esAdmin?: boolean;
  editaFormatos?: boolean;
}) {
  const insigniaFirmas = {
    valor: pendientesFirma.total,
    alerta: pendientesFirma.listos > 0,
    titulo: textoPendientesFirma(pendientesFirma),
  };
  const grupos: GrupoMenu[] = [
    { label: "Panel", icon: LayoutDashboard, href: "/tramites-ambientales", coincide: /^\/tramites-ambientales$/ },
    { label: "Catálogo de trámites", icon: LibraryBig, href: "/tramites" },
    {
      label: "Expedientes",
      icon: FolderOpen,
      items: [
        { href: "/expedientes", label: "Expedientes" },
        { href: "/expedientes?asignados=mi", label: "Asignados a mí" },
        { href: "/expedientes/disposicion", label: "Disposición final (TRD)", prefijo: true, separador: true },
        ...(esAdmin ? [{ href: "/expedientes/clasificacion-trd", label: "Clasificación TRD", prefijo: true }] : []),
      ],
    },
    { label: "Visor de trámites", icon: Map, href: "/visor-tramites" },
    {
      label: "Planeador",
      icon: CalendarDays,
      insignia: {
        valor: alertasPlaneador + avisosBuzon + conceptos,
        alerta: alertasPlaneador + avisosBuzon + conceptos > 0,
        titulo: `${avisosBuzon} aviso(s) sin leer y ${alertasPlaneador} visita(s) suya(s) para hoy, mañana o pendientes de registrar`,
      },
      items: [
        {
          href: "/planeador",
          label: "Calendario",
          insignia: { valor: alertasPlaneador, alerta: alertasPlaneador > 0, titulo: `${alertasPlaneador} visita(s) suya(s) para hoy, mañana o pendientes de registrar` },
        },
        {
          href: "/planeador/buzon",
          label: "Buzón de visitas",
          insignia: { valor: avisosBuzon, alerta: avisosBuzon > 0, titulo: `${avisosBuzon} aviso(s) sin leer` },
        },
        {
          href: "/planeador/conceptos",
          label: "Conceptos en revisión",
          insignia: { valor: conceptos, alerta: conceptos > 0, titulo: `${conceptos} concepto(s) por revisar o devueltos para corrección` },
        },
        ...(editaFormatos
          ? [
              { href: "/planeador/formatos", label: "Formatos de visita", prefijo: true, separador: true },
              { href: "/planeador/actividades", label: "Actividades por paso", prefijo: true },
            ]
          : []),
      ],
    },
    ...(mostrarSolicitantes ? [{ label: "Solicitantes", icon: Users, href: "/solicitantes" }] : []),
    ...(mostrarFirmas
      ? [
          {
            label: "Firmas",
            icon: PenLine,
            insignia: { ...insigniaFirmas, valor: insigniaFirmas.valor + rechazosFirma, alerta: insigniaFirmas.alerta || rechazosFirma > 0 },
            items: [
              { href: "/firmas/buzon", label: "Buzón de firmas", insignia: insigniaFirmas },
              { href: "/firmas/mis-firmas", label: "Mis firmas" },
              {
                href: "/firmas/rechazos",
                label: "Rechazos al firmar",
                insignia: { valor: rechazosFirma, alerta: rechazosFirma > 0, titulo: `${rechazosFirma} firma(s) rechazada(s) de documentos que usted cargó o envió a firma` },
              },
            ],
          },
        ]
      : []),
    {
      label: "Ayuda",
      icon: HelpCircle,
      items: [
        { href: "/tramites-ambientales/ayuda", label: "Guía de referencia" },
        ...(esAdmin ? [{ href: "/tramites-ambientales/manual-demostracion", label: "Manual de demostración" }] : []),
      ],
    },
  ];

  return (
    <BarraModulo
      grupos={grupos}
      ariaLabel="Trámites ambientales"
      esItemActivo={(it, pathname) => {
        const ruta = it.href.split("?")[0]!;
        if (ruta === "/planeador") return pathname === "/planeador";
        if (ruta === "/expedientes") return pathname === "/expedientes" || /^\/expedientes\/(?!disposicion|clasificacion-trd)[^/]+/.test(pathname);
        return pathname === ruta || pathname.startsWith(ruta + "/");
      }}
    />
  );
}
