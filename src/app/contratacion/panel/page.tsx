import Link from "next/link";
import { redirect } from "next/navigation";
import { ListChecks, PenLine, Hourglass, CalendarClock, UserX, FileSignature, ArrowRight } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, puedeGestionarContratistas } from "@/lib/permisos";
import { obtenerTrabajoPendienteContratacion } from "@/lib/contratacion-panel";
import { TituloSeccion, TarjetaKpi, EstadoVacio, Panel, Sub } from "@/components/sgdea/ui";
import { formatearFechaSolo } from "@/lib/fecha";

const ETIQUETA_ROL: Record<string, string> = { FIRMA: "Debe firmar", VISTO_BUENO: "Visto bueno" };

export default async function PanelMiTrabajoSigecPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");

  const gestiona = puedeGestionarContratistas(permisos);
  const p = await obtenerTrabajoPendienteContratacion(session.userId, permisos, gestiona);
  const esperando = p.firmas.total - p.firmas.listos;

  return (
    <section className="space-y-4">
      <TituloSeccion icon={ListChecks}>Mi trabajo pendiente</TituloSeccion>

      <div className={`grid grid-cols-2 gap-3 ${gestiona ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <TarjetaKpi icon={PenLine} label="Por firmar ahora" value={p.firmas.listos} tono="azul" href="/contratacion/buzon" />
        <TarjetaKpi icon={Hourglass} label="Esperando turno" value={esperando} tono="ambar" href="/contratacion/buzon" />
        <TarjetaKpi icon={CalendarClock} label="Informes por radicar" value={p.informes.total} tono="rojo" />
        {gestiona && <TarjetaKpi icon={UserX} label="Sin contratista" value={p.sinContratista} tono="ambar" href="/contratacion/expedientes" />}
      </div>
      <p className="text-xs text-stone-400">
        Cuenta lo asignado a usted: documentos que esperan su firma o visto bueno, e informes de supervisión de los expedientes que usted ve cuyo
        periodo ya cerró y aún no tienen documento cargado.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-2">
            <Sub>Documentos por firmar o revisar</Sub>
            <Link href="/contratacion/buzon" className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline">
              Ir al buzón <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          {p.firmas.lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">No tiene documentos pendientes de firma.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {p.firmas.lista.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                  <FileSignature className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-stone-800">{s.documentoContrato?.nombre}</p>
                    <p className="truncate text-xs text-stone-400">
                      {s.documentoContrato?.expediente.numero} · {ETIQUETA_ROL[s.rol] ?? s.rol}
                    </p>
                  </div>
                  {s.puedeActuar ? (
                    <Link href={`/contratacion/firmar/${s.id}`} className="flex-none rounded-md bg-cdmb-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-cdmb-700">
                      {s.rol === "FIRMA" ? "Firmar" : "Revisar"}
                    </Link>
                  ) : (
                    <span className="flex-none text-[11px] text-stone-400">Espera turno</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <Sub>Informes de supervisión por radicar</Sub>
          <p className="mb-3 text-xs text-stone-500">Periodos cerrados, del más atrasado al más reciente.</p>
          {p.informes.lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">No hay informes por radicar.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {p.informes.lista.map((i) => (
                <li key={`${i.expedienteId}-${i.numeroInforme}`} className="flex items-center gap-3 py-2 text-sm">
                  <CalendarClock className="h-4 w-4 flex-none text-red-500" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <Link href={`/contratacion/expedientes/${i.expedienteId}`} className="font-medium text-cdmb-700 hover:underline">
                      Informe de supervisión {i.numeroInforme}
                    </Link>
                    <p className="truncate text-xs text-stone-400">
                      <span className="font-mono">{i.numero}</span> · {i.rango} · desde el {formatearFechaSolo(i.radicaDesde)}
                    </p>
                  </div>
                  <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-medium ${i.diasDeRetraso > 15 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                    {i.diasDeRetraso === 0 ? "Hoy" : `${i.diasDeRetraso} d.`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {p.informes.total > p.informes.lista.length && (
            <p className="mt-2 text-xs text-stone-400">Y {p.informes.total - p.informes.lista.length} más.</p>
          )}
        </Panel>
      </div>

      {p.firmas.total === 0 && p.informes.total === 0 && p.sinContratista === 0 && (
        <EstadoVacio icon={ListChecks}>No tiene trabajo pendiente en este momento.</EstadoVacio>
      )}
    </section>
  );
}
