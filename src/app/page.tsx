import { redirect } from "next/navigation";
import { Archive, Briefcase, CalendarCheck, CalendarDays, CircleCheck, FileBadge, FolderOpen, Inbox, LayoutGrid, LibraryBig, Link2, Mail, MessageSquareWarning, PieChart, TrendingUp } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";
import { tableroTramites, tableroContratos } from "@/lib/tablero-general";
import { estiloEstado } from "@/lib/estados-expediente-estilo";
import { ETIQUETA_ETAPA } from "@/lib/contratacion-etiquetas";
import { LineasMensuales } from "@/components/charts/LineasMensuales";
import { Dona } from "@/components/charts/Dona";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { obtenerSeccionesAlertas } from "@/lib/alertas-landing";
import { obtenerAgendaUsuario } from "@/lib/agenda-landing";
import { FilaTablero, Indicador, ListaTablero, TarjetaTablero } from "@/components/tablero";
import { MarcoDashboard, RejillaIndicadores, RejillaTarjetas } from "@/components/inicio/BarraDashboard";
import { tablerosDeModulo } from "@/lib/tableros";
import type { SeccionAlertasModulo } from "@/lib/alertas-landing";
import { sumarDias } from "@/lib/planeador";
import { MiniPlaneador } from "@/components/inicio/MiniPlaneador";
import { BandejaPendientes } from "@/components/inicio/BandejaPendientes";
import { MisContratos, SeguimientoContratos } from "@/components/inicio/MisContratos";
import { SolicitarVinculacion } from "@/components/VinculacionContratista";
import { debeOfrecerVinculacion } from "@/lib/contratacion";
import { obtenerContratosLanding, obtenerSeguimientoContratos, veSeguimientoContratos } from "@/lib/contratos-landing";

const ICONO_MODULO: Record<string, typeof Inbox> = {
  "/tramites-ambientales": FileBadge,
  "/contratacion/panel": Briefcase,
  "/correspondencia/panel": Mail,
  "/vital/dashboard": Link2,
  "/historico": Archive,
};

const NOMBRE_CORTO: Record<SeccionAlertasModulo["modulo"], string> = { TRAMITES: "Trámites 2.0", GECON: "GECON", SGDEA: "SGDEA" };

const COLOR_ETAPA: Record<string, string> = { PRECONTRACTUAL: "#2a78d6", CONTRACTUAL: "#d16f00", POSTCONTRACTUAL: "#4a3aa7" };

const SERIES_EVOLUCION = [
  { nombre: "Radicados", color: "#2a78d6" },
  { nombre: "Cerrados", color: "#d16f00" },
];

const TONO_SECCION: Record<SeccionAlertasModulo["modulo"], "cdmb" | "ambar" | "cielo"> = { TRAMITES: "cdmb", GECON: "ambar", SGDEA: "cielo" };

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  const general = vista === "general";
  const session = await getSession();
  if (!session) redirect("/login");

  const [secciones, permisos] = await Promise.all([obtenerSeccionesAlertas(session), obtenerPermisosUsuario(session.userId)]);
  const conTramites = secciones.some((s) => s.modulo === "TRAMITES");
  const planificador = puedePlanearVisitas(permisos);
  const conGecon = permisos.modulos.has("GECON");
  const [agenda, misContratos, seguimiento, tramites, contratosPorEtapa] = await Promise.all([
    conTramites ? obtenerAgendaUsuario(session.userId, planificador) : Promise.resolve(null),
    conGecon ? obtenerContratosLanding(session.userId, permisos) : Promise.resolve({ contratos: [], terminados: 0 }),
    conGecon && veSeguimientoContratos(permisos) ? obtenerSeguimientoContratos(permisos) : Promise.resolve(null),
    general && permisos.modulos.has("TRAMITES") ? tableroTramites(permisos) : Promise.resolve(null),
    general && conGecon && veSeguimientoContratos(permisos) ? tableroContratos() : Promise.resolve(null),
  ]);
  const contratos = misContratos.contratos;
  const contratosPropios = contratos.filter((c) => c.relacion === "CONTRATISTA").length;
  const ofrecerVinculacion = await debeOfrecerVinculacion(session.userId);

  const totalGeneral = secciones.reduce((acc, s) => acc + s.total, 0);
  const hoy = agenda?.hoy;
  const visitasHoy = agenda ? agenda.visitas.filter((v) => v.dia === hoy && v.estado === "PROGRAMADA").length : 0;
  const visitasSemana = agenda && hoy ? agenda.visitas.filter((v) => v.dia >= hoy && v.dia < sumarDias(hoy, 7) && v.estado === "PROGRAMADA").length : 0;
  const modulos = tablerosDeModulo(permisos);

  return (
    <MarcoDashboard
      actual={general ? "/dashboard" : "/"}
      derecha={
        general ? undefined : (
        <p className="text-sm text-stone-500">
          {secciones.length === 0
            ? "Sin acceso a módulos. Si debería tenerlo, contacte a un administrador."
            : totalGeneral === 0
              ? "Sin pendientes en sus módulos."
              : `${totalGeneral.toLocaleString("es-CO")} pendiente${totalGeneral === 1 ? "" : "s"} entre sus módulos.`}
        </p>
        )
      }
    >

      {general ? (
        <>
          <RejillaIndicadores>
            <Indicador icon={Inbox} valor={totalGeneral} etiqueta="Pendientes" tono="acento" />
            {secciones.map((s) => (
              <Indicador key={s.modulo} icon={Inbox} valor={s.total} etiqueta={`Pendientes ${NOMBRE_CORTO[s.modulo]}`} tono={TONO_SECCION[s.modulo]} href={s.masLink} />
            ))}
            {tramites && (
              <>
                <Indicador icon={FolderOpen} valor={tramites.enCurso} etiqueta="Expedientes en curso" tono="verde" href="/expedientes" />
                <Indicador icon={MessageSquareWarning} valor={tramites.informacion} etiqueta="Esperando información" tono="rojo" href="/expedientes?estado=INFORMACION_ADICIONAL_REQUERIDA" />
                <Indicador icon={CircleCheck} valor={tramites.resueltos} etiqueta="Expedientes resueltos" tono="neutro" href="/expedientes" />
              </>
            )}
            {seguimiento && <Indicador icon={Briefcase} valor={seguimiento.enEjecucion} etiqueta="Contratos en ejecución" tono="violeta" href="/contratacion/panel" />}
            {agenda && <Indicador icon={CalendarCheck} valor={visitasHoy} etiqueta="Visitas hoy" tono="cdmb" href="/planeador" />}
            {agenda && <Indicador icon={CalendarDays} valor={visitasSemana} etiqueta="Visitas próximos 7 días" tono="cielo" href="/planeador" />}
          </RejillaIndicadores>

          <RejillaTarjetas>
            {tramites && (
              <>
                <TarjetaTablero className="lg:col-span-8" icon={TrendingUp} tono="acento" titulo="Evolución de expedientes en los últimos 12 meses" descripcion="Radicados y cerrados por mes, Trámites ambientales 2.0.">
                  <LineasMensuales series={SERIES_EVOLUCION} datos={tramites.evolucion} vacio="Sin expedientes radicados en los últimos 12 meses." />
                </TarjetaTablero>
                <TarjetaTablero className="lg:col-span-4" icon={PieChart} tono="cielo" titulo="Expedientes por estado" contador={tramites.total}>
                  <Dona
                    unidad="expedientes"
                    vacio="Sin expedientes."
                    segmentos={tramites.porEstado.map((e) => ({
                      etiqueta: estiloEstado(e.clave).etiqueta,
                      valor: e.valor,
                      color: estiloEstado(e.clave).color,
                      href: `/expedientes?estado=${e.clave}`,
                    }))}
                  />
                </TarjetaTablero>
                <TarjetaTablero className="lg:col-span-4" icon={LibraryBig} titulo="Trámites más solicitados" descripcion="Expedientes por tipo de trámite.">
                  <BarChartHorizontal data={tramites.porTramite} emptyMessage="Sin expedientes." />
                </TarjetaTablero>
              </>
            )}
            {contratosPorEtapa && (
              <TarjetaTablero className="lg:col-span-4" icon={Briefcase} tono="violeta" titulo="Contratos por etapa">
                <Dona
                  unidad="contratos"
                  vacio="Sin contratos abiertos."
                  segmentos={contratosPorEtapa.map((e) => ({
                    etiqueta: ETIQUETA_ETAPA[e.clave as keyof typeof ETIQUETA_ETAPA] ?? e.clave,
                    valor: e.valor,
                    color: COLOR_ETAPA[e.clave] ?? "#76847a",
                    href: `/contratacion/expedientes?etapa=${e.clave}`,
                  }))}
                />
              </TarjetaTablero>
            )}
            {modulos.length > 0 && (
              <TarjetaTablero className="lg:col-span-4" icon={LayoutGrid} tono="neutro" titulo="Tableros de módulo" sinRelleno>
                <ListaTablero>
                  {modulos.map((m) => (
                    <FilaTablero key={m.href} href={m.href} icon={ICONO_MODULO[m.href]} titulo={m.label} />
                  ))}
                </ListaTablero>
              </TarjetaTablero>
            )}
          </RejillaTarjetas>
        </>
      ) : (
        <>
          {secciones.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              {contratosPropios > 0 && <Indicador icon={Briefcase} valor={contratosPropios} etiqueta={contratosPropios === 1 ? "Contrato vigente" : "Contratos vigentes"} tono="ambar" />}
              {seguimiento && <Indicador icon={Briefcase} valor={seguimiento.enEjecucion} etiqueta="Contratos en ejecución" tono="ambar" />}
              <Indicador icon={Inbox} valor={totalGeneral} etiqueta="Pendientes" tono="acento" />
              {agenda && <Indicador icon={CalendarCheck} valor={visitasHoy} etiqueta="Visitas hoy" tono="cdmb" />}
              {agenda && <Indicador icon={CalendarDays} valor={visitasSemana} etiqueta="Próximos 7 días" tono="cielo" />}
            </div>
          )}

          {ofrecerVinculacion && <SolicitarVinculacion />}

          {seguimiento && <SeguimientoContratos datos={seguimiento} />}

          {(contratos.length > 0 || misContratos.terminados > 0) && <MisContratos contratos={contratos} terminados={misContratos.terminados} />}

          {secciones.length > 0 && <BandejaPendientes secciones={secciones} />}

          {agenda && <MiniPlaneador agenda={agenda} planificador={planificador} />}
        </>
      )}
    </MarcoDashboard>
  );
}
