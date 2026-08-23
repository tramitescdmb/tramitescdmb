import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getConfiguracionSitio } from "@/lib/config-sitio";

const NAV_LINK = "rounded-md px-2.5 py-1.5 transition-colors hover:bg-cdmb-50 hover:text-cdmb-700 active:bg-cdmb-100";

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
          <nav className="hidden gap-1 text-sm text-stone-600 sm:flex">
            <Link href="/" className={NAV_LINK}>
              Panel
            </Link>
            <Link href="/tramites" className={NAV_LINK}>
              Catálogo de trámites
            </Link>
            <Link href="/expedientes" className={NAV_LINK}>
              Expedientes
            </Link>
            <Link href="/solicitantes" className={NAV_LINK}>
              Solicitantes
            </Link>
            <Link href="/vital" className={NAV_LINK}>
              VITAL
            </Link>
            {session.rol === "ADMIN" && (
              <>
                <Link href="/usuarios" className={NAV_LINK}>
                  Usuarios
                </Link>
                <Link href="/auditoria" className={NAV_LINK}>
                  Auditoría
                </Link>
                <Link href="/admin/apariencia" className={NAV_LINK}>
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
            <button className="rounded-md border border-stone-200 px-3 py-1.5 text-stone-600 transition-transform hover:bg-stone-50 active:scale-95">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
