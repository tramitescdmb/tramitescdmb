import Link from "next/link";
import { IconUser, IconLock, IconShieldCheck } from "@/components/icons";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { directorioActivoConfigurado } from "@/lib/directorio-activo";

const ERRORES: Record<string, string> = {
  "Correo y contraseña son obligatorios.": "Correo y contraseña son obligatorios.",
  "Credenciales inválidas.": "Usuario o contraseña incorrectos.",
};

const inputCls =
  "w-full rounded-xl border border-graphite-200 bg-white px-3.5 py-2.5 text-sm text-graphite-800 placeholder:text-graphite-400 " +
  "transition-shadow focus:border-cdmb-500 focus:outline-none focus:ring-4 focus:ring-cdmb-500/15";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; modo?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? ERRORES[params.error] ?? params.error : null;
  const next = params.next ?? "/";
  // Por defecto se ofrece el directorio activo de la CDMB (la mayoría de los
  // funcionarios); la cuenta institucional queda como segunda opción.
  const modo = params.modo === "institucional" ? "institucional" : "directorio-activo";
  const config = await getConfiguracionSitio();
  const hayDirectorioActivo = directorioActivoConfigurado();

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-soft-lg lg:grid-cols-5">
        {/* Panel izquierdo — presencia de marca, en el verde institucional (identidad de la CDMB). */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-cdmb-800 p-10 text-white lg:col-span-2 lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, white 0, transparent 45%), radial-gradient(circle at 85% 75%, white 0, transparent 40%)",
            }}
          />
          <div className="relative">
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt="CDMB" className="h-9 w-auto brightness-0 invert" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur">
                C
              </span>
            )}
          </div>
          <div className="relative space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cdmb-200">Plataforma unificada</p>
            <h2 className="text-2xl font-semibold leading-snug">
              Trámites ambientales, correspondencia y consulta histórica en un solo lugar.
            </h2>
            <p className="text-sm text-cdmb-100/90">
              Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga.
            </p>
          </div>
        </div>

        {/* Formulario */}
        <div className="p-8 sm:p-10 lg:col-span-3">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt="CDMB" className="h-8 w-auto" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cdmb-600 text-base font-bold text-white">
                C
              </span>
            )}
            <span className="font-semibold text-graphite-900">Trámites CDMB</span>
          </div>

          <div className="mb-7">
            <h1 className="text-xl font-semibold tracking-tight text-graphite-900">Ingresar</h1>
            <p className="mt-1 text-sm text-graphite-500">Acceso de funcionarios de la CDMB.</p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
          )}

          <form action="/api/auth/login" method="post" className="space-y-4">
            <input type="hidden" name="next" value={next} />

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-graphite-700">
                <IconUser className="h-4 w-4 text-graphite-400" aria-hidden />
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
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-graphite-700">
                <IconLock className="h-4 w-4 text-graphite-400" aria-hidden />
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
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-graphite-700">
                  <IconShieldCheck className="h-4 w-4 text-graphite-400" aria-hidden />
                  Tipo de conexión
                </label>
                <select name="modo" defaultValue={modo} className={`${inputCls} bg-white`}>
                  <option value="directorio-activo">Directorio activo CDMB</option>
                  <option value="institucional">Cuenta institucional</option>
                </select>
                <p className="mt-1.5 text-xs leading-relaxed text-graphite-400">
                  <strong className="text-graphite-500">Directorio activo CDMB:</strong> usuario y contraseña de la red de
                  la Corporación. <strong className="text-graphite-500">Cuenta institucional:</strong> contraseña
                  administrada en esta aplicación.
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

          <p className="mt-6 border-t border-graphite-100 pt-5 text-center text-xs leading-relaxed text-graphite-500">
            ¿Es ciudadano y quiere radicar una petición, queja, reclamo, sugerencia o denuncia?{" "}
            <Link href="/pqrsd" className="font-medium text-cdmb-700 hover:underline">
              Hágalo aquí, sin necesidad de iniciar sesión
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
