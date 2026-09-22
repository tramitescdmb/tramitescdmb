import { redirect } from "next/navigation";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";
import { db } from "@/lib/db";
import { ETIQUETA_MODALIDAD, ORDEN_MODALIDADES } from "@/lib/contratacion";
import { TituloSeccion } from "@/components/sgdea/ui";
import { FilePlus2 } from "lucide-react";
import { NuevoExpedienteContractualForm } from "@/components/NuevoExpedienteContractualForm";

export default async function NuevoExpedienteContractualPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) {
    return <AccesoRestringido titulo="Nuevo expediente" quien="administrador o jefe de contratación" volverHref="/contratacion/expedientes" volverLabel="Ver expedientes" />;
  }

  const [dependencias, supervisores] = await Promise.all([
    db.dependencia.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    db.usuario.findMany({
      where: { rolContratacion: "SUPERVISOR_INTERVENTOR", activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, dependencia: { select: { nombre: true } } },
    }),
  ]);
  const supervisoresOpciones = supervisores.map((s) => ({ id: s.id, nombre: s.nombre, dependenciaNombre: s.dependencia?.nombre ?? null }));

  return (
    <section className="max-w-5xl space-y-4">
      <TituloSeccion icon={FilePlus2}>Nuevo expediente contractual</TituloSeccion>
      <NuevoExpedienteContractualForm
        dependencias={dependencias}
        supervisores={supervisoresOpciones}
        modalidades={ORDEN_MODALIDADES.map((valor) => ({ valor, etiqueta: ETIQUETA_MODALIDAD[valor] }))}
      />
    </section>
  );
}
