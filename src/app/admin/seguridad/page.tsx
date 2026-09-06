import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { Field, SectionHelp } from "@/components/Field";

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export default async function SeguridadPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const config = await getConfiguracionSitio();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Seguridad de acceso</h1>
        <p className="text-sm text-stone-500">
          Límite de intentos fallidos al iniciar sesión, para todas las cuentas de la aplicación.
        </p>
      </div>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <SectionHelp>
        Si alguien falla al escribir la contraseña más veces de las permitidas, esa cuenta queda bloqueada para
        nuevos intentos durante la ventana de tiempo indicada — no es un bloqueo permanente, solo hay que esperar.
        Esto aplica al ingreso con cuenta institucional y por directorio activo.
      </SectionHelp>

      <form action="/api/configuracion-seguridad" method="post" className="grid grid-cols-1 gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
        <Field label="Intentos fallidos permitidos" help="Entre 3 y 20.">
          <input type="number" name="loginMaxIntentos" min={3} max={20} defaultValue={config.loginMaxIntentos} required className={inputCls} />
        </Field>
        <Field label="Minutos de espera" help="Entre 1 y 120.">
          <input type="number" name="loginVentanaMinutos" min={1} max={120} defaultValue={config.loginVentanaMinutos} required className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
