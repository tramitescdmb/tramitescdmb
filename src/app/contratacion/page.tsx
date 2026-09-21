import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, FileClock, FileCheck2, FileArchive, PenLine } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederContratacion } from "@/lib/permisos";
import { construirWhereExpedienteContractual, ETIQUETA_ETAPA, ETIQUETA_MODALIDAD } from "@/lib/contratacion";
import { db } from "@/lib/db";
import { contarPendientesBuzonContratacion } from "@/lib/solicitudes-firma";
import { TituloSeccion, TarjetaKpi, EstadoVacio } from "@/components/sgdea/ui";
import { formatearFecha } from "@/lib/fecha";

export default async function PanelContratacionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");

  const where = construirWhereExpedienteContractual({}, permisos);
  const [pendientesFirma, precontractual, contractual, postcontractual, cerrados, recientes] = await Promise.all([
    contarPendientesBuzonContratacion(session.userId),
    db.expedienteContractual.count({ where: { AND: [where, { etapaActual: "PRECONTRACTUAL", cerrado: false }] } }),
    db.expedienteContractual.count({ where: { AND: [where, { etapaActual: "CONTRACTUAL", cerrado: false }] } }),
    db.expedienteContractual.count({ where: { AND: [where, { etapaActual: "POSTCONTRACTUAL", cerrado: false }] } }),
    db.expedienteContractual.count({ where: { AND: [where, { cerrado: true }] } }),
    db.expedienteContractual.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { dependenciaSolicitante: { select: { nombre: true } }, contratista: { select: { nombreORazonSocial: true } } },
    }),
  ]);

  return (
    <section className="space-y-4">
      <TituloSeccion icon={Briefcase}>Panel de Contratación</TituloSeccion>

      {pendientesFirma.total > 0 && (
        <Link
          href="/contratacion/buzon"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm hover:bg-amber-100"
        >
          <PenLine className="h-4 w-4 flex-none" aria-hidden />
          <span className="min-w-0 flex-1">
            <strong>
              Tiene {pendientesFirma.total} documento{pendientesFirma.total === 1 ? "" : "s"} pendiente{pendientesFirma.total === 1 ? "" : "s"} por firmar o revisar.
            </strong>{" "}
            {pendientesFirma.listos < pendientesFirma.total
              ? `${pendientesFirma.listos} ya puede${pendientesFirma.listos === 1 ? "" : "n"} firmarse; el resto espera el turno de otro firmante.`
              : "Ya puede firmarse."}
          </span>
          <span className="flex-none text-xs font-semibold underline">Ir al buzón</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TarjetaKpi icon={FileClock} label="Precontractual" value={precontractual} tono="ambar" />
        <TarjetaKpi icon={FileCheck2} label="Contractual" value={contractual} tono="cdmb" />
        <TarjetaKpi icon={FileArchive} label="Postcontractual" value={postcontractual} tono="azul" />
        <TarjetaKpi icon={FileArchive} label="Cerrados" value={cerrados} tono="rojo" />
      </div>

      {recientes.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Objeto</th>
                <th className="px-3 py-2">Modalidad</th>
                <th className="px-3 py-2">Dependencia</th>
                <th className="px-3 py-2">Contratista</th>
                <th className="px-3 py-2">Etapa</th>
                <th className="px-3 py-2">Creado</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((e) => (
                <tr key={e.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/contratacion/expedientes/${e.id}`} className="text-cdmb-700 hover:underline">
                      {e.numero}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-3 py-2" title={e.objeto}>{e.objeto}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{ETIQUETA_MODALIDAD[e.modalidadSeleccion]}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{e.dependenciaSolicitante.nombre}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{e.contratista?.nombreORazonSocial ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{e.cerrado ? "Cerrado" : ETIQUETA_ETAPA[e.etapaActual]}</td>
                  <td className="px-3 py-2 text-xs text-stone-400">{formatearFecha(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EstadoVacio icon={Briefcase}>Todavía no hay expedientes de contratación.</EstadoVacio>
      )}
    </section>
  );
}
