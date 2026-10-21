import Link from "next/link";
import { MarcoDashboard, RejillaIndicadores, RejillaTarjetas } from "@/components/inicio/BarraDashboard";
import { Dona } from "@/components/charts/Dona";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { tableroGecon } from "@/lib/tablero-general";
import { construirWhereExpedienteContractual } from "@/lib/contratacion";
import { ETAPAS_ORDEN, ETIQUETA_ETAPA } from "@/lib/contratacion-etiquetas";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PenLine, Hourglass, CalendarClock, UserX, FileSignature, UserPlus, BadgeCheck, TrendingUp, PieChart, Layers, Building2 } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, puedeGestionarContratistas } from "@/lib/permisos";
import { agruparPorExpediente, obtenerTrabajoPendienteContratacion, type DocumentoPorGestionar, type InformePorRadicar } from "@/lib/contratacion-panel";
import { identificacionContrato } from "@/lib/codigo-proceso";
import { EnlaceTablero, FilaTablero, Indicador, ListaTablero, TarjetaTablero, VacioTablero } from "@/components/tablero";
import { rotuloCalidadFirma } from "@/lib/calidad-firma";
import { textoEsperaA, textoRecordatorio } from "@/components/EsperaTurnoFirma";

const COLOR_ETAPA: Record<string, string> = { PRECONTRACTUAL: "#2a78d6", CONTRACTUAL: "#d16f00", POSTCONTRACTUAL: "#4a3aa7" };

const ETIQUETA_ROL: Record<string, string> = { FIRMA: "Debe firmar", VISTO_BUENO: "Visto bueno" };

function GrupoContrato({
  expediente,
  contratista,
  children,
}: {
  expediente: { id: string; numero: string; numeroContrato: string | null; codigoProceso: string | null };
  contratista: string | null;
  children: ReactNode;
}) {
  return (
    <li className="px-5 py-2.5 text-sm">
      <Link href={`/contratacion/expedientes/${expediente.id}`} className="block truncate font-medium text-stone-800 hover:text-cdmb-700 hover:underline">
        {identificacionContrato(expediente)}
      </Link>
      <span className="block truncate text-xs text-stone-400">{contratista ?? "Sin contratista"}</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>
    </li>
  );
}

function EnlaceDocumento({ d }: { d: DocumentoPorGestionar }) {
  return (
    <Link
      href={`/contratacion/expedientes/${d.expediente.id}#documento-${d.id}`}
      title={`Subido por ${d.subidoPor}`}
      className="rounded-md border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-700 hover:border-cdmb-300 hover:bg-cdmb-50"
    >
      {d.nombre}
    </Link>
  );
}

function TarjetaDocumentos({ id, titulo, icon, tono, descripcion, total, docs, vacio }: {
  id: string;
  titulo: string;
  icon: typeof UserPlus;
  tono: "acento" | "verde";
  descripcion: string;
  total: number;
  docs: DocumentoPorGestionar[];
  vacio: string;
}) {
  return (
    <TarjetaTablero id={id} className="lg:col-span-6" icon={icon} tono={tono} titulo={titulo} descripcion={descripcion} contador={total} sinRelleno>
      {docs.length === 0 ? (
        <VacioTablero>{vacio}</VacioTablero>
      ) : (
        <ListaTablero>
          {agruparPorExpediente(docs).map((g) => (
            <GrupoContrato key={g.expediente.id} expediente={g.expediente} contratista={g.expediente.contratista}>
              {g.documentos.map((d) => (
                <EnlaceDocumento key={d.id} d={d} />
              ))}
            </GrupoContrato>
          ))}
        </ListaTablero>
      )}
    </TarjetaTablero>
  );
}

function agruparInformes(informes: InformePorRadicar[]) {
  const grupos = new Map<string, InformePorRadicar[]>();
  for (const i of informes) grupos.set(i.expedienteId, [...(grupos.get(i.expedienteId) ?? []), i]);
  return [...grupos.values()].sort((a, b) => Math.max(...b.map((i) => i.diasDeRetraso)) - Math.max(...a.map((i) => i.diasDeRetraso)));
}

export default async function PanelPendientesGeconPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");

  const gestiona = puedeGestionarContratistas(permisos);
  const [p, g] = await Promise.all([
    obtenerTrabajoPendienteContratacion(session.userId, permisos, gestiona),
    tableroGecon(construirWhereExpedienteContractual({}, permisos)),
  ]);
  const esperando = p.firmas.total - p.firmas.listos;

  return (
    <MarcoDashboard actual="/contratacion/panel">
      <RejillaIndicadores>
        <Indicador icon={PenLine} valor={p.firmas.listos} etiqueta="Por firmar ahora" tono="rojo" href="/contratacion/buzon" />
        <Indicador icon={Hourglass} valor={esperando} etiqueta="Esperando turno" tono="ambar" href="/contratacion/buzon" />
        {p.sinFirmante.aplica && <Indicador icon={UserPlus} valor={p.sinFirmante.total} etiqueta="Sin firmante" tono="acento" href="#sin-firmante" />}
        {p.porValidar.aplica && <Indicador icon={BadgeCheck} valor={p.porValidar.total} etiqueta="Por validar" tono="verde" href="#por-validar" />}
        <Indicador icon={CalendarClock} valor={p.informes.total} etiqueta="Informes por radicar" tono="acento" href="#informes" />
        {gestiona && <Indicador icon={UserX} valor={p.sinContratista} etiqueta="Sin contratista" tono="neutro" href="/contratacion/expedientes?contratista=sin" />}
      </RejillaIndicadores>

      <RejillaTarjetas>
        <TarjetaTablero className="lg:col-span-8" icon={TrendingUp} tono="acento" titulo="Expedientes creados por mes" descripcion="Últimos 12 meses.">
          <AreaTrendChart data={g.mensual} emptyMessage="Sin expedientes creados en los últimos 12 meses." />
        </TarjetaTablero>
        <TarjetaTablero
          className="lg:col-span-4"
          icon={PieChart}
          tono="cielo"
          titulo="Contratos por etapa"
          contador={g.porEtapa.reduce((t, e) => t + e.valor, 0)}
        >
          <Dona
            unidad="contratos"
            vacio="Sin contratos."
            segmentos={ETAPAS_ORDEN.map((clave) => ({
              etiqueta: ETIQUETA_ETAPA[clave],
              valor: g.porEtapa.find((e) => e.clave === clave)?.valor ?? 0,
              color: COLOR_ETAPA[clave] ?? "#76847a",
              href: `/contratacion/expedientes?etapa=${clave}`,
            }))}
          />
        </TarjetaTablero>
        <TarjetaTablero className="lg:col-span-4" icon={Layers} titulo="Por modalidad" descripcion="Modalidad de selección.">
          <BarChartHorizontal data={g.porModalidad} emptyMessage="Sin expedientes." />
        </TarjetaTablero>
        <TarjetaTablero className="lg:col-span-4" icon={Building2} tono="cielo" titulo="Por dependencia" descripcion="Dependencia solicitante.">
          <BarChartHorizontal data={g.porDependencia} emptyMessage="Sin expedientes." />
        </TarjetaTablero>
        <TarjetaTablero
          className="lg:col-span-4"
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
                  detalle={`${s.documentoContrato ? identificacionContrato(s.documentoContrato.expediente) : ""} · ${ETIQUETA_ROL[s.rol] ?? s.rol}${
                    s.rol === "FIRMA" && rotuloCalidadFirma(s.calidad) ? ` · ${rotuloCalidadFirma(s.calidad)}` : ""
                  }${textoRecordatorio(s.recordadoPor, s.recordadoEn) ? ` · ${textoRecordatorio(s.recordadoPor, s.recordadoEn)}` : ""}`}
                  extra={
                    s.puedeActuar ? (
                      <Link href={`/contratacion/firmar/${s.id}`} className="rounded-md bg-acento-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-acento-600">
                        {s.rol === "FIRMA" ? "Firmar" : "Revisar"}
                      </Link>
                    ) : (
                      <span className="max-w-[220px] text-right text-[11px] leading-snug text-stone-500">{textoEsperaA(s.esperaA)}</span>
                    )
                  }
                />
              ))}
            </ListaTablero>
          )}
        </TarjetaTablero>


        {p.sinFirmante.aplica && (
          <TarjetaDocumentos
            id="sin-firmante"
            titulo="Sin firmante asignado"
            icon={UserPlus}
            tono="acento"
            descripcion="Marcados «Requiere firma»: asigne quién firma desde el expediente."
            total={p.sinFirmante.total}
            docs={p.sinFirmante.lista}
            vacio="Todos los documentos que requieren firma tienen firmante."
          />
        )}

        {p.porValidar.aplica && (
          <TarjetaDocumentos
            id="por-validar"
            titulo="Por validar"
            icon={BadgeCheck}
            tono="verde"
            descripcion="Documentos cargados que no van a firma."
            total={p.porValidar.total}
            docs={p.porValidar.lista}
            vacio="Sin documentos por validar."
          />
        )}

        <TarjetaTablero
          id="informes"
          className="lg:col-span-6"
          icon={CalendarClock}
          tono="ambar"
          titulo="Informes de supervisión por radicar"
          descripcion="Por contrato, del más atrasado al más reciente."
          contador={p.informes.total}
          sinRelleno
        >
          {p.informes.lista.length === 0 ? (
            <VacioTablero>Sin informes por radicar.</VacioTablero>
          ) : (
            <ListaTablero>
              {agruparInformes(p.informes.lista).map((g) => (
                <GrupoContrato key={g[0]!.expedienteId} expediente={{ ...g[0]!, id: g[0]!.expedienteId }} contratista={g[0]!.contratista}>
                  {g.map((i) => (
                    <Link
                      key={i.periodoClave}
                      href={`/contratacion/expedientes/${i.expedienteId}?periodo=${i.periodoClave}#periodo-${i.periodoClave}`}
                      title={`Informe ${i.numeroInforme} · ${i.rango}`}
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${i.diasDeRetraso > 15 ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-amber-50 text-amber-800 hover:bg-amber-100"}`}
                    >
                      {i.mes} · {i.diasDeRetraso === 0 ? "hoy" : `${i.diasDeRetraso} d`}
                    </Link>
                  ))}
                </GrupoContrato>
              ))}
            </ListaTablero>
          )}
        </TarjetaTablero>
      </RejillaTarjetas>
    </MarcoDashboard>
  );
}
