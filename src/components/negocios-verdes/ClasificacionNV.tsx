"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { NivelTaxonomia } from "@/lib/negocios-verdes-catalogo";
import { llamarNV } from "@/lib/negocios-verdes-cliente";

type Base = { id: string; nombre: string; slug: string; icono: string; orden: number; activo: boolean; usos: number };
export type ActividadFila = Base & { descripcion: string };
export type SubcategoriaFila = Base & { actividades: ActividadFila[] };
export type CategoriaFila = Base & { descripcion: string; categoriaNacional: string; subcategorias: SubcategoriaFila[] };

type Edicion = { nivel: NivelTaxonomia; id: string | null; padreId: string | null; nombre: string; slug: string; icono: string; orden: number; activo: boolean; descripcion: string; categoriaNacional: string };

const entrada = "w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm";
const NIVEL = { categoria: "categoría", subcategoria: "subcategoría", actividad: "actividad productiva" } as const;

/** Árbol de clasificación (categoría → subcategoría → actividad productiva) con edición en línea. */
export function ClasificacionNV({ categorias }: { categorias: CategoriaFila[] }) {
  const router = useRouter();
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [ed, setEd] = useState<Edicion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const alternar = (id: string) =>
    setAbiertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const nuevo = (nivel: NivelTaxonomia, padreId: string | null) => setEd({ nivel, id: null, padreId, nombre: "", slug: "", icono: "", orden: 0, activo: true, descripcion: "", categoriaNacional: "" });
  const editar = (nivel: NivelTaxonomia, t: Base & { descripcion?: string; categoriaNacional?: string }, padreId: string | null) =>
    setEd({ nivel, id: t.id, padreId, nombre: t.nombre, slug: t.slug, icono: t.icono, orden: t.orden, activo: t.activo, descripcion: t.descripcion ?? "", categoriaNacional: t.categoriaNacional ?? "" });

  async function ejecutar(fn: () => Promise<unknown>) {
    setOcupado(true);
    setError(null);
    try {
      await fn();
      setEd(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  const eliminar = (nivel: NivelTaxonomia, t: Base) => {
    if (!window.confirm(`¿Eliminar la ${NIVEL[nivel]} «${t.nombre}»?`)) return;
    void ejecutar(() => llamarNV(`/api/negocios-verdes/taxonomia?nivel=${nivel}&id=${t.id}`, "DELETE"));
  };

  function formulario() {
    if (!ed) return null;
    const set = (c: Partial<Edicion>) => setEd({ ...ed, ...c });
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ejecutar(() => llamarNV("/api/negocios-verdes/taxonomia", "POST", ed));
        }}
        className="my-2 grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 sm:grid-cols-2"
      >
        <p className="text-sm font-medium text-stone-800 sm:col-span-2">{ed.id ? "Editar" : "Nueva"} {NIVEL[ed.nivel]}</p>
        <label className="text-xs text-stone-600">
          Nombre
          <input autoFocus required value={ed.nombre} onChange={(e) => set({ nombre: e.target.value })} maxLength={150} className={entrada} />
        </label>
        <label className="text-xs text-stone-600">
          Dirección (slug, opcional)
          <input value={ed.slug} onChange={(e) => set({ slug: e.target.value })} className={entrada} placeholder="Se arma con el nombre" />
        </label>
        <label className="text-xs text-stone-600">
          Ícono (emoji)
          <input value={ed.icono} onChange={(e) => set({ icono: e.target.value })} maxLength={16} className={entrada} />
        </label>
        <label className="text-xs text-stone-600">
          Orden
          <input type="number" min={0} max={999} value={ed.orden} onChange={(e) => set({ orden: Number(e.target.value) })} className={entrada} />
        </label>
        {ed.nivel === "categoria" && (
          <label className="text-xs text-stone-600 sm:col-span-2">
            Categoría del Plan Nacional
            <input value={ed.categoriaNacional} onChange={(e) => set({ categoriaNacional: e.target.value })} maxLength={200} className={entrada} />
          </label>
        )}
        {ed.nivel !== "subcategoria" && (
          <label className="text-xs text-stone-600 sm:col-span-2">
            Descripción
            <textarea value={ed.descripcion} onChange={(e) => set({ descripcion: e.target.value })} maxLength={2000} rows={2} className={entrada} />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={ed.activo} onChange={(e) => set({ activo: e.target.checked })} /> Activa (se muestra en el sitio)
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={ocupado} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
            Guardar
          </button>
          <button type="button" onClick={() => setEd(null)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700">
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  const enEdicion = (nivel: NivelTaxonomia, id: string | null, padreId: string | null) => ed && ed.nivel === nivel && ed.id === id && (id !== null || ed.padreId === padreId);

  function fila({ nivel, t, padreId, hijos, abierta, onAlternar }: { nivel: NivelTaxonomia; t: Base & { descripcion?: string; categoriaNacional?: string }; padreId: string | null; hijos?: number; abierta?: boolean; onAlternar?: () => void }) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        {onAlternar ? (
          <button type="button" onClick={onAlternar} aria-label={abierta ? "Contraer" : "Expandir"} className="text-stone-500">
            <ChevronRight className={`h-4 w-4 transition ${abierta ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="flex-1 text-sm text-stone-800">
          {t.icono && <span className="mr-1">{t.icono}</span>}
          {t.nombre}
          {!t.activo && <span className="ml-2 rounded bg-stone-100 px-1.5 text-xs text-stone-500">Inactiva</span>}
          <span className="ml-2 text-xs text-stone-400">
            {t.usos} negocio{t.usos === 1 ? "" : "s"}
            {hijos !== undefined ? ` · ${hijos} ${nivel === "categoria" ? "subcategoría" : "actividad"}${hijos === 1 ? "" : nivel === "categoria" ? "s" : "es"}` : ""}
          </span>
        </span>
        <button type="button" onClick={() => editar(nivel, t, padreId)} aria-label={`Editar ${t.nombre}`} className="rounded p-1 text-stone-500 hover:bg-stone-100">
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => eliminar(nivel, t)} aria-label={`Eliminar ${t.nombre}`} className="rounded p-1 text-stone-500 hover:bg-red-50 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const agregar = (nivel: NivelTaxonomia, padreId: string | null) => (
    <button type="button" onClick={() => nuevo(nivel, padreId)} className="inline-flex items-center gap-1 py-1 text-xs font-medium text-emerald-700 hover:underline">
      <Plus className="h-3.5 w-3.5" /> Agregar {NIVEL[nivel]}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600">Las que están en uso no se pueden eliminar: desactívelas para ocultarlas del sitio.</p>
        <button type="button" onClick={() => nuevo("categoria", null)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">
          <Plus className="h-4 w-4" /> Nueva categoría
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {enEdicion("categoria", null, null) && formulario()}
      <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white px-3">
        {categorias.map((c) => (
          <div key={c.id}>
            {fila({ nivel: "categoria", t: c, padreId: null, hijos: c.subcategorias.length, abierta: abiertas.has(c.id), onAlternar: () => alternar(c.id) })}
            {enEdicion("categoria", c.id, null) && formulario()}
            {abiertas.has(c.id) && (
              <div className="ml-6 border-l border-stone-100 pl-3">
                {c.subcategorias.map((s) => (
                  <div key={s.id}>
                    {fila({ nivel: "subcategoria", t: s, padreId: c.id, hijos: s.actividades.length, abierta: abiertas.has(s.id), onAlternar: () => alternar(s.id) })}
                    {enEdicion("subcategoria", s.id, c.id) && formulario()}
                    {abiertas.has(s.id) && (
                      <div className="ml-6 border-l border-stone-100 pl-3">
                        {s.actividades.map((a) => (
                          <div key={a.id}>
                            {fila({ nivel: "actividad", t: a, padreId: s.id })}
                            {enEdicion("actividad", a.id, s.id) && formulario()}
                          </div>
                        ))}
                        {enEdicion("actividad", null, s.id) ? formulario() : agregar("actividad", s.id)}
                      </div>
                    )}
                  </div>
                ))}
                {enEdicion("subcategoria", null, c.id) ? formulario() : agregar("subcategoria", c.id)}
              </div>
            )}
          </div>
        ))}
        {categorias.length === 0 && <p className="py-4 text-sm text-stone-500">Aún no hay categorías.</p>}
      </div>
    </div>
  );
}
