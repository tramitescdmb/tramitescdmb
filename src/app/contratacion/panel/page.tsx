import Link from "next/link";
import { redirect } from "next/navigation";
import { PenLine, Hourglass, CalendarClock, UserX, FileSignature, FileText } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, puedeGestionarContratistas } from "@/lib/permisos";
import { obtenerTrabajoPendienteContratacion, type InformePorRadicar } from "@/lib/contratacion-panel";
import { identificacionContrato } from "@/lib/codigo-proceso";
import { CabeceraTablero, Chip, EnlaceTablero, FilaTablero, Indicador, ListaTablero, TarjetaTablero, VacioTablero } from "@/components/tablero";
import { formatearFechaSolo } from "@/lib/fecha";
import { fechaHoyLarga } from "@/lib/saludo";
import { rotuloCalidadFirma } from "@/lib/calidad-firma";

const ETIQUETA_ROL: Record<string, string> = { FIRMA: "Debe firmar", VISTO_BUENO: "Visto bueno" };
const VISIBLES = 10;

function FilaInforme({ i }: { i: InformePorRadicar }) {
  return (
    <FilaTablero
      href={`/contratacion/expedientes/${i.expedienteId}?periodo=${i.periodoClave}#periodo-${i.periodoClave}`}
      icon={FileText}
      tono="ambar"
      titulo={`Informe de supervisión ${i.numeroInforme} · ${i.mes}`}
      detalle={`${i.contratista ?? "Sin contratista"} · ${identificacionContrato(i)} · ${i.rango} · desde el ${formatearFechaSolo(i.radicaDesde)}`}
      extra={<Chip tono={i.diasDeRetraso > 15 ? "rojo" : "ambar"}>{i.diasDeRetraso === 0 ? "Hoy" : `${i.diasDeRetraso} d`}</Chip>}
    />
  );
}

export default async function PanelPendientesGeconPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");

  const gestiona = puedeGestionarContratistas(permisos);
  const p = await obtenerTrabajoPendienteContratacion(session.userId, permisos, gestiona);
  const esperando = p.firmas.total - p.firmas.listos;

  return (
    <section className="space-y-4">
      <CabeceraTablero antetitulo={fechaHoyLarga()} titulo="Pendientes" descripcion="Documentos por firmar o revisar e informes de supervisión de periodos cerrados.">
        <Indicador icon={PenLine} valor={p.firmas.listos} etiqueta="Por firmar ahora" tono="rojo" href="/contratacion/buzon" />
        <Indicador icon={Hourglass} valor={esperando} etiqueta="Esperando turno" tono="ambar" href="/contratacion/buzon" />
        <Indicador icon={CalendarClock} valor={p.informes.total} etiqueta="Informes por radicar" tono="acento" />
        {gestiona && <Indicador icon={UserX} valor={p.sinContratista} etiqueta="Sin contratista" tono="neutro" href="/contratacion/expedientes" />}
      </CabeceraTablero>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <TarjetaTablero
          icon={PenLine}
          tono="rojo"
          titulo="Documentos por firmar o revisar"
          contador={p.firmas.total}
          accion={<EnlaceTablero href="/contratacion/buzon">Ir al buzón</EnlaceTablero>}
          sinRelleno
        >
          {p.firmas.lista.length === 0 ? (
            <VacioTablero>Sin documentos pendientes de firma.</VacioTablero>
          ) : (
            <ListaTablero>
              {p.firmas.lista.map((s) => (
                <FilaTablero
                  key={s.id}
                  icon={FileSignature}
                  tono="neutro"
                  titulo={s.documentoContrato?.nombre}
                  detalle={`${s.documentoContrato?.expediente.numero ?? ""} · ${ETIQUETA_ROL[s.rol] ?? s.rol}${
                    s.rol === "FIRMA" && rotuloCalidadFirma(s.calidad) ? ` · ${rotuloCalidadFirma(s.calidad)}` : ""
                  }`}
                  extra={
                    s.puedeActuar ? (
                      <Link href={`/contratacion/firmar/${s.id}`} className="rounded-md bg-acento-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-acento-600">
                        {s.rol === "FIRMA" ? "Firmar" : "Revisar"}
                      </Link>
                    ) : (
                      <Chip>Espera turno</Chip>
                    )
                  }
                />
              ))}
            </ListaTablero>
          )}
        </TarjetaTablero>

        <TarjetaTablero
          icon={CalendarClock}
          tono="ambar"
          titulo="Informes de supervisión por radicar"
          descripcion="Del más atrasado al más reciente."
          contador={p.informes.total}
          sinRelleno
        >
          {p.informes.lista.length === 0 ? (
            <VacioTablero>Sin informes por radicar.</VacioTablero>
          ) : (
            <>
              <ListaTablero>
                {p.informes.lista.slice(0, VISIBLES).map((i) => (
                  <FilaInforme key={`${i.expedienteId}-${i.numeroInforme}`} i={i} />
                ))}
              </ListaTablero>
              {p.informes.lista.length > VISIBLES && (
                <details className="group border-t border-stone-100">
                  <summary className="cursor-pointer list-none px-5 py-2.5 text-xs font-medium text-cdmb-700 hover:underline group-open:hidden [&::-webkit-details-marker]:hidden">
                    Ver {p.informes.lista.length - VISIBLES} más
                  </summary>
                  <ListaTablero>
                    {p.informes.lista.slice(VISIBLES).map((i) => (
                      <FilaInforme key={`${i.expedienteId}-${i.numeroInforme}`} i={i} />
                    ))}
                  </ListaTablero>
                </details>
              )}
            </>
          )}
        </TarjetaTablero>
      </div>
    </section>
  );
}
