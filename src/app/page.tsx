import { redirect } from "next/navigation";
import { Briefcase, CalendarCheck, CalendarDays, Inbox, type LucideIcon } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";
import { obtenerSeccionesAlertas } from "@/lib/alertas-landing";
import { obtenerAgendaUsuario } from "@/lib/agenda-landing";
import { saludo, horaBogota } from "@/lib/saludo";
import { sumarDias } from "@/lib/planeador";
import { MiniPlaneador } from "@/components/inicio/MiniPlaneador";
import { BandejaPendientes } from "@/components/inicio/BandejaPendientes";
import { MisContratos, SeguimientoContratos } from "@/components/inicio/MisContratos";
import { SolicitarVinculacion } from "@/components/VinculacionContratista";
import { debeOfrecerVinculacion } from "@/lib/contratacion";
import { obtenerContratosLanding, obtenerSeguimientoContratos, veSeguimientoContratos } from "@/lib/contratos-landing";

function Indicador({ icon: Icon, valor, etiqueta, tono }: { icon: LucideIcon; valor: number; etiqueta: string; tono: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/80 px-4 py-2.5 ring-1 ring-stone-200/70 backdrop-blur">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tono}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span>
        <span className="block text-lg font-semibold leading-none text-stone-900">{valor}</span>
        <span className="text-xs text-stone-500">{etiqueta}</span>
      </span>
    </div>
  );
}

export default async function LandingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [secciones, permisos] = await Promise.all([obtenerSeccionesAlertas(session), obtenerPermisosUsuario(session.userId)]);
  const conTramites = secciones.some((s) => s.modulo === "TRAMITES");
  const planificador = puedePlanearVisitas(permisos);
  const conGecon = permisos.modulos.has("GECON");
  const [agenda, contratos, seguimiento] = await Promise.all([
    conTramites ? obtenerAgendaUsuario(session.userId, planificador) : Promise.resolve(null),
    conGecon ? obtenerContratosLanding(session.userId, permisos) : Promise.resolve([]),
    conGecon && veSeguimientoContratos(permisos) ? obtenerSeguimientoContratos(permisos) : Promise.resolve(null),
  ]);
  const contratosPropios = contratos.filter((c) => c.relacion === "CONTRATISTA").length;
  const ofrecerVinculacion = await debeOfrecerVinculacion(session.userId);

  const primerNombre = session.nombre.trim().split(/\s+/)[0];
  const totalGeneral = secciones.reduce((acc, s) => acc + s.total, 0);
  const hoy = agenda?.hoy;
  const visitasHoy = agenda ? agenda.visitas.filter((v) => v.dia === hoy && v.estado === "PROGRAMADA").length : 0;
  const visitasSemana = agenda && hoy ? agenda.visitas.filter((v) => v.dia >= hoy && v.dia < sumarDias(hoy, 7) && v.estado === "PROGRAMADA").length : 0;
  const fechaLarga = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-cdmb-100 bg-gradient-to-br from-cdmb-50 via-white to-acento-50/60 px-6 py-5 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-cdmb-700">{fechaLarga}</p>
            <h1 className="mt-1 text-2xl font-semibold text-stone-900">
              {saludo(horaBogota())}
              {primerNombre ? `, ${primerNombre}` : ""}
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {secciones.length === 0
                ? "Aún no tiene acceso a ningún módulo. Si debería tenerlo, contacte a un administrador."
                : totalGeneral === 0
                  ? "Sin pendientes en sus módulos."
                  : `${totalGeneral} pendiente${totalGeneral === 1 ? "" : "s"} entre sus módulos.`}
            </p>
          </div>
          {secciones.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {contratosPropios > 0 && <Indicador icon={Briefcase} valor={contratosPropios} etiqueta={contratosPropios === 1 ? "Contrato vigente" : "Contratos vigentes"} tono="bg-amber-100 text-amber-700" />}
              {seguimiento && <Indicador icon={Briefcase} valor={seguimiento.enEjecucion} etiqueta="Contratos en ejecución" tono="bg-amber-100 text-amber-700" />}
              <Indicador icon={Inbox} valor={totalGeneral} etiqueta="Pendientes" tono="bg-acento-100 text-acento-700" />
              {agenda && <Indicador icon={CalendarCheck} valor={visitasHoy} etiqueta="Visitas hoy" tono="bg-cdmb-100 text-cdmb-700" />}
              {agenda && <Indicador icon={CalendarDays} valor={visitasSemana} etiqueta="Próximos 7 días" tono="bg-sky-100 text-sky-700" />}
            </div>
          )}
        </div>
      </header>

      {ofrecerVinculacion && <SolicitarVinculacion />}

      {seguimiento && <SeguimientoContratos datos={seguimiento} />}

      {contratos.length > 0 && <MisContratos contratos={contratos} />}

      {secciones.length > 0 && <BandejaPendientes secciones={secciones} />}

      {agenda && <MiniPlaneador agenda={agenda} planificador={planificador} />}
    </div>
  );
}
