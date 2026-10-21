import Link from "next/link";
import { MarcoDashboard, RejillaIndicadores, RejillaTarjetas } from "@/components/inicio/BarraDashboard";
import { LibraryBig, FolderOpen, Clock3, CheckCircle2, XCircle, Percent, PenLine, FileSignature, MapPin, TrendingUp } from "lucide-react";
import { EstadoBadge } from "@/components/EstadoBadge";
import { ProgresoExpediente, pasosParaAvance } from "@/components/ProgresoExpediente";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { LineasMensuales } from "@/components/charts/LineasMensuales";
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
        <Indicador icon={FolderOpen} valor={d.totalExpedientes} etiqueta="Expedientes" tono="neutro" href="/expedientes" />
        <Indicador icon={Clock3} valor={d.activos} etiqueta="En curso" tono="ambar" href="/expedientes?estado=EN_TRAMITE" />
        <Indicador icon={CheckCircle2} valor={d.aprobados} etiqueta="Aprobados" tono="verde" href="/expedientes?estado=APROBADO" />
        <Indicador icon={XCircle} valor={d.negados} etiqueta="Negados o rechazados" tono="rojo" href="/expedientes?estado=NEGADO" />
        <Indicador
          icon={Percent}
          valor={d.tasaAprobacion === null ? "—" : `${d.tasaAprobacion}%`}
          etiqueta="Tasa de aprobación"
          tono="cielo"
          titulo={d.tasaAprobacion === null ? "Aún no hay expedientes decididos." : "Sobre los expedientes ya decididos (aprobados y negados o rechazados)."}
        />
      </RejillaIndicadores>

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

      <MisPendientes resumen={pendientes} visitas={visitas} />

      <RejillaTarjetas>
      <TarjetaTablero className="lg:col-span-8" icon={TrendingUp} tono="acento" titulo="Solicitudes radicadas por mes" descripcion={`${rango ? etiqueta : "Últimos 12 meses"}, por fecha de radicación del expediente.`}>
        <LineasMensuales
          series={[{ nombre: "Radicadas", color: "#2a78d6" }]}
          datos={d.serieMensual.map((p) => ({ etiqueta: p.label, valores: [p.value] }))}
          vacio="Todavía no hay expedientes radicados para mostrar una tendencia."
        />
      </TarjetaTablero>
      <TarjetaTablero className="lg:col-span-4" icon={MapPin} tono="cielo" titulo="Municipios con más solicitudes" descripcion="Municipio de la jurisdicción donde se adelanta el trámite.">
        <BarChartHorizontal data={d.topMunicipios} emptyMessage="Todavía no hay expedientes con municipio registrado." />
      </TarjetaTablero>
      <TarjetaTablero className="lg:col-span-4" icon={LibraryBig} titulo="Trámites más solicitados" descripcion={`Trámites, de los ${d.totalTramites}, con más expedientes.`}>
        <BarChartHorizontal data={d.topTramites} emptyMessage="Todavía no hay expedientes radicados." />
      </TarjetaTablero>

      <TarjetaTablero className="lg:col-span-8" icon={FolderOpen} titulo="Actividad reciente" accion={<EnlaceTablero href="/expedientes">Ver todos</EnlaceTablero>} sinRelleno>
        {d.recientes.length === 0 ? (
          <VacioTablero>Todavía no hay expedientes radicados.</VacioTablero>
        ) : (
          <ListaTablero>
            {d.recientes.map((exp) => (
              <FilaTablero
                key={exp.id}
                href={`/expedientes/${exp.id}`}
                titulo={exp.numero}
                detalle={`${exp.tramiteTipo.nombre} · ${exp.solicitanteNombre} · ${exp.municipio}`}
                extra={
                  <>
                    <span className="hidden w-32 sm:block">
                      <ProgresoExpediente
                        pasoActualNumero={exp.pasoActualNumero}
                        totalPasos={exp.flujo.pasos.length}
                        pasosAvance={pasosParaAvance(exp.flujo.pasos.map((p) => p.titulo))}
                        estado={exp.estado}
                      />
                    </span>
                    <EstadoBadge estado={exp.estado} />
                  </>
                }
              />
            ))}
          </ListaTablero>
        )}
      </TarjetaTablero>
      </RejillaTarjetas>
    </MarcoDashboard>
  );
}
