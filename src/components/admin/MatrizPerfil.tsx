"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import {
  ACCIONES,
  ETIQUETA_ACCION,
  ETIQUETA_MODULO_PERFIL,
  FUNCIONALIDADES,
  MODULOS_PERFIL,
  type Accion,
  type Matriz,
  type ModuloPerfil,
} from "@/lib/perfiles-catalogo";

type Props = {
  id: string;
  nombreInicial: string;
  descripcionInicial: string;
  moduloPerfil: ModuloPerfil;
  matrizInicial: Matriz;
  eliminable: boolean;
};

const aSets = (m: Matriz) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, new Set<Accion>(v)]));

export function MatrizPerfil({ id, nombreInicial, descripcionInicial, moduloPerfil, matrizInicial, eliminable }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [descripcion, setDescripcion] = useState(descripcionInicial);
  const [matriz, setMatriz] = useState<Record<string, Set<Accion>>>(() => aSets(matrizInicial));
  const [pestana, setPestana] = useState<ModuloPerfil>(moduloPerfil);
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const conteo = useMemo(() => {
    const c = {} as Record<ModuloPerfil, number>;
    for (const m of MODULOS_PERFIL) c[m] = 0;
    for (const f of FUNCIONALIDADES) c[f.modulo] += matriz[f.clave]?.size ?? 0;
    return c;
  }, [matriz]);

  function alternar(clave: string, accion: Accion) {
    setMatriz((prev) => {
      const actual = new Set(prev[clave] ?? []);
      if (actual.has(accion)) actual.delete(accion);
      else actual.add(accion);
      return { ...prev, [clave]: actual };
    });
    setEstado(null);
  }

  function alternarFila(clave: string, acciones: readonly Accion[]) {
    setMatriz((prev) => {
      const todas = acciones.every((a) => prev[clave]?.has(a));
      return { ...prev, [clave]: new Set(todas ? [] : acciones) };
    });
    setEstado(null);
  }

  async function guardar() {
    setGuardando(true);
    setEstado(null);
    try {
      const res = await fetch(`/api/admin/perfiles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, descripcion, matriz: Object.fromEntries(Object.entries(matriz).map(([k, v]) => [k, [...v]])) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      setEstado({ tipo: "ok", texto: "Rol guardado." });
      router.refresh();
    } catch (e) {
      setEstado({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo guardar." });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar el rol «${nombreInicial}»?`)) return;
    const res = await fetch(`/api/admin/perfiles/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) return setEstado({ tipo: "error", texto: body.error || "No se pudo eliminar." });
    router.push("/admin/roles");
  }

  const funcionalidades = FUNCIONALIDADES.filter((f) => f.modulo === pestana);

  return (
    <div className="space-y-4 pb-16">
      <div className="grid grid-cols-1 gap-3 rounded-md border border-stone-200 bg-white p-4 md:grid-cols-2">
        <label className="text-xs font-medium text-stone-600">
          Nombre del rol
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-stone-600">
          Descripción
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-4">
        <nav className="mb-4 flex overflow-x-auto rounded-md border border-stone-200 bg-white lg:mb-0 lg:flex-col" aria-label="Módulos">
          {MODULOS_PERFIL.map((m) => {
            const sel = m === pestana;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setPestana(m)}
                className={`flex flex-none items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-left text-sm lg:w-full lg:border-b lg:border-l-[3px] lg:border-b-stone-100 ${
                  sel ? "border-b-cdmb-600 bg-white font-semibold text-stone-900 lg:border-l-cdmb-600" : "border-transparent text-stone-600 hover:bg-stone-50 lg:bg-stone-50/60"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{ETIQUETA_MODULO_PERFIL[m]}</span>
                {conteo[m] > 0 && <span className="rounded-sm bg-sky-100 px-1.5 text-[11px] font-semibold tabular-nums text-sky-800">{conteo[m]}</span>}
              </button>
            );
          })}
        </nav>

        <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
          <table className="tabla-listado w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2">Funcionalidad</th>
                {ACCIONES.map((a) => (
                  <th key={a} className="w-20 px-2 py-2 text-center">
                    {ETIQUETA_ACCION[a]}
                  </th>
                ))}
                <th className="w-16 px-2 py-2 text-center">Todo</th>
              </tr>
            </thead>
            <tbody>
              {funcionalidades.map((f) => (
                <tr key={f.clave}>
                  <td className="px-4 py-2 align-top">
                    <span className="font-medium text-stone-800">{f.nombre}</span>
                    {f.alcance && <span className="block text-[11px] text-stone-500">Alcance: {f.alcance}</span>}
                    {f.porCargo && <span className="block text-[11px] text-amber-700">{f.porCargo}</span>}
                  </td>
                  {ACCIONES.map((a) => {
                    const aplica = f.acciones.includes(a);
                    const marcado = matriz[f.clave]?.has(a) ?? false;
                    return (
                      <td key={a} className="px-2 py-2 text-center align-top">
                        {aplica ? (
                          <label className="inline-flex flex-col items-center gap-0.5" title={f.etiquetas?.[a] ?? ETIQUETA_ACCION[a]}>
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => alternar(f.clave, a)}
                              aria-label={`${f.nombre}: ${f.etiquetas?.[a] ?? ETIQUETA_ACCION[a]}`}
                              className="h-4 w-4"
                            />
                            {f.etiquetas?.[a] && <span className="text-[10px] text-stone-500">{f.etiquetas[a]}</span>}
                          </label>
                        ) : (
                          <span className="text-stone-300" aria-hidden>
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center align-top">
                    <input
                      type="checkbox"
                      checked={f.acciones.every((a) => matriz[f.clave]?.has(a))}
                      onChange={() => alternarFila(f.clave, f.acciones)}
                      aria-label={`${f.nombre}: todas las acciones`}
                      className="h-4 w-4"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-4 py-2.5 shadow-soft-lg">
        <div className="flex items-center gap-2">
          {eliminable && (
            <button type="button" onClick={eliminar} className="inline-flex items-center gap-1.5 rounded border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
              <Trash2 className="h-4 w-4" aria-hidden />
              Eliminar rol
            </button>
          )}
          {estado && <span className={`text-sm ${estado.tipo === "ok" ? "text-emerald-700" : "text-red-700"}`}>{estado.texto}</span>}
        </div>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="inline-flex items-center gap-1.5 rounded bg-acento-500 px-4 py-2 text-sm font-semibold text-white hover:bg-acento-600 disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden />
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
