import Link from "next/link";
import { LogOut } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { sincaConfigurado } from "@/lib/sinca";
import { obtenerPermisosUsuario, puedeAccederSeccion, puedeAccederCorrespondencia } from "@/lib/permisos";
import { SidebarNav } from "@/components/SidebarNav";
import { MobileNav } from "@/components/MobileNav";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Navegación de la app: un sidebar fijo a la izquierda desde `lg:` para
 * arriba (pensado para un funcionario que trabaja 8 horas seguidas frente al
 * panel — la navegación siempre visible ahorra scroll e ir/volver), y en
 * pantallas más chicas una barra superior mínima (marca + botón de menú) que
 * abre el mismo menú como un panel lateral (`MobileNav`) — antes era una fila
 * horizontal con toda la navegación, que se cortaba con nombres largos como
 * "Correspondencia y Archivo (SGDEA)".
 */
export async function NavBar() {
  const session = await getSession();
  if (!session) return null;

  const config = await getConfiguracionSitio();
  const esAdmin = session.rol === "ADMIN";
  const permisos = await obtenerPermisosUsuario(session.userId);
  const mostrarVital = puedeAccederSeccion(permisos, "VITAL_BASE") || puedeAccederSeccion(permisos, "VITAL_DASHBOARD");
  const mostrarSinca =
    sincaConfigurado() &&
    (puedeAccederSeccion(permisos, "SINCA_BASE") ||
      puedeAccederSeccion(permisos, "SINCA_DASHBOARD") ||
      puedeAccederSeccion(permisos, "SINCA_MINERIA"));
  const mostrarCorrespondencia = puedeAccederCorrespondencia(permisos);
  const subtitulo = session.cargos.length > 0 ? session.cargos.join(" · ") : session.rol === "ADMIN" ? "Administrador" : "Funcionario";

  const marca = (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 font-semibold text-cdmb-800">
      {config.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={config.logoUrl} alt="CDMB" className="h-8 w-auto flex-none" />
      ) : (
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-600 text-sm font-bold text-white">
          C
        </span>
      )}
      <span className="truncate">Trámites CDMB</span>
    </Link>
  );

  const salir = (
    <form action="/api/auth/logout" method="post">
      <button className="flex items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition-transform hover:bg-stone-50 active:scale-95">
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        Salir
      </button>
    </form>
  );

  return (
    <>
      {/* Escritorio: sidebar fijo, se estira a lo alto de la ventana. */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-none flex-col border-r border-stone-200 bg-white lg:flex">
        <div className="border-b border-stone-100 px-4 py-4">{marca}</div>
        <SidebarNav esAdmin={esAdmin} mostrarVital={mostrarVital} mostrarSinca={mostrarSinca} mostrarCorrespondencia={mostrarCorrespondencia} />
        <div className="border-t border-stone-100 p-3">
          <Link href="/mi-cuenta" className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-stone-50">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-800">
              {iniciales(session.nombre)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-800">{session.nombre}</p>
              <p className="truncate text-xs text-stone-400">{subtitulo}</p>
            </div>
          </Link>
          <div className="mt-1 px-2">{salir}</div>
        </div>
      </aside>

      {/* Pantallas chicas: solo la marca y el botón de menú — el resto vive en el panel que abre. */}
      <header className="border-b border-cdmb-100 bg-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {marca}
          <MobileNav
            esAdmin={esAdmin}
            mostrarVital={mostrarVital}
            mostrarSinca={mostrarSinca}
            mostrarCorrespondencia={mostrarCorrespondencia}
            nombre={session.nombre}
            subtitulo={subtitulo}
            iniciales={iniciales(session.nombre)}
          />
        </div>
      </header>
    </>
  );
}
