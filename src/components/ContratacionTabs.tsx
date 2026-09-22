"use client";

import { LayoutDashboard, Briefcase, Inbox, UserSquare2, ShieldCheck } from "lucide-react";
import { BarraModulo, type GrupoMenu, type ItemMenu } from "@/components/BarraModulo";

export type PermitidoContratacion = {
  /** Crear expedientes y gestionar contratistas: Administrador o Jefe de Contratación. */
  administrar: boolean;
  verContratistas: boolean;
  /** Catálogo de requisitos: solo el Administrador de Contratación. */
  soloAdministrador: boolean;
  /** Bitácora, Seguridad y Auditoría: Administrador o Jefe de Contratación. */
  gestion: boolean;
  /** Usuarios y roles: solo el administrador del sistema. */
  administradorSistema: boolean;
};

const SOLO_ADMIN = "Solo administrador";
const ADMIN_O_JEFE = "Solo administrador o jefe de contratación";

/** Una entrada que el usuario no puede usar se muestra igual, bloqueada y con la leyenda de quién sí. */
const entrada = (ok: boolean, leyenda: string, it: ItemMenu): ItemMenu => (ok ? it : { ...it, bloqueadoPara: leyenda });

export function ContratacionTabs({
  permitido,
  pendientesFirma,
}: {
  permitido: PermitidoContratacion;
  /** Documentos que esperan la firma o el visto bueno del usuario — se muestra como insignia en «Firmas». */
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
      // Buzón (lo pendiente de resolver) y el historial de lo ya firmado son las dos caras de lo
      // mismo — antes vivían como dos pestañas separadas en el mismo nivel que Expedientes.
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
      // Configuración estructural del módulo (catálogo) y control de cuentas/seguridad, en un solo
      // menú — separados eran dos desplegables de un único ítem cada uno, que sobraba.
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
