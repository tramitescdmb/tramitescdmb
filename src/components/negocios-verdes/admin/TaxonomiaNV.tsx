"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { NivelTaxonomia } from "@/lib/negocios-verdes-catalogo";
import { llamarNV } from "@/lib/negocios-verdes-cliente";
import { InterruptorNV, claseBotonFlotanteNV } from "@/components/negocios-verdes/admin/ListaNegociosNV";

export type NodoAdminNV = {
  id: string;
  nombre: string;
  slug: string;
  icono: string;
  iconoUrl: string | null;
  orden: number;
  activo: boolean;
  descripcion: string;
  categoriaNacional: string;
  padreId: string | null;
  padre: string;
  usos: number;
};
export type PadreNV = { id: string; nombre: string; icono: string; grupo?: string };

const NOMBRE = { categoria: ["categoría", "Nueva categoría"], subcategoria: ["subcategoría", "Nueva subcategoría"], actividad: ["actividad productiva", "Nueva actividad"] } as const;
const entrada = "w-full rounded-[8px] border border-nv-borde bg-white px-3 py-2 text-sm focus:border-nv-primario focus:outline-none";

type Edicion = Omit<NodoAdminNV, "id" | "iconoUrl" | "padre" | "usos"> & { id: string | null };

function Icono({ n }: { n: Pick<NodoAdminNV, "icono" | "iconoUrl"> }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (n.iconoUrl) return <img src={n.iconoUrl} alt="" className="h-7 w-7 flex-none object-contain" />;
  return <span className="w-7 flex-none text-center text-[26px] leading-none" aria-hidden>{n.icono}</span>;
}

/**
 * Lista de categorías, subcategorías o actividades productivas del administrador, con la forma de
 * la plataforma anterior: tarjetas con ícono, nombre, descripción o nivel superior, interruptor de
 * activa, editar y eliminar, filtro por nivel superior y botón flotante para crear.
 */
export function TaxonomiaNV({ nivel, nodos, padres }: { nivel: NivelTaxonomia; nodos: NodoAdminNV[]; padres: PadreNV[] }) {
  const router = useRouter();
  const [filas, setFilas] = useState(nodos);
  const [filtro, setFiltro] = useState<string>("");
  const [ed, setEd] = useState<Edicion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const visibles = useMemo(() => filas.filter((n) => !filtro || n.padreId === filtro), [filas, filtro]);

  const cuerpo = (n: Edicion) => ({ ...n, nivel });

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

  async function alternar(n: NodoAdminNV, activo: boolean) {
    setFilas((f) => f.map((x) => (x.id === n.id ? { ...x, activo } : x)));
    try {
      await llamarNV("/api/negocios-verdes/taxonomia", "POST", cuerpo({ ...n, activo }));
      router.refresh();
    } catch (e) {
      setFilas((f) => f.map((x) => (x.id === n.id ? { ...x, activo: !activo } : x)));
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const eliminar = (n: NodoAdminNV) => {
    if (!window.confirm(`¿Eliminar la ${NOMBRE[nivel][0]} «${n.nombre}»?`)) return;
    void ejecutar(() => llamarNV(`/api/negocios-verdes/taxonomia?nivel=${nivel}&id=${n.id}`, "DELETE"));
  };

  const nuevo = () => setEd({ id: null, nombre: "", slug: "", icono: "", orden: 0, activo: true, descripcion: "", categoriaNacional: "", padreId: filtro || padres[0]?.id || null });

  return (
    <div className="pb-20">
      {nivel !== "categoria" && (
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {[{ id: "", nombre: "Todas", icono: "" }, ...padres].map((p) => (
            <button
              key={p.id || "todas"}
              type="button"
              aria-pressed={filtro === p.id}
              onClick={() => setFiltro(p.id)}
              className={`inline-flex items-center gap-2 rounded-[8px] px-4 py-1.5 text-sm ${filtro === p.id ? "bg-nv-menu text-nv-texto" : "bg-nv-claro text-nv-texto hover:brightness-95"}`}
            >
              {filtro === p.id ? <Check className="h-4 w-4" aria-hidden /> : p.icono ? <span aria-hidden>{p.icono}</span> : null}
              {p.nombre}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mb-3 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ul className="space-y-3">
        {visibles.map((n) => (
          <li key={n.id} className="flex items-center gap-4 rounded-[12px] border border-nv-borde bg-white px-4 py-4">
            <Icono n={n} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">{n.nombre}</p>
              <p className="text-[13px] leading-snug text-nv-texto2">{nivel === "categoria" ? n.descripcion : n.padre}</p>
              {nivel === "actividad" && n.descripcion && <p className="text-[13px] leading-snug text-nv-texto2">{n.descripcion}</p>}
            </div>
            <span className="hidden text-xs text-nv-texto2 sm:block">
              {n.usos} negocio{n.usos === 1 ? "" : "s"}
            </span>
            <InterruptorNV valor={n.activo} alCambiar={(v) => alternar(n, v)} etiqueta={n.activo ? "Activa: ocultar del sitio" : "Inactiva: mostrar en el sitio"} />
            <button type="button" aria-label={`Editar ${n.nombre}`} onClick={() => setEd({ ...n })} className="rounded-full p-1.5 hover:bg-black/5">
              <Pencil className="h-5 w-5" />
            </button>
            <button type="button" aria-label={`Eliminar ${n.nombre}`} onClick={() => eliminar(n)} title={n.usos ? "En uso: desactívela en lugar de eliminarla" : "Eliminar"} className="rounded-full p-1.5 hover:bg-black/5">
              <Trash2 className="h-5 w-5" />
            </button>
          </li>
        ))}
        {visibles.length === 0 && <li className="py-10 text-center text-sm text-nv-texto2">Todavía no hay registros.</li>}
      </ul>

      <button type="button" onClick={nuevo} className={claseBotonFlotanteNV}>
        <Plus className="h-5 w-5" aria-hidden /> {NOMBRE[nivel][1]}
      </button>

      {ed && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-taxon">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ejecutar(() => llamarNV("/api/negocios-verdes/taxonomia", "POST", cuerpo(ed)));
            }}
            className="max-h-[90dvh] w-full max-w-xl space-y-3 overflow-y-auto rounded-[16px] bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="titulo-taxon" className="text-xl font-medium">
                {ed.id ? `Editar ${NOMBRE[nivel][0]}` : NOMBRE[nivel][1]}
              </h2>
              <button type="button" aria-label="Cerrar" onClick={() => setEd(null)} className="rounded-full p-1.5 hover:bg-black/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {nivel !== "categoria" && (
              <label className="block text-sm">
                <span className="mb-1 block text-nv-texto2">{nivel === "subcategoria" ? "Categoría" : "Subcategoría"} *</span>
                <select required value={ed.padreId ?? ""} onChange={(e) => setEd({ ...ed, padreId: e.target.value })} className={entrada}>
                  {padres.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.grupo ? `${p.grupo} › ` : ""}
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-nv-texto2">Nombre *</span>
              <input autoFocus required maxLength={150} value={ed.nombre} onChange={(e) => setEd({ ...ed, nombre: e.target.value })} className={entrada} />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block text-nv-texto2">Ícono (emoji)</span>
                <input maxLength={16} value={ed.icono} onChange={(e) => setEd({ ...ed, icono: e.target.value })} className={entrada} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-nv-texto2">Orden</span>
                <input type="number" min={0} max={999} value={ed.orden} onChange={(e) => setEd({ ...ed, orden: Number(e.target.value) })} className={entrada} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-nv-texto2">Dirección (slug)</span>
                <input value={ed.slug} onChange={(e) => setEd({ ...ed, slug: e.target.value })} placeholder="Se arma con el nombre" className={entrada} />
              </label>
            </div>
            {nivel === "categoria" && (
              <label className="block text-sm">
                <span className="mb-1 block text-nv-texto2">Categoría del Plan Nacional</span>
                <input maxLength={200} value={ed.categoriaNacional} onChange={(e) => setEd({ ...ed, categoriaNacional: e.target.value })} className={entrada} />
              </label>
            )}
            {nivel !== "subcategoria" && (
              <label className="block text-sm">
                <span className="mb-1 block text-nv-texto2">Descripción</span>
                <textarea rows={3} maxLength={2000} value={ed.descripcion} onChange={(e) => setEd({ ...ed, descripcion: e.target.value })} className={entrada} />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ed.activo} onChange={(e) => setEd({ ...ed, activo: e.target.checked })} className="accent-nv-primario" /> Activa (se muestra en el sitio)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEd(null)} className="rounded-[8px] px-4 py-2 text-sm font-semibold text-nv-primario hover:bg-nv-claro">
                Cancelar
              </button>
              <button disabled={ocupado} className="rounded-[8px] bg-nv-primario px-5 py-2 text-sm font-semibold text-white hover:bg-nv-oscuro disabled:opacity-60">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
