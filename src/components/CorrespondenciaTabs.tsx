"use client";

import { Inbox, Settings2, FolderOpen, FileText, LayoutDashboard, PenLine, Contact } from "lucide-react";
import { BarraModulo, type GrupoMenu, type ItemMenu } from "@/components/BarraModulo";
import { textoPendientesFirma, type ResumenPendientesFirma } from "@/lib/calidad-firma";

type Permitido = {
  bandeja: boolean;
  expedientes: boolean;
  radicar: boolean;
  distribuir: boolean;
  admin: boolean;
  administradorSistema: boolean;
  fondoHistorico: boolean;
};

const NO_BANDEJA = [
  "nueva", "admin", "panel", "plantillas", "disposicion", "expedientes", "reportes",
  "bitacora", "ayuda", "calendario-laboral", "fondo", "buzon", "mis-firmas", "rechazos", "matriz-moreq", "manual-demostracion", "terceros",
];
const esRutaBandeja = (p: string) =>
  p === "/correspondencia" ||
  (p.startsWith("/correspondencia/") && !NO_BANDEJA.some((s) => p.startsWith(`/correspondencia/${s}`)));

const SOLO_ADMIN = "Solo administrador";

const paraAdmin = (permitido: Permitido, it: ItemMenu): ItemMenu => (permitido.admin ? it : { ...it, bloqueadoPara: SOLO_ADMIN });
const paraAdminSistema = (permitido: Permitido, it: ItemMenu): ItemMenu => (permitido.administradorSistema ? it : { ...it, bloqueadoPara: SOLO_ADMIN });

export function CorrespondenciaTabs({ permitido, pendientesFirma }: { permitido: Permitido; pendientesFirma: ResumenPendientesFirma }) {
  const insigniaFirmas = {
    valor: pendientesFirma.total,
    alerta: pendientesFirma.listos > 0,
    titulo: textoPendientesFirma(pendientesFirma),
  };
  const grupos: (GrupoMenu | null)[] = [
    { label: "Panel", icon: LayoutDashboard, href: "/correspondencia/panel" },
    {
      label: "Correspondencia",
      icon: Inbox,
      items: [
        { href: "/correspondencia", label: "Bandeja de radicados" },
        ...(permitido.radicar
          ? [
              { href: "/correspondencia/nueva", label: "Radicar recibida" },
              { href: "/correspondencia/nueva/enviada", label: "Radicar enviada" },
              { href: "/correspondencia/nueva/interna", label: "Radicar memorando" },
            ]
          : []),
        ...(permitido.distribuir ? [{ href: "/correspondencia?tipo=RECIBIDA&estado=EN_REPARTO", label: "Distribución y reparto" }] : []),
      ],
    },
    {
      label: "Firmas",
      icon: PenLine,
      items: [
        { href: "/correspondencia/buzon", label: "Buzón de firmas", insignia: insigniaFirmas },
        { href: "/correspondencia/mis-firmas", label: "Mis firmas" },
        { href: "/correspondencia/rechazos", label: "Rechazos al firmar" },
      ],
      insignia: insigniaFirmas,
    },
    permitido.expedientes || permitido.fondoHistorico
      ? {
          label: "Expedientes y archivo",
          icon: FolderOpen,
          items: [
            ...(permitido.expedientes
              ? [
                  { href: "/correspondencia/expedientes", label: "Expedientes documentales", prefijo: true },
                  { href: "/correspondencia/expedientes/nuevo", label: "Abrir expediente" },
                  paraAdmin(permitido, { href: "/correspondencia/disposicion", label: "Disposición final", prefijo: true }),
                ]
              : []),
            ...(permitido.fondoHistorico
              ? [{ href: "/correspondencia/fondo", label: "Fondo histórico (consulta)", prefijo: true, separador: permitido.expedientes }]
              : []),
          ],
        }
      : null,
    { label: "Terceros", icon: Contact, href: "/correspondencia/terceros", coincide: /^\/correspondencia\/terceros/ },
    { label: "Plantillas", icon: FileText, href: "/correspondencia/plantillas" },
    {
      label: "Administración",
      icon: Settings2,
      lado: "derecha",
      items: [
        paraAdmin(permitido, { href: "/correspondencia/admin", label: "Dependencias y TRD" }),
        paraAdmin(permitido, { href: "/correspondencia/admin/flujos", label: "Flujos de trabajo", prefijo: true }),
        paraAdmin(permitido, { href: "/correspondencia/admin/metadatos", label: "Campos de metadato", prefijo: true }),
        paraAdmin(permitido, { href: "/correspondencia/admin/vocabulario", label: "Vocabulario controlado", prefijo: true }),
        paraAdmin(permitido, { href: "/correspondencia/calendario-laboral", label: "Calendario laboral", prefijo: true }),
        paraAdmin(permitido, { href: "/correspondencia/bitacora", label: "Bitácora del SGDEA", separador: true }),
        { href: "/correspondencia/matriz-moreq", label: "Matriz de cumplimiento MoReq" },
        { href: "/correspondencia/manual-demostracion", label: "Manual de demostración" },
        paraAdminSistema(permitido, { href: "/usuarios", label: "Usuarios y roles", prefijo: true, externo: true }),
        paraAdminSistema(permitido, { href: "/auditoria", label: "Auditoría de cuentas", prefijo: true, externo: true }),
        paraAdminSistema(permitido, { href: "/admin/seguridad", label: "Seguridad (contraseñas, accesos)", prefijo: true, externo: true }),
      ],
    },
  ];

  return (
    <BarraModulo
      grupos={grupos.filter((g): g is GrupoMenu => g !== null)}
      ariaLabel="Secciones del SGDEA"
      esItemActivo={(it, pathname) => {
        const ruta = it.href.split("?")[0]!;
        if (ruta === "/correspondencia") return esRutaBandeja(pathname);
        return it.prefijo ? pathname === ruta || pathname.startsWith(ruta + "/") : pathname === ruta;
      }}
    />
  );
}
