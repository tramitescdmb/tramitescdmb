import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, FileClock, FileCheck2, FileArchive, Lock, Plus } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, puedeCrearExpedienteContractual } from "@/lib/permisos";
import { construirWhereExpedienteContractual, ETIQUETA_ETAPA, ETIQUETA_MODALIDAD } from "@/lib/contratacion";
import { db } from "@/lib/db";
import { CabeceraTablero, Chip, EnlaceTablero, Indicador, TarjetaTablero, VacioTablero, type TonoTablero } from "@/components/tablero";
import { formatearFecha } from "@/lib/fecha";

const TONO_ETAPA: Record<string, TonoTablero> = { PRECONTRACTUAL: "ambar", CONTRACTUAL: "verde", POSTCONTRACTUAL: "cielo" };

export default async function PanelExpedientesGeconPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");

  const where = construirWhereExpedienteContractual({}, permisos);
  const [precontractual, contractual, postcontractual, cerrados, recientes] = await Promise.all([
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
      <CabeceraTablero
        titulo="Expedientes por etapa"
        descripcion={`${(precontractual + contractual + postcontractual + cerrados).toLocaleString("es-CO")} expedientes contractuales visibles para usted.`}
        acciones={
          puedeCrearExpedienteContractual(permisos) ? (
            <Link href="/contratacion/expedientes/nuevo" className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-acento-600">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Nuevo expediente
            </Link>
          ) : undefined
        }
      >
        <Indicador icon={FileClock} valor={precontractual} etiqueta="Precontractual" tono="ambar" href="/contratacion/expedientes?etapa=PRECONTRACTUAL" />
        <Indicador icon={FileCheck2} valor={contractual} etiqueta="Contractual" tono="verde" href="/contratacion/expedientes?etapa=CONTRACTUAL" />
        <Indicador icon={FileArchive} valor={postcontractual} etiqueta="Postcontractual" tono="cielo" href="/contratacion/expedientes?etapa=POSTCONTRACTUAL" />
        <Indicador icon={Lock} valor={cerrados} etiqueta="Cerrados" tono="neutro" />
      </CabeceraTablero>

      <TarjetaTablero icon={Briefcase} titulo="Más recientes" accion={<EnlaceTablero href="/contratacion/expedientes">Ver todos</EnlaceTablero>} sinRelleno>
        {recientes.length === 0 ? (
          <VacioTablero>Todavía no hay expedientes de contratación.</VacioTablero>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla-listado w-full text-xs">
              <thead className="bg-stone-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-5 py-1.5">Número</th>
                  <th className="px-3 py-1.5">Objeto</th>
                  <th className="px-3 py-1.5">Modalidad</th>
                  <th className="px-3 py-1.5">Dependencia</th>
                  <th className="px-3 py-1.5">Contratista</th>
                  <th className="px-3 py-1.5">Etapa</th>
                  <th className="px-5 py-1.5">Suscripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recientes.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-50/70">
                    <td className="whitespace-nowrap px-5 py-2 font-mono">
                      <Link href={`/contratacion/expedientes/${e.id}`} className="font-medium text-stone-800 hover:text-cdmb-700">
                        {e.numero}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-stone-700" title={e.objeto}>
                      {e.objeto}
                    </td>
                    <td className="px-3 py-2 text-stone-500">{ETIQUETA_MODALIDAD[e.modalidadSeleccion]}</td>
                    <td className="px-3 py-2 text-stone-500">{e.dependenciaSolicitante.nombre}</td>
                    <td className="px-3 py-2 text-stone-500">{e.contratista?.nombreORazonSocial ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {e.cerrado ? <Chip>Cerrado</Chip> : <Chip tono={TONO_ETAPA[e.etapaActual]}>{ETIQUETA_ETAPA[e.etapaActual]}</Chip>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2 text-stone-600">{e.fechaSuscripcion ? formatearFecha(e.fechaSuscripcion) : "Sin suscribir"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TarjetaTablero>
    </section>
  );
}
