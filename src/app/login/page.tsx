import { IconMail, IconLock } from "@/components/icons";
import { getConfiguracionSitio } from "@/lib/config-sitio";

const ERRORES: Record<string, string> = {
  "Correo y contraseña son obligatorios.": "Correo y contraseña son obligatorios.",
  "Credenciales inválidas.": "Correo o contraseña incorrectos.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? ERRORES[params.error] ?? params.error : null;
  const config = await getConfiguracionSitio();

  return (
    <div className="flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
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

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <form action="/api/auth/login" method="post" className="space-y-4">
          <input type="hidden" name="next" value={params.next ?? "/"} />
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
      </div>
    </div>
  );
}
