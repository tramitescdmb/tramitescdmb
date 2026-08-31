import { IconMail, IconLock, IconUser, IconBuilding } from "@/components/icons";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { directorioActivoConfigurado } from "@/lib/directorio-activo";

const ERRORES: Record<string, string> = {
  "Correo y contraseña son obligatorios.": "Correo y contraseña son obligatorios.",
  "Credenciales inválidas.": "Correo o contraseña incorrectos.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; modo?: string }>;
}) {
  const params = await searchParams;
  const mensajeError = params.error ? ERRORES[params.error] ?? params.error : null;
  const errorDirectorioActivo = params.modo === "directorio-activo" ? mensajeError : null;
  const errorContrasena = params.modo === "directorio-activo" ? null : mensajeError;
  const next = params.next ?? "/";
  const config = await getConfiguracionSitio();
  const directorioActivoListo = directorioActivoConfigurado();

  return (
    <div className="flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt="CDMB" className="mx-auto mb-3 h-10 w-auto" />
            ) : (
              <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-cdmb-600 text-lg font-bold text-white">
                C
              </span>
            )}
            <h1 className="text-lg font-semibold text-stone-900">Trámites CDMB</h1>
            <p className="text-sm text-stone-500">Ingreso con cuenta institucional</p>
          </div>

          {errorContrasena && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorContrasena}</div>
          )}

          <form action="/api/auth/login" method="post" className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
                <IconMail className="h-4 w-4 text-cdmb-600" aria-hidden />
                Correo
              </label>
              <input
                type="email"
                name="email"
                required
                autoFocus
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
                placeholder="nombre@cdmb.gov.co"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
                <IconLock className="h-4 w-4 text-cdmb-600" aria-hidden />
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                required
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
            >
              Ingresar
            </button>
          </form>
          <p className="mt-3 text-xs text-stone-400">
            Ingreso con la contraseña administrada dentro de esta aplicación.
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
              <IconBuilding className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Conexión por directorio activo CDMB</h2>
              <p className="text-xs text-stone-500">Con el usuario y la contraseña de la red de la Corporación.</p>
            </div>
          </div>

          {!directorioActivoListo && (
            <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Esta forma de ingreso todavía no está habilitada en este servidor. El administrador del
              sistema debe configurar la conexión con el directorio activo de la CDMB.
            </div>
          )}

          {errorDirectorioActivo && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorDirectorioActivo}</div>
          )}

          <form action="/api/auth/login-directorio-activo" method="post" className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
                <IconUser className="h-4 w-4 text-cdmb-600" aria-hidden />
                Usuario de red
              </label>
              <input
                type="text"
                name="usuario"
                required
                autoComplete="username"
                disabled={!directorioActivoListo}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500 disabled:bg-stone-50 disabled:text-stone-400"
                placeholder="usuario"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
                <IconLock className="h-4 w-4 text-cdmb-600" aria-hidden />
                Contraseña de red
              </label>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                disabled={!directorioActivoListo}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500 disabled:bg-stone-50 disabled:text-stone-400"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={!directorioActivoListo}
              className="w-full rounded-md border border-cdmb-600 bg-white px-4 py-2 text-sm font-medium text-cdmb-700 hover:bg-cdmb-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400 disabled:hover:bg-white"
            >
              Ingresar por directorio activo
            </button>
          </form>
          <p className="mt-3 text-xs text-stone-400">
            La contraseña se valida contra el directorio activo de la CDMB y no se almacena en esta
            aplicación. La primera vez que ingrese se creará su cuenta con perfil de funcionario; un
            administrador podrá asignarle el cargo correspondiente.
          </p>
        </div>
      </div>
    </div>
  );
}
