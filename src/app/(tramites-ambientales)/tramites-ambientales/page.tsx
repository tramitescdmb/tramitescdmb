import Link from "next/link";
import { hrefLista } from "@/lib/tableros";
import { MarcoDashboard, RejillaIndicadores, RejillaTarjetas } from "@/components/inicio/BarraDashboard";
import { PieChart, LibraryBig, FolderOpen, Clock3, CheckCircle2, XCircle, Percent, PenLine, FileSignature, MapPin, TrendingUp } from "lucide-react";
import { EstadoBadge } from "@/components/EstadoBadge";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { Dona } from "@/components/charts/Dona";
import { estiloEstado } from "@/lib/estados-expediente-estilo";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getPendientes } from "@/lib/pendientes";
import { obtenerPermisosUsuario, puedeAccederFirmasTramite, puedeAccederTramite, puedePlanearVisitas } from "@/lib/permisos";
import { getPendientesVisitas } from "@/lib/pendientes-visitas";
import { listarBuzon } from "@/lib/solicitudes-firma";
import { resumirPendientesFirma, rotuloCalidadFirma, textoPendientesFirma } from "@/lib/calidad-firma";
import { textoEsperaA } from "@/components/EsperaTurnoFirma";
import { GloboPendientes } from "@/components/GloboPendientes";
import { MisPendientes } from "@/components/MisPendientes";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { SelectorTramites } from "@/components/SelectorTramites";
import { EnlaceTablero, FilaTablero, Indicador, ListaTablero, TarjetaTablero, VacioTablero } from "@/components/tablero";
import { TarjetaPasosACargo } from "@/components/flujos/TarjetaPasosACargo";
import { usuarioFlujo } from "@/lib/flujos";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<FiltrosPeriodo & { tramite?: string }> }) {
  const sp = await searchParams;
  const { rango, etiqueta } = resolverPeriodo(sp);
  const session = await getSession();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  const tramiteIds = permisos && !permisos.esAdmin ? Array.from(permisos.tramites.keys()) : null;
  const tramitesSeleccionados = sp.tramite?.split(",").filter(Boolean);
  const [d, pendientes, visitas, buzonFirmas, todosLosTramites] = await Promise.all([
    getDashboardData(tramiteIds, rango, tramitesSeleccionados),
    getPendientes(session),
    session && permisos
      ? getPendientesVisitas({ userId: session.userId, planificador: puedePlanearVisitas(permisos), tramitesPermitidos: tramiteIds })
      : Promise.resolve(null),
    session && permisos && puedeAccederFirmasTramite(permisos) ? listarBuzon(session.userId, "documentoExpediente") : Promise.resolve([]),
    db.tramiteTipo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  const opcionesTramite = (permisos ? todosLosTramites.filter((t) => puedeAccederTramite(permisos, t.id)) : todosLosTramites).map((t) => ({
    valor: t.id,
    etiqueta: t.nombre,
  }));
  const resumenFirmas = resumirPendientesFirma(buzonFirmas);
  const hrefExp = (estado?: string) => hrefLista("/expedientes", { estado, tramite: sp.tramite, desde: sp.desde, hasta: sp.hasta });

  return (
    <MarcoDashboard
      actual="/tramites-ambientales"
      filtros={
        <>
          <SelectorPeriodo desdeActual={sp.desde} hastaActual={sp.hasta} compacto />
          <SelectorTramites opciones={opcionesTramite} titulo="Trámites" />
        </>
      }
    >
      <RejillaIndicadores>
        <Indicador icon={LibraryBig} valor={d.totalTramites} etiqueta="Trámites disponibles" tono="cdmb" href="/tramites" />
        <Indicador icon={FolderOpen} valor={d.totalExpedientes} etiqueta="Expedientes" tono="neutro" href={hrefExp()} />
        <Indicador icon={Clock3} valor={d.activos} etiqueta="En curso" tono="ambar" href={hrefExp("EN_CURSO")} />
        <Indicador icon={CheckCircle2} valor={d.aprobados} etiqueta="Aprobados" tono="verde" href={hrefExp("APROBADO")} />
        <Indicador icon={XCircle} valor={d.negados} etiqueta="Negados o rechazados" tono="rojo" href={hrefExp("NEGADOS")} />
        <Indicador
          icon={Percent}
          valor={d.tasaAprobacion === null ? "—" : `${d.tasaAprobacion}%`}
          etiqueta="Tasa de aprobación"
          tono="cielo"
          titulo={d.tasaAprobacion === null ? "Aún no hay expedientes decididos." : "Sobre los expedientes ya decididos (aprobados y negados o rechazados)."}
        />
      </RejillaIndicadores>

      <RejillaTarjetas>
        <TarjetaTablero className="lg:col-span-8" icon={TrendingUp} tono="acento" titulo="Solicitudes radicadas por mes" descripcion={`${rango ? etiqueta : "Últimos 12 meses"}, por fecha de radicación del expediente.`}>
          <AreaTrendChart data={d.serieMensual} emptyMessage="Todavía no hay expedientes radicados para mostrar una tendencia." />
        </TarjetaTablero>
        <TarjetaTablero className="lg:col-span-4" icon={PieChart} tono="cielo" titulo="Expedientes por estado" contador={d.totalExpedientes}>
          <Dona
            unidad="expedientes"
            vacio="Sin expedientes."
            segmentos={d.porEstado.map((e) => ({
              etiqueta: estiloEstado(e.clave).etiqueta,
              valor: e.valor,
              color: estiloEstado(e.clave).color,
              href: hrefExp(e.clave),
            }))}
          />
        </TarjetaTablero>
        <TarjetaTablero className="lg:col-span-4" icon={LibraryBig} titulo="Por tipo de trámite" descripcion={`Los trámites, de ${d.totalTramites}, con más expedientes.`}>
          <BarChartHorizontal data={d.topTramites} emptyMessage="Todavía no hay expedientes radicados." />
        </TarjetaTablero>
        <TarjetaTablero className="lg:col-span-4" icon={MapPin} tono="cielo" titulo="Por municipio" descripcion="Municipio donde se adelanta el trámite.">
          <BarChartHorizontal data={d.topMunicipios} emptyMessage="Todavía no hay expedientes con municipio registrado." />
        </TarjetaTablero>
        <TarjetaTablero className="lg:col-span-4" icon={FolderOpen} tono="violeta" titulo="Actividad reciente" accion={<EnlaceTablero href="/expedientes">Ver todos</EnlaceTablero>} sinRelleno>
          {d.recientes.length === 0 ? (
            <VacioTablero>Todavía no hay expedientes radicados.</VacioTablero>
          ) : (
            <ListaTablero>
              {d.recientes.map((exp) => (
                <FilaTablero
                  key={exp.id}
                  href={`/expedientes/${exp.id}`}
                  titulo={exp.numero}
                  detalle={`${exp.tramiteTipo.nombre} · ${exp.municipio}`}
                  extra={
                    <>
                      <EstadoBadge estado={exp.estado} />
                    </>
                  }
                />
              ))}
            </ListaTablero>
          )}
        </TarjetaTablero>
      </RejillaTarjetas>

      {resumenFirmas.total > 0 && (
        <TarjetaTablero
          icon={PenLine}
          tono="rojo"
          titulo={
            <>
              Firmas pendientes <GloboPendientes pendientes={resumenFirmas} />
            </>
          }
          descripcion={`${textoPendientesFirma(resumenFirmas)}.`}
          accion={<EnlaceTablero href="/firmas/buzon">Ir al buzón de firmas</EnlaceTablero>}
          sinRelleno
        >
          <ListaTablero>
            {buzonFirmas.slice(0, 5).map((s) => (
              <FilaTablero
                key={s.id}
                icon={FileSignature}
                tono="neutro"
                titulo={s.documentoExpediente?.nombre}
                detalle={`${s.documentoExpediente?.expediente.numero ?? ""} · ${s.rol === "FIRMA" ? "Debe firmar" : "Visto bueno"}${
                  s.rol === "FIRMA" && rotuloCalidadFirma(s.calidad) ? ` · ${rotuloCalidadFirma(s.calidad)}` : ""
                }`}
                extra={
                  s.puedeActuar ? (
                    <Link href={`/firmas/firmar/${s.id}`} className="rounded-md bg-acento-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-acento-600">
                      {s.rol === "FIRMA" ? "Firmar" : "Revisar"}
                    </Link>
                  ) : (
                    <span className="max-w-[220px] text-right text-[11px] leading-snug text-stone-500">{textoEsperaA(s.esperaA)}</span>
                  )
                }
              />
            ))}
          </ListaTablero>
        </TarjetaTablero>
      )}

      {session && permisos && <TarjetaPasosACargo modulo="TRAMITES" usuario={await usuarioFlujo(session.userId, permisos, "TRAMITES")} className="" />}

      <MisPendientes resumen={pendientes} visitas={visitas} />
    </MarcoDashboard>
  );
}
