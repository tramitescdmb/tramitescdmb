"use client";

import { textoPendientesFirma, type ResumenPendientesFirma } from "@/lib/calidad-firma";
import { LayoutDashboard, Briefcase, Inbox, UserSquare2, ShieldCheck } from "lucide-react";
import { BarraModulo, type GrupoMenu, type ItemMenu } from "@/components/BarraModulo";

export type PermitidoContratacion = {
  administrar: boolean;
  crearExpediente: boolean;
  catalogo: boolean;
  verContratistas: boolean;
  soloAdministrador: boolean;
  gestion: boolean;
  tableroContratos: boolean;
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
  pendientesFirma: ResumenPendientesFirma;
}) {
  const insigniaFirmas = {
    valor: pendientesFirma.total,
    alerta: pendientesFirma.listos > 0,
    titulo: textoPendientesFirma(pendientesFirma),
  };
  const grupos: GrupoMenu[] = [
    {
      label: "Panel",
      icon: LayoutDashboard,
      items: [
        {
          href: "/contratacion/panel",
          label: "Pendientes",
          insignia: { valor: pendientesFirma.listos, alerta: pendientesFirma.listos > 0, titulo: textoPendientesFirma(pendientesFirma) },
        },
        { href: "/contratacion/panel/expedientes", label: "Expedientes por etapa" },
        { href: "/contratacion/panel/indicadores", label: "Indicadores" },
        ...(permitido.tableroContratos ? [{ href: "/contratacion/panel/contratos", label: "Contratos y recursos" }] : []),
        ...(permitido.gestion ? [{ href: "/contratacion/panel/sistema", label: "Sistema", separador: true }] : []),
      ],
    },
    {
      label: "Expedientes",
      icon: Briefcase,
      items: [
        { href: "/contratacion/expedientes", label: "Expedientes contractuales" },
        entrada(permitido.crearExpediente, "Solo administrador, jefe o personal de contratación", { href: "/contratacion/expedientes/nuevo", label: "Nuevo expediente" }),
      ],
    },
    permitido.verContratistas
      ? { label: "Contratistas", icon: UserSquare2, href: "/contratacion/contratistas" }
      : { label: "Contratistas", icon: UserSquare2, href: "/contratacion/contratistas", bloqueadoPara: ADMIN_O_JEFE },
    {
      label: "Firmas",
      icon: Inbox,
      items: [
        { href: "/contratacion/buzon", label: "Buzón de firmas", insignia: insigniaFirmas },
        { href: "/contratacion/mis-firmas", label: "Mis firmas" },
        { href: "/contratacion/rechazos-firma", label: "Rechazos al firmar" },
      ],
      insignia: insigniaFirmas,
    },
    {
      label: "Administración",
      icon: ShieldCheck,
      lado: "derecha",
      items: [
        entrada(permitido.catalogo, ADMIN_O_JEFE, { href: "/contratacion/catalogo", label: "Catálogo de requisitos", prefijo: true }),
        entrada(permitido.soloAdministrador, SOLO_ADMIN, { href: "/contratacion/disposicion", label: "Disposición final (TRD)", prefijo: true }),
        entrada(permitido.gestion, ADMIN_O_JEFE, { href: "/contratacion/cuantias", label: "Topes de cuantía por vigencia", prefijo: true }),
        entrada(permitido.gestion, ADMIN_O_JEFE, { href: "/contratacion/bitacora", label: "Bitácora del GECON", prefijo: true, separador: true }),
        entrada(permitido.administradorSistema, SOLO_ADMIN, { href: "/usuarios", label: "Usuarios y roles", prefijo: true, externo: true }),
        entrada(permitido.gestion, ADMIN_O_JEFE, { href: "/contratacion/auditoria", label: "Auditoría de cuentas", prefijo: true }),
        entrada(permitido.gestion, ADMIN_O_JEFE, { href: "/contratacion/seguridad", label: "Seguridad (contraseñas, accesos)", prefijo: true }),
        { href: "/contratacion/manual-demostracion", label: "Manual de demostración", prefijo: true, separador: true },
      ],
    },
  ];

  return <BarraModulo grupos={grupos} ariaLabel="Secciones de GECON" />;
}
