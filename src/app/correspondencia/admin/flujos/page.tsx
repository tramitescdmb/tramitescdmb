import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Workflow, Plus, Download, ChevronRight, CheckCircle2, CircleDashed } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";
import { listarFlujos, puedeAdministrarFlujos, ETIQUETA_APLICA_A } from "@/lib/flujos";
import { registrarAccesoDenegadoSeccion } from "@/lib/auditoria-doc";
import { Field, SectionHelp } from "@/components/Field";
import { TituloSeccion, EstadoVacio } from "@/components/sgdea/ui";

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export default async function FlujosPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujos(permisos)) {
    await registrarAccesoDenegadoSeccion("Flujos de trabajo", session, await headers());
    redirect("/correspondencia");
  }

  const sp = await searchParams;
  const flujos = await listarFlujos();

  return (
    <div className="space-y-6">
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <div className="space-y-2">
        <TituloSeccion icon={Workflow}>Flujos de trabajo</TituloSeccion>
        <SectionHelp>
          Un flujo define los <strong>pasos</strong> por los que pasa una comunicación, quién es responsable de cada
          uno y a dónde va después de cada paso. Lo arma el administrador aquí — no está fijo en el código
          (MoReq cap. 7). Una vez activo, se puede <strong>aplicar</strong> a una comunicación desde su detalle y
          desde ahí se va avanzando paso a paso, con constancia en la bitácora.
        </SectionHelp>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action="/api/correspondencia/flujos" method="post">
          <input type="hidden" name="accion" value="cargar-plantillas" />
          <button className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            <Download className="h-3.5 w-3.5" aria-hidden />
            Cargar flujos de plantilla
          </button>
        </form>
        <span className="text-xs text-stone-400">
          Precarga 4 flujos típicos (PQRSD con visto bueno, oficio con revisión, memorando, ruta genérica) para editarlos y activarlos.
        </span>
      </div>

      <details className="rounded-xl border border-stone-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">Crear un flujo desde cero</summary>
        <form action="/api/correspondencia/flujos" method="post" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input type="hidden" name="accion" value="crear" />
          <div className="sm:col-span-2">
            <Field label="Nombre" required>
              <input name="nombre" className={inputCls} placeholder="Ej. Concepto técnico de una solicitud" required />
            </Field>
          </div>
          <Field label="Aplica a" help="Limita el flujo a un tipo de comunicación, o déjalo en cualquiera.">
            <select name="aplicaA" className={inputCls} defaultValue="">
              {Object.entries(ETIQUETA_APLICA_A).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-3">
            <Field label="Descripción" help="Para qué sirve este flujo — opcional.">
              <input name="descripcion" className={inputCls} placeholder="Opcional" />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <button className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Crear flujo
            </button>
          </div>
        </form>
      </details>

      {flujos.length === 0 ? (
        <EstadoVacio icon={Workflow}>Todavía no hay flujos. Cargue las plantillas o cree uno desde cero.</EstadoVacio>
      ) : (
        <div className="space-y-2">
          {flujos.map((f) => (
            <Link
              key={f.id}
              href={`/correspondencia/admin/flujos/${f.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-stone-800">
                  {f.activo ? (
                    <CheckCircle2 className="h-4 w-4 flex-none text-emerald-600" aria-hidden />
                  ) : (
                    <CircleDashed className="h-4 w-4 flex-none text-stone-400" aria-hidden />
                  )}
                  {f.nombre}
                  {f.esPlantilla && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-500">Plantilla</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${f.activo ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                    {f.activo ? "Activo" : "Inactivo"}
                  </span>
                </p>
                {f.descripcion && <p className="mt-0.5 truncate text-xs text-stone-500">{f.descripcion}</p>}
                <p className="mt-1 text-[11px] text-stone-400">
                  {ETIQUETA_APLICA_A[f.aplicaA ?? ""]} · {f._count.pasos} paso{f._count.pasos === 1 ? "" : "s"} ·{" "}
                  {f._count.instancias} aplicación{f._count.instancias === 1 ? "" : "es"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 flex-none text-stone-400" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
