"use client";

import { LayoutDashboard, Briefcase, Inbox, UserSquare2, ShieldCheck } from "lucide-react";
import { BarraModulo, type GrupoMenu, type ItemMenu } from "@/components/BarraModulo";

export type PermitidoContratacion = {
  administrar: boolean;
  verContratistas: boolean;
  soloAdministrador: boolean;
  gestion: boolean;
  administradorSistema: boolean;
};

const SOLO_ADMIN = "Solo administrador";
const ADMIN_O_JEFE = "Solo administrador o jefe de contratación";

const entrada = (ok: boolean, leyenda: string, it: ItemMenu): ItemMenu => (ok ? it : { ...it, bloqueadoPara: leyenda });

export function ContratacionTabs({
  permitido,
  pendientesFirma,
}: {
  permitido: PermitidoContratacion;
  pendientesFirma: { total: number; listos: number };
}) {
  const grupos: GrupoMenu[] = [
    { label: "Panel", icon: LayoutDashboard, href: "/contratacion/panel" },
    {
      label: "Expedientes",
      icon: Briefcase,
      items: [
        { href: "/contratacion/expedientes", label: "Expedientes contractuales" },
        entrada(permitido.administrar, ADMIN_O_JEFE, { href: "/contratacion/expedientes/nuevo", label: "Nuevo expediente" }),
      ],
    },
    permitido.verContratistas
      ? { label: "Contratistas", icon: UserSquare2, href: "/contratacion/contratistas" }
      : { label: "Contratistas", icon: UserSquare2, href: "/contratacion/contratistas", bloqueadoPara: ADMIN_O_JEFE },
    {
      label: "Firmas",
      icon: Inbox,
      items: [
        { href: "/contratacion/buzon", label: "Buzón de firmas" },
        { href: "/contratacion/mis-firmas", label: "Mis firmas" },
      ],
      insignia: {
        valor: pendientesFirma.total,
        alerta: pendientesFirma.listos > 0,
        titulo: `${pendientesFirma.total} pendientes por firmar${pendientesFirma.listos < pendientesFirma.total ? ` (${pendientesFirma.listos} ya puede(n) firmarse)` : ""}`,
      },
    },
    {
      label: "Administración",
      icon: ShieldCheck,
      lado: "derecha",
      items: [
        entrada(permitido.soloAdministrador, SOLO_ADMIN, { href: "/contratacion/catalogo", label: "Catálogo de requisitos", prefijo: true }),
        entrada(permitido.gestion, ADMIN_O_JEFE, { href: "/contratacion/bitacora", label: "Bitácora del SIGEC", prefijo: true, separador: true }),
        entrada(permitido.administradorSistema, SOLO_ADMIN, { href: "/usuarios", label: "Usuarios y roles", prefijo: true, externo: true }),
        entrada(permitido.gestion, ADMIN_O_JEFE, { href: "/contratacion/auditoria", label: "Auditoría de cuentas", prefijo: true }),
        entrada(permitido.gestion, ADMIN_O_JEFE, { href: "/contratacion/seguridad", label: "Seguridad (contraseñas, accesos)", prefijo: true }),
      ],
    },
  ];

  return <BarraModulo grupos={grupos} ariaLabel="Secciones de SIGEC" />;
}
