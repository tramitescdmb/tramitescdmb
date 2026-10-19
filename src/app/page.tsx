import { redirect } from "next/navigation";
import { Archive, Briefcase, CalendarCheck, CalendarDays, CircleCheck, FileBadge, FolderOpen, Inbox, Link2, Mail, MessageSquareWarning } from "lucide-react";
import {
  verificarSesion as getSession,
  obtenerPermisosUsuario,
  puedePlanearVisitas,
  puedeAccederSeccion,
  puedeAccederCorrespondencia,
  puedeAccederContratacion,
  type PermisosUsuario,
} from "@/lib/permisos";
import { sincaConfigurado } from "@/lib/sinca";
import { db } from "@/lib/db";
import { obtenerSeccionesAlertas } from "@/lib/alertas-landing";
import { obtenerAgendaUsuario } from "@/lib/agenda-landing";
import { BandaTablero, FilaTablero, Indicador, ListaTablero, TarjetaTablero } from "@/components/tablero";
import { SelectorTablero, type OpcionTablero } from "@/components/inicio/SelectorTablero";
import type { SeccionAlertasModulo } from "@/lib/alertas-landing";
import { sumarDias } from "@/lib/planeador";
import { MiniPlaneador } from "@/components/inicio/MiniPlaneador";
import { BandejaPendientes } from "@/components/inicio/BandejaPendientes";
import { MisContratos, SeguimientoContratos } from "@/components/inicio/MisContratos";
import { SolicitarVinculacion } from "@/components/VinculacionContratista";
import { debeOfrecerVinculacion } from "@/lib/contratacion";
import { obtenerContratosLanding, obtenerSeguimientoContratos, veSeguimientoContratos } from "@/lib/contratos-landing";

function tablerosDeModulo(permisos: PermisosUsuario): OpcionTablero[] {
  const grupo = "Tableros de módulo";
  return [
    ...(permisos.modulos.has("TRAMITES") ? [{ href: "/tramites-ambientales", label: "Trámites ambientales 2.0", grupo }] : []),
    ...(puedeAccederContratacion(permisos) ? [{ href: "/contratacion/panel", label: "GECON", grupo }] : []),
    ...(puedeAccederCorrespondencia(permisos) ? [{ href: "/correspondencia/panel", label: "SGDEA CDMB", grupo }] : []),
    ...(puedeAccederSeccion(permisos, "VITAL_DASHBOARD") ? [{ href: "/vital/dashboard", label: "VITAL", grupo }] : []),
    ...(sincaConfigurado() && puedeAccederSeccion(permisos, "SINCA_DASHBOARD") ? [{ href: "/historico", label: "SINCA 1.0", grupo }] : []),
  ];
}

const ICONO_MODULO: Record<string, typeof Inbox> = {
  "/tramites-ambientales": FileBadge,
  "/contratacion/panel": Briefcase,
  "/correspondencia/panel": Mail,
  "/vital/dashboard": Link2,
  "/historico": Archive,
};

const NOMBRE_CORTO: Record<SeccionAlertasModulo["modulo"], string> = { TRAMITES: "Trámites 2.0", GECON: "GECON", SGDEA: "SGDEA" };

const TONO_SECCION: Record<SeccionAlertasModulo["modulo"], "cdmb" | "ambar" | "cielo"> = { TRAMITES: "cdmb", GECON: "ambar", SGDEA: "cielo" };

async function resumenTramites(permisos: PermisosUsuario) {
  const filtro = permisos.esAdmin ? {} : { tramiteTipoId: { in: Array.from(permisos.tramites.keys()) } };
  const [enCurso, informacion, resueltos] = await Promise.all([
    db.expediente.count({ where: { ...filtro, estado: { in: ["RADICADO", "EN_TRAMITE"] } } }),
    db.expediente.count({ where: { ...filtro, estado: { in: ["INFORMACION_ADICIONAL_REQUERIDA", "SUSPENDIDO"] } } }),
    db.expediente.count({ where: { ...filtro, estado: { in: ["APROBADO", "NEGADO"] } } }),
  ]);
  return { enCurso, informacion, resueltos };
}

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  const general = vista === "general";
  const session = await getSession();
  if (!session) redirect("/login");

  const [secciones, permisos] = await Promise.all([obtenerSeccionesAlertas(session), obtenerPermisosUsuario(session.userId)]);
  const conTramites = secciones.some((s) => s.modulo === "TRAMITES");
  const planificador = puedePlanearVisitas(permisos);
  const conGecon = permisos.modulos.has("GECON");
  const [agenda, misContratos, seguimiento, tramites] = await Promise.all([
    conTramites ? obtenerAgendaUsuario(session.userId, planificador) : Promise.resolve(null),
    conGecon ? obtenerContratosLanding(session.userId, permisos) : Promise.resolve({ contratos: [], terminados: 0 }),
    conGecon && veSeguimientoContratos(permisos) ? obtenerSeguimientoContratos(permisos) : Promise.resolve(null),
    general && permisos.modulos.has("TRAMITES") ? resumenTramites(permisos) : Promise.resolve(null),
  ]);
  const contratos = misContratos.contratos;
  const contratosPropios = contratos.filter((c) => c.relacion === "CONTRATISTA").length;
  const ofrecerVinculacion = await debeOfrecerVinculacion(session.userId);

  const totalGeneral = secciones.reduce((acc, s) => acc + s.total, 0);
  const hoy = agenda?.hoy;
  const visitasHoy = agenda ? agenda.visitas.filter((v) => v.dia === hoy && v.estado === "PROGRAMADA").length : 0;
  const visitasSemana = agenda && hoy ? agenda.visitas.filter((v) => v.dia >= hoy && v.dia < sumarDias(hoy, 7) && v.estado === "PROGRAMADA").length : 0;
  const modulos = tablerosDeModulo(permisos);
  const opciones: OpcionTablero[] = [{ href: "/", label: "Mi trabajo" }, { href: "/?vista=general", label: "General" }, ...modulos];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <BandaTablero className="flex flex-wrap items-center justify-between gap-3 !py-3">
        <SelectorTablero opciones={opciones} actual={general ? "/?vista=general" : "/"} />
        <p className="text-sm text-stone-500">
          {secciones.length === 0
            ? "Sin acceso a módulos. Si debería tenerlo, contacte a un administrador."
            : totalGeneral === 0
              ? "Sin pendientes en sus módulos."
              : `${totalGeneral.toLocaleString("es-CO")} pendiente${totalGeneral === 1 ? "" : "s"} entre sus módulos.`}
        </p>
      </BandaTablero>

      {general ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Indicador icon={Inbox} valor={totalGeneral} etiqueta="Pendientes" tono="acento" />
            {secciones.map((s) => (
              <Indicador key={s.modulo} icon={Inbox} valor={s.total} etiqueta={`Pendientes ${NOMBRE_CORTO[s.modulo]}`} tono={TONO_SECCION[s.modulo]} href={s.masLink} />
            ))}
            {tramites && (
              <>
                <Indicador icon={FolderOpen} valor={tramites.enCurso} etiqueta="Expedientes en curso" tono="verde" href="/expedientes" />
                <Indicador icon={MessageSquareWarning} valor={tramites.informacion} etiqueta="Esperando información" tono="ambar" href="/expedientes" />
                <Indicador icon={CircleCheck} valor={tramites.resueltos} etiqueta="Expedientes resueltos" tono="neutro" href="/expedientes" />
              </>
            )}
            {seguimiento && <Indicador icon={Briefcase} valor={seguimiento.enEjecucion} etiqueta="Contratos en ejecución" tono="violeta" href="/contratacion/panel" />}
            {agenda && <Indicador icon={CalendarCheck} valor={visitasHoy} etiqueta="Visitas hoy" tono="cdmb" href="/planeador" />}
            {agenda && <Indicador icon={CalendarDays} valor={visitasSemana} etiqueta="Visitas próximos 7 días" tono="cielo" href="/planeador" />}
          </div>

          {modulos.length > 0 && (
            <TarjetaTablero titulo="Tableros de módulo" descripcion="Indicadores y gráficas propios de cada módulo." sinRelleno>
              <ListaTablero>
                {modulos.map((m) => (
                  <FilaTablero key={m.href} href={m.href} icon={ICONO_MODULO[m.href]} titulo={m.label} />
                ))}
              </ListaTablero>
            </TarjetaTablero>
          )}
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
    </div>
  );
}
