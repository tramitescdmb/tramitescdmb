import Link from "next/link";
import { getSession } from "@/lib/auth";

export async function NavBar() {
  const session = await getSession();
  if (!session) return null;

  return (
    <header className="border-b border-cdmb-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-cdmb-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cdmb-600 text-sm font-bold text-white">
              C
            </span>
            Trámites CDMB
          </Link>
          <nav className="hidden gap-4 text-sm text-gray-600 sm:flex">
            <Link href="/" className="hover:text-cdmb-700">
              Panel
            </Link>
            <Link href="/tramites" className="hover:text-cdmb-700">
              Catálogo de trámites
            </Link>
            <Link href="/expedientes" className="hover:text-cdmb-700">
              Expedientes
            </Link>
            {session.rol === "ADMIN" && (
              <Link href="/usuarios" className="hover:text-cdmb-700">
                Usuarios
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">
            {session.nombre} <span className="text-gray-300">·</span>{" "}
            <span className="text-gray-400">{session.rol}</span>
          </span>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-50">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
