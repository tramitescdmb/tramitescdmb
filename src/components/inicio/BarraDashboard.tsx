import type { ReactNode } from "react";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { opcionesTablero } from "@/lib/tableros";
import { SelectorTablero, AccionesTablero } from "@/components/inicio/SelectorTablero";

export async function BarraDashboard({ actual, derecha }: { actual: string; derecha?: ReactNode }) {
  const session = await getSession();
  if (!session) return null;
  const permisos = await obtenerPermisosUsuario(session.userId);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-4 py-2.5">
      <SelectorTablero opciones={opcionesTablero(permisos)} actual={actual} />
      {derecha ?? <AccionesTablero />}
    </div>
  );
}
