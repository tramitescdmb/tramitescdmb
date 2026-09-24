import Link from "next/link";
import { IconUser, IconLock, IconShieldCheck } from "@/components/icons";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { directorioActivoConfigurado } from "@/lib/directorio-activo";

const ERRORES: Record<string, string> = {
  "Correo y contraseña son obligatorios.": "Correo y contraseña son obligatorios.",
  "Credenciales inválidas.": "Usuario o contraseña incorrectos.",
};

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 " +
  "transition-shadow focus:border-cdmb-500 focus:outline-none focus:ring-4 focus:ring-cdmb-500/15";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; modo?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? ERRORES[params.error] ?? params.error : null;
  const next = params.next ?? "/";
  const modo = params.modo === "institucional" ? "institucional" : "directorio-activo";
  const config = await getConfiguracionSitio();
  const hayDirectorioActivo = directorioActivoConfigurado();

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-stone-100 bg-white p-8 shadow-soft">
        <div className="mb-6 text-center">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="CDMB" className="mx-auto mb-3 h-10 w-auto" />
          ) : (
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cdmb-600 text-lg font-bold text-white">
              C
            </span>
          )}
          <h1 className="text-lg font-semibold tracking-tight text-stone-900">Trámites CDMB</h1>
          <p className="text-sm text-stone-500">Ingreso de funcionarios de la CDMB</p>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>}

        <form action="/api/auth/login" method="post" className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <IconUser className="h-4 w-4 text-cdmb-600" aria-hidden />
              Usuario o correo
            </label>
            <input
              type="text"
              name="email"
              required
              autoFocus
              autoComplete="username"
              className={inputCls}
              placeholder="usuario o nombre@cdmb.gov.co"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <IconLock className="h-4 w-4 text-cdmb-600" aria-hidden />
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className={inputCls}
              placeholder="••••••••"
            />
          </div>

          {hayDirectorioActivo && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-stone-700">
                <IconShieldCheck className="h-4 w-4 text-cdmb-600" aria-hidden />
                Tipo de conexión
              </label>
              <select name="modo" defaultValue={modo} className={inputCls}>
                <option value="directorio-activo">Directorio activo CDMB</option>
                <option value="institucional">Cuenta institucional</option>
              </select>
              <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
                <strong>Directorio activo CDMB:</strong> usuario y contraseña de la red de la Corporación.{" "}
                <strong>Cuenta institucional:</strong> contraseña administrada en esta aplicación.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-cdmb-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cdmb-700 hover:shadow-md active:scale-[0.99]"
          >
            Ingresar
          </button>
        </form>

        <p className="mt-5 border-t border-stone-100 pt-4 text-center text-xs text-stone-500">
          ¿Es ciudadano y quiere radicar una petición, queja, reclamo, sugerencia o denuncia?{" "}
          <Link href="/pqrsd" className="font-medium text-cdmb-700 hover:underline">
            Hágalo aquí, sin necesidad de iniciar sesión
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
