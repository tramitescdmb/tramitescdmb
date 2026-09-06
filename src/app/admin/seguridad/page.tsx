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

      <form action="/api/configuracion-seguridad" method="post" className="space-y-6">
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
          <Field label="Intentos fallidos permitidos" help="Entre 3 y 20.">
            <input type="number" name="loginMaxIntentos" min={3} max={20} defaultValue={config.loginMaxIntentos} required className={inputCls} />
          </Field>
          <Field label="Minutos de espera" help="Entre 1 y 120.">
            <input type="number" name="loginVentanaMinutos" min={1} max={120} defaultValue={config.loginVentanaMinutos} required className={inputCls} />
          </Field>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">Política de contraseñas</h2>
          <SectionHelp>
            Se aplica solo al crear un usuario o al restablecerle la contraseña desde su ficha — no revisa
            retroactivamente las contraseñas que ya existen, porque eso no es posible sobre un hash. Además de estas
            reglas, el sistema siempre rechaza contraseñas obviamente débiles (ej. &quot;12345678&quot;, &quot;cdmb2025&quot;), sin
            importar la configuración.
          </SectionHelp>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Longitud mínima" help="Entre 6 y 64 caracteres.">
              <input type="number" name="passwordLongitudMinima" min={6} max={64} defaultValue={config.passwordLongitudMinima} required className={inputCls} />
            </Field>
            <Field label="Longitud máxima" help="Hasta 128. Bcrypt ignora lo que pase de 72 bytes.">
              <input type="number" name="passwordLongitudMaxima" min={6} max={128} defaultValue={config.passwordLongitudMaxima} required className={inputCls} />
            </Field>
            <Field label="Contraseñas anteriores a recordar" help="0 desactiva la revisión. Máximo 10.">
              <input type="number" name="passwordHistorialCantidad" min={0} max={10} defaultValue={config.passwordHistorialCantidad} required className={inputCls} />
            </Field>
            <Field label="Vigencia en días" help="Vacío o 0 = nunca vence. Se avisa en la ficha del usuario.">
              <input type="number" name="passwordVigenciaDias" min={0} max={3650} defaultValue={config.passwordVigenciaDias ?? ""} className={inputCls} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" name="passwordRequiereMayuscula" defaultChecked={config.passwordRequiereMayuscula} className="rounded border-stone-300" />
              Exigir una mayúscula
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" name="passwordRequiereNumero" defaultChecked={config.passwordRequiereNumero} className="rounded border-stone-300" />
              Exigir un número
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" name="passwordRequiereEspecial" defaultChecked={config.passwordRequiereEspecial} className="rounded border-stone-300" />
              Exigir un carácter especial
            </label>
          </div>
        </div>

        <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
          Guardar
        </button>
      </form>
    </div>
  );
}
