"use client";

import { ICONOS_MODULO } from "@/lib/modulos-usuario-iconos";
import { MODULOS_USUARIO, faltanteModulo, type ConfiguracionAccesoUsuario, type ModuloUsuario, type PestanaFichaUsuario } from "@/lib/modulos-usuario";

export function AccesoModulosPanel({
  modulos,
  onCambiar,
  esAdmin,
  visiblesGlobal,
  configuracion,
  resumen,
  onConfigurar,
}: {
  modulos: Set<ModuloUsuario>;
  onCambiar: (id: ModuloUsuario, activo: boolean) => void;
  esAdmin: boolean;
  visiblesGlobal: Record<ModuloUsuario, boolean>;
  configuracion: ConfiguracionAccesoUsuario;
  resumen: Record<ModuloUsuario, string>;
  onConfigurar: (pestana: PestanaFichaUsuario) => void;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold text-stone-900">Acceso a módulos</h2>
        <p className="text-xs text-stone-400">
          {esAdmin ? "Administrador: acceso total a todos los módulos." : "Active cada módulo y configure su rol en la pestaña correspondiente."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {MODULOS_USUARIO.map((m) => {
          const Icono = ICONOS_MODULO[m.id];
          const activo = esAdmin || modulos.has(m.id);
          const faltante = activo && !esAdmin ? faltanteModulo(m.id, configuracion) : null;
          const ocultoGlobal = !esAdmin && !visiblesGlobal[m.id];
          const tono = !activo ? "inactivo" : ocultoGlobal || faltante ? "pendiente" : "ok";
          return (
            <div
              key={m.id}
              className={`flex flex-col gap-2 rounded-xl border p-3 transition ${
                tono === "ok" ? "border-cdmb-200 bg-cdmb-50/60" : tono === "pendiente" ? "border-amber-200 bg-amber-50/50" : "border-stone-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    tono === "ok" ? "bg-cdmb-100 text-cdmb-700" : tono === "pendiente" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-400"
                  }`}
                >
                  <Icono className="h-4 w-4" aria-hidden />
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={activo}
                  aria-label={`Acceso a ${m.nombre}`}
                  disabled={esAdmin}
                  onClick={() => onCambiar(m.id, !activo)}
                  className={`relative h-5 w-9 flex-none rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${activo ? "bg-cdmb-600" : "bg-stone-300"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${activo ? "left-[18px]" : "left-0.5"}`} />
                </button>
              </div>
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium ${activo ? "text-stone-900" : "text-stone-500"}`} title={m.nombre}>
                  {m.corto}
                </p>
                {esAdmin ? (
                  <p className="text-xs text-stone-500">Acceso total</p>
                ) : !activo ? (
                  <p className="text-xs text-stone-400">Sin acceso</p>
                ) : ocultoGlobal ? (
                  <p className="text-xs text-amber-700" title="Desactivado para todos en Administración → Módulos">
                    Oculto para todos
                  </p>
                ) : faltante ? (
                  <button type="button" onClick={() => onConfigurar(m.pestana)} className="text-left text-xs text-amber-700 underline-offset-2 hover:underline">
                    {faltante} · Configurar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onConfigurar(m.pestana)}
                    className="block max-w-full truncate text-left text-xs text-cdmb-700 underline-offset-2 hover:underline"
                    title={resumen[m.id]}
                  >
                    {resumen[m.id]}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
