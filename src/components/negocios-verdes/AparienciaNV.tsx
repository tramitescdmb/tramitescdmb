"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Image as ImagenIcono, Pencil, Plus, Trash2, X } from "lucide-react";
import { llamarNV } from "@/lib/negocios-verdes-cliente";
import { InterruptorNV } from "@/components/negocios-verdes/admin/ListaNegociosNV";

export type LogoNV = { campo: "logo" | "govco" | "colombia" | "potencia"; titulo: string; ayuda: string; url: string | null };
export type BannerNV = { id: string; imagenUrl: string | null; urlDestino: string; abrirEnPestanaNueva: boolean; orden: number; activo: boolean };

const entrada = "w-full rounded-[8px] border border-nv-borde bg-white px-3 py-2 text-sm focus:border-nv-primario focus:outline-none";
const TIPOS = "image/jpeg,image/png,image/webp";
/** Ancho mínimo (px) para que un banner se vea nítido a todo el ancho en pantallas de escritorio. */
const ANCHO_MINIMO = 1920;
/** Medidas de referencia del banner, visibles donde se suben. */
const MEDIDAS_BANNER: [string, string][] = [
  ["Mínimo", "1920 × 480 px"],
  ["Recomendado", "2560 × 640 px"],
  ["Proporción", "4:1 (ancho 4 veces el alto)"],
  ["Formato", "JPG o WebP, menos de 2 MB"],
];

/** Recuadro con las medidas del banner: un rectángulo 4:1 a escala y la lista de medidas. */
function MedidasBannerNV({ compacto = false }: { compacto?: boolean }) {
  if (compacto) {
    return (
      <p className="rounded-[8px] bg-nv-claro px-3 py-2 text-xs text-nv-texto">
        <strong>Medidas del banner:</strong> mínimo 1920 × 480 px · recomendado 2560 × 640 px · proporción 4:1 · JPG o WebP de menos de 2 MB.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-4 rounded-[12px] border border-nv-borde bg-nv-claro p-4 sm:flex-row sm:items-center">
      <div className="flex aspect-[4/1] w-full max-w-[320px] shrink-0 flex-col items-center justify-center rounded-[6px] border-2 border-dashed border-nv-primario bg-white text-nv-primario">
        <span className="text-base font-semibold leading-tight">1920 × 480 px</span>
        <span className="text-[11px]">mínimo · proporción 4:1</span>
      </div>
      <dl className="grid flex-1 grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {MEDIDAS_BANNER.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="text-nv-texto2">{k}:</dt>
            <dd className="font-semibold text-nv-texto">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * «Apariencia del sitio», como en la plataforma anterior: logo y sellos institucionales, y banners
 * del inicio (orden, visible, enlace). Las imágenes se guardan en el NAS (almacén público de Negocios Verdes).
 */
export function AparienciaNV({ logos, banners }: { logos: LogoNV[]; banners: BannerNV[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState<BannerNV | null>(null);
  /** Tamaño real (px) de cada banner, leído al cargar la miniatura. */
  const [tamanos, setTamanos] = useState<Record<string, [number, number]>>({});

  async function ejecutar(fn: () => Promise<unknown>) {
    setOcupado(true);
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function subir(campo: string, valor: string, archivo: File | undefined) {
    if (!archivo) return;
    const fd = new FormData();
    fd.append(campo, valor);
    fd.append("archivo", archivo);
    void ejecutar(() => llamarNV("/api/negocios-verdes/apariencia", "POST", fd));
  }

  /** Mueve un banner una posición y renumera el orden de todos los que cambian. */
  function mover(i: number, d: -1 | 1) {
    const lista = [...banners];
    [lista[i], lista[i + d]] = [lista[i + d], lista[i]];
    const cambios = lista.map((b, orden) => ({ ...b, orden })).filter((b, k) => b.orden !== banners.find((x) => x.id === lista[k].id)!.orden);
    void ejecutar(() => Promise.all(cambios.map((b) => llamarNV("/api/negocios-verdes/apariencia", "PUT", b))));
  }

  return (
    <div className="space-y-6 pb-10">
      <h2 className="text-[26px] font-normal">Apariencia del sitio</h2>
      {error && <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-[12px] border border-nv-borde bg-white p-4">
        <h3 className="text-[17px] font-medium">Logo e identidad institucional</h3>
        <p className="mt-1 text-[13px] text-nv-texto2">Negocios Verdes es un micrositio de la Sede Electrónica de la CDMB: estos sellos aparecen en el pie de página igual que en esa página. Use PNG con fondo transparente si es posible.</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {logos.map((l) => (
            <div key={l.campo}>
              <p className="mb-1.5 text-[15px]">{l.titulo}</p>
              <div className="flex items-center gap-4">
                <div className={`flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-[12px] ${l.campo === "govco" ? "bg-nv-oscuro" : "bg-nv-claro"}`}>
                  {l.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.url} alt={l.titulo} className="max-h-14 max-w-14 object-contain" />
                  ) : (
                    <ImagenIcono className="h-6 w-6 text-nv-vivo" aria-hidden />
                  )}
                </div>
                <label className={`cursor-pointer px-2 text-sm font-semibold text-nv-vivo hover:underline ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
                  {l.url ? "Cambiar" : "Subir"}
                  <input type="file" accept={TIPOS} className="sr-only" onChange={(e) => { subir("logo", l.campo, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {l.url && (
                  <button type="button" disabled={ocupado} onClick={() => window.confirm(`¿Quitar «${l.titulo}»?`) && ejecutar(() => llamarNV(`/api/negocios-verdes/apariencia?logo=${l.campo}`, "DELETE"))} className="text-sm text-nv-texto2 hover:text-red-700">
                    Quitar
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-nv-texto2">{l.ayuda}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[17px] font-medium">Banners del inicio</h3>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-[8px] bg-nv-acento px-5 py-1.5 text-[15px] font-semibold text-white hover:bg-nv-acento-oscuro ${ocupado ? "pointer-events-none opacity-60" : ""}`}>
            <Plus className="h-4 w-4" aria-hidden /> Agregar banner
            <input type="file" accept={TIPOS} className="sr-only" onChange={(e) => { subir("banner", "nuevo", e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
        <p className="mt-1 text-[13px] text-nv-texto2">Imágenes tipo banner (sin texto encima: si hace falta texto, va dentro de la propia imagen) que rotan arriba del inicio. Si no hay ninguno activo, se muestran 4 diapositivas genéricas por defecto. Se muestran a todo el ancho de la pantalla: para que se vean nítidos, respete estas medidas.</p>
        <MedidasBannerNV />
        <ul className="mt-4 space-y-3">
          {banners.map((b, i) => (
            <li key={b.id} className="flex items-center gap-4 rounded-[12px] border border-nv-borde bg-white px-4 py-4">
              {b.imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.imagenUrl} alt="" onLoad={(e) => { const { naturalWidth: w, naturalHeight: h } = e.currentTarget; setTamanos((t) => (t[b.id]?.[0] === w ? t : { ...t, [b.id]: [w, h] })); }} className="h-14 w-24 flex-none rounded-[8px] object-cover" />
              ) : (
                <span className="h-14 w-24 flex-none rounded-[8px] bg-nv-claro" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px]">{b.urlDestino || "Sin destino (decorativo)"}</p>
                {tamanos[b.id] && (
                  <p className={`text-xs ${tamanos[b.id]![0] < ANCHO_MINIMO ? "text-red-700" : "text-nv-texto2"}`}>
                    {tamanos[b.id]![0]} × {tamanos[b.id]![1]} px
                    {tamanos[b.id]![0] < ANCHO_MINIMO && ` · baja resolución: se verá borroso a todo el ancho; suba una de al menos ${ANCHO_MINIMO} px de ancho`}
                  </p>
                )}
              </div>
              <div className="flex flex-col">
                <button type="button" aria-label="Subir" disabled={i === 0 || ocupado} onClick={() => mover(i, -1)} className="rounded p-0.5 text-nv-texto2 hover:text-nv-texto disabled:opacity-30">
                  <ArrowUp className="h-5 w-5" />
                </button>
                <button type="button" aria-label="Bajar" disabled={i === banners.length - 1 || ocupado} onClick={() => mover(i, 1)} className="rounded p-0.5 text-nv-texto2 hover:text-nv-texto disabled:opacity-30">
                  <ArrowDown className="h-5 w-5" />
                </button>
              </div>
              <InterruptorNV valor={b.activo} deshabilitado={ocupado} alCambiar={(v) => ejecutar(() => llamarNV("/api/negocios-verdes/apariencia", "PUT", { ...b, activo: v }))} etiqueta={b.activo ? "Visible: ocultar" : "Oculto: mostrar"} />
              <button type="button" aria-label="Editar banner" onClick={() => setEditando(b)} className="rounded-full p-1.5 hover:bg-black/5">
                <Pencil className="h-5 w-5" />
              </button>
              <button type="button" aria-label="Eliminar banner" disabled={ocupado} onClick={() => window.confirm("¿Eliminar este banner?") && ejecutar(() => llamarNV(`/api/negocios-verdes/apariencia?banner=${b.id}`, "DELETE"))} className="rounded-full p-1.5 hover:bg-black/5">
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
          {banners.length === 0 && <li className="rounded-[12px] border border-dashed border-nv-borde bg-white px-4 py-6 text-center text-sm text-nv-texto2">No hay banners: el inicio muestra las 4 diapositivas por defecto.</li>}
        </ul>
      </section>

      {editando && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-banner">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await ejecutar(() => llamarNV("/api/negocios-verdes/apariencia", "PUT", editando))) setEditando(null);
            }}
            className="w-full max-w-lg space-y-4 rounded-[16px] bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="titulo-banner" className="text-xl font-medium">
                Editar banner
              </h2>
              <button type="button" aria-label="Cerrar" onClick={() => setEditando(null)} className="rounded-full p-1.5 hover:bg-black/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            {editando.imagenUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={editando.imagenUrl} alt="" className="max-h-40 w-full rounded-[8px] object-cover" />
            )}
            {editando.imagenUrl && tamanos[editando.id] && (
              <p className={`text-xs ${tamanos[editando.id]![0] < ANCHO_MINIMO ? "text-red-700" : "text-nv-texto2"}`}>
                Imagen actual: {tamanos[editando.id]![0]} × {tamanos[editando.id]![1]} px
              </p>
            )}
            <MedidasBannerNV compacto />
            <label className="block text-sm">
              <span className="mb-1 block text-nv-texto2">Enlace al hacer clic (opcional)</span>
              <input value={editando.urlDestino} onChange={(e) => setEditando({ ...editando, urlDestino: e.target.value })} placeholder="https://… o /negocios-verdes/…" className={entrada} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editando.abrirEnPestanaNueva} onChange={(e) => setEditando({ ...editando, abrirEnPestanaNueva: e.target.checked })} className="accent-nv-primario" /> Abrir en otra pestaña
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editando.activo} onChange={(e) => setEditando({ ...editando, activo: e.target.checked })} className="accent-nv-primario" /> Visible en el inicio
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditando(null)} className="rounded-[8px] px-4 py-2 text-sm font-semibold text-nv-primario hover:bg-nv-claro">
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
