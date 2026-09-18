import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Briefcase, FileClock, FileCheck2, FileArchive, Inbox, UserSquare2, FilePlus2, HelpCircle, ChartColumn } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederContratacion, puedeGestionarContratistas, puedeVerRegistroContratistas } from "@/lib/permisos";
import { construirWhereExpedienteContractual, ETIQUETA_ETAPA, ETIQUETA_MODALIDAD } from "@/lib/contratacion";
import { listarBuzon } from "@/lib/solicitudes-firma";
import { db } from "@/lib/db";
import { TituloSeccion, TarjetaKpi, EstadoVacio } from "@/components/sgdea/ui";
import { formatearFecha } from "@/lib/fecha";

function AccesoRapido({ href, icon: Icon, label, contador }: { href: string; icon: LucideIcon; label: string; contador?: number }) {
  return (
    <Link
      href={href}
      className="relative flex flex-col items-center gap-1.5 rounded-xl border border-stone-200 bg-white p-3 text-center shadow-soft transition hover:border-cdmb-300 hover:bg-cdmb-50/40"
    >
      {Boolean(contador) && (
        <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {contador}
        </span>
      )}
      <Icon className="h-5 w-5 text-cdmb-600" aria-hidden />
      <span className="text-xs font-medium text-stone-700">{label}</span>
    </Link>
  );
}

export default async function PanelContratacionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");

  const where = construirWhereExpedienteContractual({}, permisos);
  const [precontractual, contractual, postcontractual, cerrados, recientes, buzon] = await Promise.all([
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
    listarBuzon(session.userId, "documentoContrato"),
  ]);

  return (
    <section className="space-y-4">
      <TituloSeccion icon={Briefcase}>Panel de Contratación</TituloSeccion>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {puedeGestionarContratistas(permisos) && (
          <AccesoRapido href="/contratacion/expedientes/nuevo" icon={FilePlus2} label="Nuevo expediente" />
        )}
        <AccesoRapido href="/contratacion/expedientes" icon={Briefcase} label="Expedientes" />
        <AccesoRapido href="/contratacion/buzon" icon={Inbox} label="Buzón de firmas" contador={buzon.length} />
        <AccesoRapido href="/contratacion/dashboard" icon={ChartColumn} label="Dashboard" />
        {puedeVerRegistroContratistas(permisos) && (
          <AccesoRapido href="/contratacion/contratistas" icon={UserSquare2} label="Contratistas" />
        )}
        <AccesoRapido href="/contratacion/ayuda" icon={HelpCircle} label="Ayuda" />
      </div>

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
