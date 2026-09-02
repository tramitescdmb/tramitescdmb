"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Briefcase, Layers } from "lucide-react";

type Opcion = { id: string; nombre: string };
type TramiteOpcion = { id: string; codigo: string; nombre: string };
type Grupo = { etiqueta: string; claseBadge: string; claseBarra: string; items: TramiteOpcion[] };
type Nivel = "VER" | "EDITAR";

const BOTON_BASE = "rounded-md border px-2.5 py-1 text-xs font-medium transition";

function EncabezadoSeccion({ icono: Icono, titulo }: { icono: typeof ShieldCheck; titulo: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
        <Icono className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-sm font-semibold text-stone-900">{titulo}</span>
    </div>
  );
}

export function EditarUsuarioAccesoForm({
  usuarioId,
  rolActual,
  cargoActualIds,
  accesoActual,
  cargos,
  tramitesPorCategoria,
}: {
  usuarioId: string;
  rolActual: "ADMIN" | "FUNCIONARIO";
  cargoActualIds: string[];
  accesoActual: { tramiteTipoId: string; nivel: Nivel }[];
  cargos: Opcion[];
  tramitesPorCategoria: Grupo[];
}) {
  const router = useRouter();
  const [rol, setRol] = useState(rolActual);
  const [cargoIds, setCargoIds] = useState<Set<string>>(new Set(cargoActualIds));
  const [acceso, setAcceso] = useState<Map<string, Nivel>>(new Map(accesoActual.map((a) => [a.tramiteTipoId, a.nivel])));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function alternarCargo(id: string) {
    setCargoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function ponerNivel(tramiteId: string, nivel: Nivel | null) {
    setAcceso((prev) => {
      const next = new Map(prev);
      if (nivel === null) next.delete(tramiteId);
      else next.set(tramiteId, nivel);
      return next;
    });
  }

  function aplicarACategoria(items: TramiteOpcion[], nivel: Nivel | null) {
    setAcceso((prev) => {
      const next = new Map(prev);
      for (const t of items) {
        if (nivel === null) next.delete(t.id);
        else next.set(t.id, nivel);
      }
      return next;
    });
  }

  const totalConAcceso = acceso.size;

  async function guardar() {
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rol,
          cargoIds: Array.from(cargoIds),
          accesoTramites: Array.from(acceso.entries()).map(([tramiteTipoId, nivel]) => ({ tramiteTipoId, nivel })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo guardar.");
      }
      setOk(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <EncabezadoSeccion icono={ShieldCheck} titulo="Rol" />
        <div className="grid max-w-sm grid-cols-2 gap-2">
          {(["FUNCIONARIO", "ADMIN"] as const).map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => setRol(valor)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                rol === valor ? "border-cdmb-600 bg-cdmb-50 text-cdmb-800" : "border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {valor === "ADMIN" ? "Administrador" : "Funcionario"}
            </button>
          ))}
        </div>
        {rol === "ADMIN" && (
          <p className="mt-2.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Como Administrador, este usuario tiene acceso total a todo — los cargos y trámites de abajo no
            aplican mientras el rol sea Administrador.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <EncabezadoSeccion icono={Briefcase} titulo="Cargo(s) en la CDMB" />
        <p className="mb-2.5 text-xs text-stone-400">
          Puede seleccionar uno, varios, o todos los que correspondan — se usan para saber qué pasos le corresponden dentro de un trámite.
        </p>
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-stone-100 bg-stone-50/60 p-2.5">
          {cargos.map((c) => {
            const activo = cargoIds.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => alternarCargo(c.id)}
                aria-pressed={activo}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activo
                    ? "border-cdmb-600 bg-cdmb-600 text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:border-cdmb-300 hover:text-cdmb-700"
                }`}
              >
                {c.nombre}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <EncabezadoSeccion icono={Layers} titulo='Trámites de "Trámites ambientales 2.0"' />
          <span className="flex-none rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
            {totalConAcceso} con acceso
          </span>
        </div>
        <p className="-mt-1.5 mb-4 text-xs text-stone-400">
          Sin marcar, el usuario no ve el trámite. <strong>Ver</strong>: consulta el catálogo y los
          expedientes, sin poder actuar. <strong>Editar</strong>: además puede radicar, avanzar pasos,
          subir documentos y comentar. No afecta a VITAL ni a SINCA 1.0, siempre abiertos.
        </p>

        <div className="max-h-[34rem] space-y-3 overflow-y-auto rounded-lg border border-stone-100 p-3">
          {tramitesPorCategoria.map((grupo) => (
            <div key={grupo.etiqueta} className="relative overflow-hidden rounded-lg bg-stone-50/60 pl-3">
              <span className={`absolute inset-y-0 left-0 w-1 ${grupo.claseBarra}`} aria-hidden />
              <div className="p-2">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${grupo.claseBadge}`}>
                    {grupo.etiqueta} ({grupo.items.length})
                  </span>
                  <div className="flex gap-1.5 text-[11px]">
                    <button type="button" onClick={() => aplicarACategoria(grupo.items, "EDITAR")} className="text-cdmb-700 hover:underline">
                      Editar todos
                    </button>
                    <span className="text-stone-300">·</span>
                    <button type="button" onClick={() => aplicarACategoria(grupo.items, "VER")} className="text-stone-500 hover:underline">
                      Ver todos
                    </button>
                    <span className="text-stone-300">·</span>
                    <button type="button" onClick={() => aplicarACategoria(grupo.items, null)} className="text-stone-400 hover:underline">
                      Quitar
                    </button>
                  </div>
                </div>
                <ul className="space-y-1">
                  {grupo.items.map((t) => {
                    const nivel = acceso.get(t.id) ?? null;
                    return (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5">
                        <span className="min-w-0 text-sm text-stone-700">
                          <span className="mr-1.5 text-xs text-stone-400">{t.codigo}</span>
                          {t.nombre}
                        </span>
                        <div className="flex flex-none gap-1">
                          <button
                            type="button"
                            onClick={() => ponerNivel(t.id, null)}
                            className={`${BOTON_BASE} ${nivel === null ? "border-stone-400 bg-stone-100 text-stone-700" : "border-stone-200 text-stone-400 hover:bg-stone-50"}`}
                          >
                            Sin acceso
                          </button>
                          <button
                            type="button"
                            onClick={() => ponerNivel(t.id, "VER")}
                            className={`${BOTON_BASE} ${nivel === "VER" ? "border-sky-600 bg-sky-600 text-white" : "border-stone-200 text-stone-500 hover:bg-sky-50"}`}
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => ponerNivel(t.id, "EDITAR")}
                            className={`${BOTON_BASE} ${nivel === "EDITAR" ? "border-cdmb-600 bg-cdmb-600 text-white" : "border-stone-200 text-stone-500 hover:bg-cdmb-50"}`}
                          >
                            Editar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Cambios guardados.</div>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-md bg-cdmb-600 px-5 py-2 text-sm font-medium text-white transition-transform hover:bg-cdmb-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
