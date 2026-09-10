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
        <h1 className="text-xl font-semibold text-stone-900">Seguridad</h1>
        <p className="text-sm text-stone-500">
          Acceso, contraseñas y formatos de archivo permitidos — para toda la aplicación, no solo Correspondencia.
        </p>
      </div>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <SectionHelp>
        Bloqueo temporal tras exceder los intentos fallidos, en cuenta institucional y directorio activo.
      </SectionHelp>

      <form action="/api/configuracion-seguridad" method="post" className="space-y-6">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">Disponibilidad de módulos</h2>
          <SectionHelp>
            Mientras un módulo esté oculto, solo un administrador lo ve y puede entrar — sirve para tenerlo en
            marcha sin que los funcionarios lo usen hasta que esté listo.
          </SectionHelp>
          <label className="mt-3 flex items-start gap-2 text-sm text-stone-700">
            <input type="checkbox" name="sgdeaVisibleFuncionarios" defaultChecked={config.sgdeaVisibleFuncionarios} className="mt-0.5 rounded border-stone-300" />
            <span>
              <strong>SGDEA — Correspondencia y Archivo</strong> visible para los funcionarios
              <span className="mt-0.5 block text-xs text-stone-400">
                Desmarcado: el módulo desaparece del menú y se bloquea el acceso para todos menos administradores,
                incluidos quienes ya tienen un rol de correspondencia asignado.
              </span>
            </span>
          </label>
        </div>

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
            Aplica al crear o restablecer una contraseña — no revisa retroactivamente las existentes. Las
            obviamente débiles (ej. &quot;12345678&quot;) se rechazan siempre, sin importar esta configuración.
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
            <Field
              label="Vigencia mínima en días"
              help="0 desactiva. Evita ciclar contraseñas para saltarse el histórico; no aplica a un restablecimiento por administrador."
            >
              <input type="number" name="passwordVigenciaMinimaDias" min={0} max={365} defaultValue={config.passwordVigenciaMinimaDias} className={inputCls} />
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

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">Formatos de archivo permitidos</h2>
          <SectionHelp>
            Formatos aceptados al subir un documento, en toda la aplicación. Separados por coma o espacio, sin
            el punto (<span className="font-mono">pdf, jpg, docx</span>) — exigidos por el servidor, no solo
            sugeridos por el navegador. Vacío restablece los valores de fábrica.
          </SectionHelp>
          <div className="mt-3">
            <Field label="Extensiones permitidas">
              <input
                type="text"
                name="extensionesPermitidas"
                defaultValue={config.extensionesPermitidas.join(", ")}
                placeholder="pdf, jpg, jpeg, png, doc, docx, xls, xlsx"
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
          Guardar
        </button>
      </form>
    </div>
  );
}
