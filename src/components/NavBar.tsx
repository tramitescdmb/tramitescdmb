import Link from "next/link";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { sincaConfigurado } from "@/lib/sinca";
import { obtenerPermisosUsuario, puedeAccederSeccion, puedeAccederCorrespondencia, puedeAccederContratacion } from "@/lib/permisos";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { AvisoTratamientoDatos } from "@/components/AvisoTratamientoDatos";
import { db } from "@/lib/db";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

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
  const mostrarContratacion = puedeAccederContratacion(permisos);
  const subtitulo = session.cargos.length > 0 ? session.cargos.join(" · ") : session.rol === "ADMIN" ? "Administrador" : "Funcionario";
  const usuarioTerminos = await db.usuario.findUnique({ where: { id: session.userId }, select: { terminosAceptadosEn: true } });

  const marca = (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 font-semibold text-graphite-900">
      {config.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={config.logoUrl} alt="CDMB" className="h-8 w-auto flex-none" />
      ) : (
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-cdmb-600 text-sm font-bold text-white">
          C
        </span>
      )}
      <span className="truncate">Trámites CDMB</span>
    </Link>
  );

  return (
    <>
      <AvisoTratamientoDatos abierto={!usuarioTerminos?.terminosAceptadosEn} />

      <Sidebar
        logoUrl={config.logoUrl}
        esAdmin={esAdmin}
        mostrarVital={mostrarVital}
        mostrarSinca={mostrarSinca}
        mostrarCorrespondencia={mostrarCorrespondencia}
        mostrarContratacion={mostrarContratacion}
        nombre={session.nombre}
        subtitulo={subtitulo}
        iniciales={iniciales(session.nombre)}
      />

      <header className="border-b border-graphite-100 bg-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {marca}
          <MobileNav
            esAdmin={esAdmin}
            mostrarVital={mostrarVital}
            mostrarSinca={mostrarSinca}
            mostrarCorrespondencia={mostrarCorrespondencia}
            mostrarContratacion={mostrarContratacion}
            nombre={session.nombre}
            subtitulo={subtitulo}
            iniciales={iniciales(session.nombre)}
          />
        </div>
      </header>
    </>
  );
}
