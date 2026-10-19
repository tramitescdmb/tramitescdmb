import Link from "next/link";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { sincaConfigurado } from "@/lib/sinca";
import { obtenerPermisosUsuario, puedeAccederSeccion, puedeAccederCorrespondencia, puedeAccederContratacion, terminosAceptados } from "@/lib/permisos";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { AvisoTratamientoDatos } from "@/components/AvisoTratamientoDatos";
import { BarraSuperior } from "@/components/BarraSuperior";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

function subtituloSesion(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return session.cargos.length > 0
    ? session.cargos.map((c) => (session.cargosEncargo.includes(c) ? `${c} (E)` : c)).join(" · ")
    : session.rol === "ADMIN"
      ? "Administrador"
      : "Funcionario";
}

export async function BarraSuperiorSesion() {
  const session = await getSession();
  if (!session) return null;
  return <BarraSuperior nombre={session.nombre} subtitulo={subtituloSesion(session)} iniciales={iniciales(session.nombre)} />;
}

export async function NavBar() {
  const session = await getSession();
  if (!session) return null;

  const [config, permisos, aceptoTerminos] = await Promise.all([
    getConfiguracionSitio(),
    obtenerPermisosUsuario(session.userId),
    terminosAceptados(session.userId),
  ]);
  const esAdmin = session.rol === "ADMIN";
  const mostrarTramites = permisos.modulos.has("TRAMITES");
  const mostrarVital = puedeAccederSeccion(permisos, "VITAL_BASE") || puedeAccederSeccion(permisos, "VITAL_DASHBOARD");
  const mostrarSinca =
    sincaConfigurado() &&
    (puedeAccederSeccion(permisos, "SINCA_BASE") ||
      puedeAccederSeccion(permisos, "SINCA_DASHBOARD") ||
      puedeAccederSeccion(permisos, "SINCA_MINERIA"));
  const mostrarCorrespondencia = puedeAccederCorrespondencia(permisos);
  const mostrarContratacion = puedeAccederContratacion(permisos);
  const subtitulo = subtituloSesion(session);

  const marca = (
    <Link prefetch={false} href="/" className="flex min-w-0 items-center gap-2.5 font-semibold text-white">
      {config.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={config.logoUrl} alt="CDMB" className="h-8 w-auto flex-none rounded bg-white p-0.5" />
      ) : (
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded bg-white text-sm font-bold text-cdmb-700">
          C
        </span>
      )}
      <span className="truncate">Trámites CDMB</span>
    </Link>
  );

  return (
    <>
      <AvisoTratamientoDatos abierto={!aceptoTerminos} />

      <Sidebar
        logoUrl={config.logoUrl}
        esAdmin={esAdmin}
        mostrarTramites={mostrarTramites}
        mostrarVital={mostrarVital}
        mostrarSinca={mostrarSinca}
        mostrarCorrespondencia={mostrarCorrespondencia}
        mostrarContratacion={mostrarContratacion}
      />

      <header className="border-b border-black/20 bg-cdmb-800 lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {marca}
          <MobileNav
            esAdmin={esAdmin}
            mostrarTramites={mostrarTramites}
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
