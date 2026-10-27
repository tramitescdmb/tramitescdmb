import type { ReactNode } from "react";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { opcionesTablero } from "@/lib/tableros";
import { SelectorTablero, AccionesTablero } from "@/components/inicio/SelectorTablero";
import { AccesosRapidosExpediente } from "@/components/AccesosRapidosExpediente";
import { accesosDeModulo, accesosExpediente, accesosExpedienteTodos, moduloDeRuta } from "@/lib/accesos-expediente";

export async function BarraDashboard({ actual, filtros, derecha }: { actual: string; filtros?: ReactNode; derecha?: ReactNode }) {
  const session = await getSession();
  if (!session) return null;
  const permisos = await obtenerPermisosUsuario(session.userId);
  const modulo = moduloDeRuta(actual);
  const accesos = modulo ? accesosDeModulo(accesosExpediente(permisos, modulo)) : actual === "/" || actual === "/dashboard" ? accesosExpedienteTodos(permisos) : null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-stone-200 bg-white px-4 py-2.5">
      <SelectorTablero opciones={opcionesTablero(permisos)} actual={actual} />
      {accesos && <AccesosRapidosExpediente nuevos={accesos.nuevos} listados={accesos.listados} />}
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        {filtros}
        {derecha ?? <AccionesTablero />}
      </div>
    </div>
  );
}

export function MarcoDashboard({ actual, filtros, derecha, children }: { actual: string; filtros?: ReactNode; derecha?: ReactNode; children: ReactNode }) {
  return (
    <div data-tablero className="mx-auto max-w-7xl space-y-3">
      <BarraDashboard actual={actual} filtros={filtros} derecha={derecha} />
      {children}
    </div>
  );
}

export function RejillaIndicadores({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{children}</div>;
}

export function RejillaTarjetas({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 lg:grid-cols-12">{children}</div>;
}
