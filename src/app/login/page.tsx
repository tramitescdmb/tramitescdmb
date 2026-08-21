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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-cdmb-600 text-lg font-bold text-white">
            C
          </span>
          <h1 className="text-lg font-semibold text-gray-900">Trámites CDMB</h1>
          <p className="text-sm text-gray-500">Ingresa con tu cuenta institucional</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <form action="/api/auth/login" method="post" className="space-y-4">
          <input type="hidden" name="next" value={params.next ?? "/"} />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Correo</label>
            <input
              type="email"
              name="email"
              required
              autoFocus
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder="nombre@cdmb.gov.co"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña</label>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
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
