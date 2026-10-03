import { redirect } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { SectionHelp } from "@/components/Field";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { MODULOS_CONFIGURABLES as MODULOS } from "@/lib/modulos-visibles";

export default async function ModulosPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Disponibilidad de módulos" quien="administrador del sistema" volverHref="/" volverLabel="Ir al inicio" />;

  const sp = await searchParams;
  const config = await getConfiguracionSitio();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-900">
          <LayoutGrid className="h-5 w-5 text-cdmb-600" aria-hidden />
          Disponibilidad de módulos
        </h1>
        <p className="text-sm text-stone-500">Qué módulos ven y pueden usar los funcionarios. Solo el administrador del sistema lo modifica.</p>
      </div>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <form action="/api/configuracion-modulos" method="post" className="space-y-6">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
          <SectionHelp>
            Mientras un módulo esté oculto, solo un administrador lo ve y puede entrar — sirve para tenerlo en marcha sin que los funcionarios lo
            usen hasta que esté listo.
          </SectionHelp>
          <div className="space-y-4">
            {MODULOS.map((m) => (
              <label key={m.campo} className="flex items-start gap-2 text-sm text-stone-700">
                <input type="checkbox" name={m.campo} defaultChecked={config[m.campo]} className="mt-0.5 rounded border-stone-200" />
                <span>
                  <strong>{m.nombre}</strong> visible para los funcionarios
                  <span className="mt-0.5 block text-xs text-stone-400">{m.efecto}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">
          Guardar
        </button>
      </form>
    </div>
  );
}
