import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { db } from "@/lib/db";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { estadoVigenciaPassword, puedeCambiarPorVigenciaMinima } from "@/lib/password-policy";
import { Field, SectionHelp } from "@/components/Field";
import { denominacionParaFirma, SEXOS } from "@/lib/denominacion-empleo";

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export default async function MiCuentaPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const [usuario, config] = await Promise.all([
    db.usuario.findUnique({ where: { id: session.userId } }),
    getConfiguracionSitio(),
  ]);
  if (!usuario) redirect("/login");

  const vigencia = usuario.directorioActivo ? null : estadoVigenciaPassword(usuario.passwordCambiadaEn, config.passwordVigenciaDias);
  const vigenciaMinima = usuario.directorioActivo
    ? null
    : puedeCambiarPorVigenciaMinima(usuario.passwordCambiadaEn, config.passwordVigenciaMinimaDias);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Mi cuenta</h1>
        <p className="text-sm text-stone-500">Sus datos de ingreso a la aplicación.</p>
      </div>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Nombre</p>
          <p className="text-sm text-stone-800">{usuario.nombre}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Correo</p>
          <p className="text-sm text-stone-800">{usuario.email}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Rol</p>
          <p className="text-sm text-stone-800">{usuario.rol === "ADMIN" ? "Administrador" : "Funcionario"}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Ingreso</p>
          <p className="text-sm text-stone-800">{usuario.directorioActivo ? "Directorio activo CDMB" : "Cuenta institucional"}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">En la firma electrónica</p>
          <p className="text-sm text-stone-800">
            {usuario.nombre}
            {denominacionParaFirma(usuario.denominacionEmpleo, usuario.sexo, usuario.denominacionComplemento)
              ? ` · ${denominacionParaFirma(usuario.denominacionEmpleo, usuario.sexo, usuario.denominacionComplemento)}`
              : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-400">
            {usuario.denominacionEmpleo
              ? `Sexo: ${SEXOS.find((s) => s.valor === usuario.sexo)?.etiqueta ?? "sin especificar"}. La denominación la administra el área de personal.`
              : "Sin denominación del empleo registrada — solicítela al área de personal para que aparezca al pie de sus oficios firmados."}
          </p>
        </div>
      </div>

      {usuario.directorioActivo ? (
        <SectionHelp>
          Contraseña administrada por el directorio activo de la CDMB. Para cambiarla, contacte al área de
          sistemas.
        </SectionHelp>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">Cambiar mi contraseña</h2>
          {vigencia?.diasRestantes !== null && vigencia && (
            <p className={`mt-1 text-xs ${vigencia.vencida ? "text-red-600" : "text-stone-500"}`}>
              {vigencia.vencida
                ? "Su contraseña ya venció — cámbiela ahora."
                : `Su contraseña vence en ${vigencia.diasRestantes} día(s).`}
            </p>
          )}
          {vigenciaMinima && !vigenciaMinima.puede ? (
            <SectionHelp>
              Cambió su contraseña hace poco. Por política de seguridad, podrá volver a cambiarla en{" "}
              {vigenciaMinima.diasFaltantes} día(s).
            </SectionHelp>
          ) : (
            <form action="/api/mi-cuenta/password" method="post" className="mt-3 space-y-4">
              <Field label="Contraseña actual" required>
                <input type="password" name="passwordActual" required autoComplete="current-password" className={inputCls} />
              </Field>
              <Field
                label="Contraseña nueva"
                required
                help={`Mínimo ${config.passwordLongitudMinima} caracteres.`}
              >
                <input
                  type="password"
                  name="passwordNueva"
                  required
                  minLength={config.passwordLongitudMinima}
                  maxLength={config.passwordLongitudMaxima}
                  autoComplete="new-password"
                  className={inputCls}
                />
              </Field>
              <Field label="Confirmar contraseña nueva" required>
                <input
                  type="password"
                  name="passwordConfirmar"
                  required
                  minLength={config.passwordLongitudMinima}
                  maxLength={config.passwordLongitudMaxima}
                  autoComplete="new-password"
                  className={inputCls}
                />
              </Field>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
              >
                Cambiar contraseña
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
