import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getConfiguracionSitio } from "@/lib/config-sitio";

export async function NavBar() {
  const session = await getSession();
  if (!session) return null;

  const config = await getConfiguracionSitio();

  return (
    <header className="border-b border-cdmb-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-cdmb-800">
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt="CDMB" className="h-8 w-auto" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cdmb-600 text-sm font-bold text-white">
                C
              </span>
            )}
            Trámites CDMB
          </Link>
          <nav className="hidden gap-4 text-sm text-stone-600 sm:flex">
            <Link href="/" className="hover:text-cdmb-700">
              Panel
            </Link>
            <Link href="/tramites" className="hover:text-cdmb-700">
              Catálogo de trámites
            </Link>
            <Link href="/expedientes" className="hover:text-cdmb-700">
              Expedientes
            </Link>
            <Link href="/solicitantes" className="hover:text-cdmb-700">
              Solicitantes
            </Link>
            <Link href="/vital" className="hover:text-cdmb-700">
              VITAL
            </Link>
            {session.rol === "ADMIN" && (
              <>
                <Link href="/usuarios" className="hover:text-cdmb-700">
                  Usuarios
                </Link>
                <Link href="/auditoria" className="hover:text-cdmb-700">
                  Auditoría
                </Link>
                <Link href="/admin/apariencia" className="hover:text-cdmb-700">
                  Apariencia
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-500">
            {session.nombre} <span className="text-stone-300">·</span>{" "}
            <span className="text-stone-400">{session.rol}</span>
          </span>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-md border border-stone-200 px-3 py-1.5 text-stone-600 hover:bg-stone-50">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
