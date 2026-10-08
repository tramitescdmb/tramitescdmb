import { redirect } from "next/navigation";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas, puedeAsignarPersonalContrato } from "@/lib/permisos";
import { db } from "@/lib/db";
import { catalogoSeriesBuscablesCacheado, subseriesPorModalidad } from "@/lib/trd-clasificacion";
import { ETIQUETA_MODALIDAD, ORDEN_MODALIDADES } from "@/lib/contratacion";
import { TituloSeccion } from "@/components/sgdea/ui";
import { FilePlus2 } from "lucide-react";
import { NuevoExpedienteContractualForm } from "@/components/NuevoExpedienteContractualForm";
import type { RolContratacion } from "@prisma/client";

function personasConRol(rol: RolContratacion) {
  return db.usuario.findMany({
    where: { rolesContratacion: { has: rol }, activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, cedulaONit: true, dependencia: { select: { nombre: true } } },
  });
}

export default async function NuevoExpedienteContractualPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) {
    return <AccesoRestringido titulo="Nuevo expediente" quien="administrador o jefe de contratación" volverHref="/contratacion/expedientes" volverLabel="Ver expedientes" />;
  }

  const puedeAsignarPersonal = puedeAsignarPersonalContrato(permisos);
  const [series, subseriePorModalidad, dependencias, supervisores, personal] = await Promise.all([
    catalogoSeriesBuscablesCacheado(),
    subseriesPorModalidad(),
    db.dependencia.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    personasConRol("SUPERVISOR_INTERVENTOR"),
    puedeAsignarPersonal ? personasConRol("FUNCIONARIO_CONTRATACION") : [],
  ]);
  const aOpcion = (s: Awaited<ReturnType<typeof personasConRol>>[number]) => ({
    id: s.id,
    nombre: s.nombre,
    identificacion: s.cedulaONit,
    dependenciaNombre: s.dependencia?.nombre ?? null,
  });

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <TituloSeccion icon={FilePlus2}>Nuevo expediente contractual</TituloSeccion>
      <NuevoExpedienteContractualForm
        series={series}
        subseriePorModalidad={subseriePorModalidad}
        dependencias={dependencias}
        supervisores={supervisores.map(aOpcion)}
        personal={personal.map(aOpcion)}
        puedeAsignarPersonal={puedeAsignarPersonal}
        modalidades={ORDEN_MODALIDADES.map((valor) => ({ valor, etiqueta: ETIQUETA_MODALIDAD[valor] }))}
        enlaceUsuarios={permisos.esAdmin ? "/usuarios" : null}
      />
    </section>
  );
}
