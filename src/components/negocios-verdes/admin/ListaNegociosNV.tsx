"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Star, Trash2, Upload } from "lucide-react";
import { MUNICIPIOS_NV, normalizarTexto } from "@/lib/negocios-verdes";
import { ESTADOS_CDMB } from "@/lib/negocios-verdes-tablero";
import { LOGO_PROGRAMA_NV } from "@/lib/negocios-verdes-sitio";
import { llamarNV } from "@/lib/negocios-verdes-cliente";
import { InsigniaAvalado, InsigniaEmprendimiento, InsigniaSello, claseChipNV } from "@/components/negocios-verdes/TarjetaNegocio";

export type FilaListaNV = {
  id: string;
  nombre: string;
  municipio: string;
  categoria: string;
  categoriaId: string;
  activo: boolean;
  destacado: boolean;
  conUbicacion: boolean;
  estado: string | null;
  fotoUrl: string | null;
  emprendimientoVerde: boolean;
  selloMarca: boolean;
  avalado: boolean;
};

const POR_PAGINA = 25;

/** Interruptor verde (encendido) / gris (apagado), como el de la plataforma anterior. */
export function InterruptorNV({ valor, alCambiar, etiqueta, deshabilitado }: { valor: boolean; alCambiar: (v: boolean) => void; etiqueta: string; deshabilitado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={deshabilitado}
      onClick={() => alCambiar(!valor)}
      className={`relative h-8 w-[52px] flex-none rounded-full border-2 transition-colors disabled:opacity-40 ${valor ? "border-nv-vivo bg-nv-vivo" : "border-nv-texto2/50 bg-nv-borde/60"}`}
    >
      <span className={`absolute top-1/2 -translate-y-1/2 rounded-full transition-all ${valor ? "left-[22px] h-6 w-6 bg-white" : "left-1.5 h-4 w-4 bg-nv-texto2/70"}`} />
    </button>
  );
}

export const claseSelectNV = "rounded-none border-0 border-b border-nv-texto2/50 bg-transparent px-0 py-1.5 pr-6 text-[15px] focus:border-nv-primario focus:outline-none";
export const claseBotonBordeNV = "inline-flex items-center gap-2 rounded-[8px] border border-nv-vivo bg-white px-5 py-1.5 text-sm font-semibold text-nv-vivo hover:bg-nv-claro disabled:border-nv-borde disabled:text-nv-texto2/60";
export const claseBotonFlotanteNV = "fixed bottom-4 right-4 z-[1000] inline-flex items-center gap-2 rounded-[16px] bg-[#bdeeb8] px-5 py-4 text-sm font-medium text-nv-texto shadow-[0_4px_12px_rgba(0,0,0,0.25)] hover:brightness-95";

/** Paginador «1–25 de 295 · página 1 de 12 · Anterior · Siguiente». */
export function PaginadorNV({ total, pagina, porPagina, alCambiar }: { total: number; pagina: number; porPagina: number; alCambiar: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = total ? (pagina - 1) * porPagina + 1 : 0;
  const hasta = Math.min(total, pagina * porPagina);
  return (
    <div className="mx-auto my-3 flex w-fit flex-wrap items-center justify-center gap-3 border-b border-nv-borde pb-2 text-[13px] text-nv-texto2">
      <span>
        {desde}–{hasta} de {total} · página {pagina} de {paginas}
      </span>
      <button type="button" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)} className={claseBotonBordeNV}>
        <ChevronLeft className="h-4 w-4" aria-hidden /> Anterior
      </button>
      <button type="button" disabled={pagina >= paginas} onClick={() => alCambiar(pagina + 1)} className={claseBotonBordeNV}>
        <ChevronRight className="h-4 w-4" aria-hidden /> Siguiente
      </button>
    </div>
  );
}

type Publicacion = "todos" | "publicados" | "noPublicados" | "sinUbicacion";

/** Listado de negocios del administrador (búsqueda, filtros, interruptor de publicación, destacado, editar y eliminar). */
export function ListaNegociosNV({ negocios, categorias, puedeEditar, puedeEliminar, puedeCrear, porCorregir }: { negocios: FilaListaNV[]; categorias: { id: string; nombre: string }[]; puedeEditar: boolean; puedeEliminar: boolean; puedeCrear: boolean; porCorregir: number }) {
  const router = useRouter();
  const [filas, setFilas] = useState(negocios);
  const [q, setQ] = useState("");
  const [pub, setPub] = useState<Publicacion>("todos");
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [categoria, setCategoria] = useState("");
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const w = normalizarTexto(q).split(" ").filter(Boolean);
    return filas.filter(
      (n) =>
        (pub === "todos" || (pub === "publicados" && n.activo) || (pub === "noPublicados" && !n.activo) || (pub === "sinUbicacion" && !n.conUbicacion)) &&
        (!estado || (n.estado ?? "").toUpperCase() === estado) &&
        (!municipio || n.municipio === municipio) &&
        (!categoria || n.categoriaId === categoria) &&
        w.every((x) => normalizarTexto(n.nombre).includes(x))
    );
  }, [filas, q, pub, estado, municipio, categoria]);
  const p = Math.min(pagina, Math.max(1, Math.ceil(visibles.length / POR_PAGINA)));
  const pag = visibles.slice((p - 1) * POR_PAGINA, p * POR_PAGINA);
  const filtrar = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPagina(1);
  };

  async function cambiar(id: string, cambio: { activo?: boolean; destacado?: boolean }) {
    setError(null);
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...cambio } : f)));
    try {
      await llamarNV(`/api/negocios-verdes/negocios/${id}`, "PATCH", cambio);
    } catch (e) {
      setFilas((fs) => fs.map((f) => (f.id === id ? negocios.find((n) => n.id === id) ?? f : f)));
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function eliminar(n: FilaListaNV) {
    if (!window.confirm(`¿Eliminar «${n.nombre}» con sus fotos y productos? No se puede deshacer.`)) return;
    try {
      await llamarNV(`/api/negocios-verdes/negocios/${n.id}`, "DELETE");
      setFilas((fs) => fs.filter((f) => f.id !== n.id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const chip = (v: Publicacion, t: string) => (
    <button type="button" onClick={() => filtrar(setPub)(v)} aria-pressed={pub === v} className={claseChipNV(pub === v)}>
      {pub === v && <Check className="h-4 w-4" aria-hidden />}
      {t}
    </button>
  );

  return (
    <div className="pb-20">
      {porCorregir > 0 && (
        <p className="mb-3 rounded-[8px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {porCorregir} registro{porCorregir === 1 ? "" : "s"} con correo mal escrito o coordenadas fuera de la jurisdicción.{" "}
          <Link prefetch={false} href="/negocios-verdes/admin/revision" className="font-semibold underline">
            Ver revisión de datos
          </Link>
        </p>
      )}
      <label className="flex items-center gap-3 rounded-[8px] border border-nv-texto2/50 bg-white px-4 focus-within:border-nv-primario">
        <Search className="h-5 w-5 text-nv-texto" aria-hidden />
        <input value={q} onChange={(e) => filtrar(setQ)(e.target.value)} placeholder="Buscar por nombre..." aria-label="Buscar por nombre" className="min-w-0 flex-1 bg-transparent py-3 text-[15px] outline-none" />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3 px-0 sm:px-20">
        {chip("todos", "Todos")}
        {chip("publicados", "Publicados")}
        {chip("noPublicados", "No publicados")}
        {chip("sinUbicacion", "Sin ubicación en el mapa")}
        <select value={estado} onChange={(e) => filtrar(setEstado)(e.target.value)} aria-label="Estado CDMB" className={claseSelectNV}>
          <option value="">Todos los estados</option>
          {ESTADOS_CDMB.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <select value={municipio} onChange={(e) => filtrar(setMunicipio)(e.target.value)} aria-label="Municipio" className={claseSelectNV}>
          <option value="">Todos los municipios</option>
          {MUNICIPIOS_NV.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select value={categoria} onChange={(e) => filtrar(setCategoria)(e.target.value)} aria-label="Categoría" className={`${claseSelectNV} min-w-[300px]`}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <a href="/api/negocios-verdes/exportar" className={claseBotonBordeNV}>
          <Download className="h-4 w-4" aria-hidden /> Exportar CSV ({filas.length})
        </a>
        {puedeCrear && (
          <Link prefetch={false} href="/negocios-verdes/admin/csv" className={claseBotonBordeNV}>
            <Upload className="h-4 w-4" aria-hidden /> Importar CSV
          </Link>
        )}
      </div>
      {error && <p className="mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <PaginadorNV total={visibles.length} pagina={p} porPagina={POR_PAGINA} alCambiar={setPagina} />

      {pag.length === 0 ? (
        <p className="py-12 text-center text-sm text-nv-texto2">No hay negocios con este filtro.</p>
      ) : (
        <ul className="space-y-2.5">
          {pag.map((n) => (
            <li key={n.id} className="flex items-center gap-4 rounded-[12px] border border-nv-borde bg-white px-4 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={n.fotoUrl ?? LOGO_PROGRAMA_NV} alt="" loading="lazy" className="h-12 w-12 flex-none object-contain" />
              <div className="min-w-0 flex-1">
                <Link prefetch={false} href={`/negocios-verdes/admin/negocios/${n.id}`} className="block truncate text-[14px] uppercase tracking-[0.02em] hover:underline">
                  {n.nombre}
                </Link>
                <p className="truncate text-xs text-nv-texto2">
                  {n.categoria} · {n.municipio}
                  {n.estado && n.estado.toUpperCase() !== "ACTIVO" ? ` · ${n.estado.toUpperCase()}` : ""}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {n.emprendimientoVerde && <InsigniaEmprendimiento />}
                  {n.selloMarca && <InsigniaSello />}
                  {n.avalado && <InsigniaAvalado />}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <InterruptorNV valor={n.activo} etiqueta={n.activo ? "Publicado (clic para retirar)" : "No publicado (clic para publicar)"} deshabilitado={!puedeEditar} alCambiar={(v) => void cambiar(n.id, { activo: v })} />
                <button type="button" disabled={!puedeEditar} onClick={() => void cambiar(n.id, { destacado: !n.destacado })} aria-pressed={n.destacado} aria-label={n.destacado ? "Quitar de destacados" : "Marcar como destacado"} title={n.destacado ? "Destacado" : "Marcar como destacado"} className="p-1 text-nv-acento disabled:opacity-40">
                  <Star className="h-5 w-5" fill={n.destacado ? "currentColor" : "none"} aria-hidden />
                </button>
              </div>
              <Link prefetch={false} href={`/negocios-verdes/admin/negocios/${n.id}`} aria-label={`Editar ${n.nombre}`} title="Editar" className="rounded-full p-2 text-nv-texto hover:bg-nv-claro">
                <Pencil className="h-5 w-5" aria-hidden />
              </Link>
              {puedeEliminar && (
                <button type="button" onClick={() => void eliminar(n)} aria-label={`Eliminar ${n.nombre}`} title="Eliminar" className="rounded-full p-2 text-nv-texto hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="h-5 w-5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {visibles.length > POR_PAGINA && <PaginadorNV total={visibles.length} pagina={p} porPagina={POR_PAGINA} alCambiar={setPagina} />}
      {puedeCrear && (
        <Link prefetch={false} href="/negocios-verdes/admin/negocios/nuevo" className={claseBotonFlotanteNV}>
          <Plus className="h-5 w-5" aria-hidden /> Nuevo negocio
        </Link>
      )}
    </div>
  );
}
