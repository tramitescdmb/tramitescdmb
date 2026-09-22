"use client";

import { Inbox, Settings2, FolderOpen, ShieldCheck, FileText, LayoutDashboard, Archive, PenLine } from "lucide-react";
import { BarraModulo, type GrupoMenu, type ItemMenu } from "@/components/BarraModulo";

type Permitido = {
  bandeja: boolean;
  expedientes: boolean;
  radicar: boolean;
  distribuir: boolean;
  admin: boolean;
  /** Usuarios, auditoría de cuentas y seguridad son de toda la aplicación: solo el administrador del sistema. */
  administradorSistema: boolean;
  fondoHistorico: boolean;
};

/** Rutas que NO son la bandeja aunque cuelguen de /correspondencia. */
const NO_BANDEJA = ["nueva", "admin", "panel", "plantillas", "disposicion", "expedientes", "reportes", "bitacora", "ayuda", "calendario-laboral", "fondo", "buzon"];
const esRutaBandeja = (p: string) =>
  p === "/correspondencia" ||
  (p.startsWith("/correspondencia/") && !NO_BANDEJA.some((s) => p.startsWith(`/correspondencia/${s}`)));

const SOLO_ADMIN = "Solo administrador";

/** Un ítem que requiere el permiso `admin` se muestra a todos, pero bloqueado para quien no lo tiene. */
const paraAdmin = (permitido: Permitido, it: ItemMenu): ItemMenu => (permitido.admin ? it : { ...it, bloqueadoPara: SOLO_ADMIN });
const paraAdminSistema = (permitido: Permitido, it: ItemMenu): ItemMenu => (permitido.administradorSistema ? it : { ...it, bloqueadoPara: SOLO_ADMIN });

export function CorrespondenciaTabs({ permitido }: { permitido: Permitido }) {
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
    permitido.expedientes
      ? {
          label: "Expedientes y archivo",
          icon: FolderOpen,
          items: [
            { href: "/correspondencia/expedientes", label: "Expedientes documentales", prefijo: true },
            { href: "/correspondencia/expedientes/nuevo", label: "Abrir expediente" },
            paraAdmin(permitido, { href: "/correspondencia/disposicion", label: "Disposición final", prefijo: true }),
          ],
        }
      : null,
    { label: "Buzón de firmas", icon: PenLine, href: "/correspondencia/buzon" },
    { label: "Plantillas", icon: FileText, href: "/correspondencia/plantillas" },
    permitido.fondoHistorico ? { label: "Fondo histórico", icon: Archive, href: "/correspondencia/fondo" } : null,
    {
      label: "Configuración",
      icon: Settings2,
      alinearDerecha: true,
      items: [
        { href: "/correspondencia/admin", label: "Dependencias y TRD" },
        { href: "/correspondencia/admin/flujos", label: "Flujos de trabajo", prefijo: true },
        { href: "/correspondencia/admin/metadatos", label: "Campos de metadato", prefijo: true },
        { href: "/correspondencia/admin/vocabulario", label: "Vocabulario controlado", prefijo: true },
        { href: "/correspondencia/calendario-laboral", label: "Calendario laboral", prefijo: true },
      ].map((it) => paraAdmin(permitido, it)),
    },
    {
      // MoReq cap. 6 (Control y Seguridad): usuarios, roles, contraseñas y auditoría son
      // parte del SGDEA. Hoy comparten pantalla con el resto de la app.
      label: "Administración",
      icon: ShieldCheck,
      items: [
        paraAdmin(permitido, { href: "/correspondencia/bitacora", label: "Bitácora del SGDEA" }),
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
