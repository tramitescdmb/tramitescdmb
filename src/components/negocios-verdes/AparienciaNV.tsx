"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { llamarNV } from "@/lib/negocios-verdes-cliente";

export type LogoNV = { campo: "logo" | "govco" | "colombia" | "potencia"; titulo: string; url: string | null };
export type BannerNV = { id: string; imagenUrl: string | null; urlDestino: string; abrirEnPestanaNueva: boolean; orden: number; activo: boolean };

const entrada = "w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm";

/** Logos y banners del sitio público. Las imágenes se guardan en el NAS (almacén público de Negocios Verdes). */
export function AparienciaNV({ logos, banners }: { logos: LogoNV[]; banners: BannerNV[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [edicion, setEdicion] = useState<Record<string, BannerNV>>({});

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

  const boton = ({ campo, valor, texto }: { campo: string; valor: string; texto: string }) => (
    <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
      <Upload className="h-3.5 w-3.5" /> {texto}
      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { subir(campo, valor, e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="font-semibold text-stone-900">Logos</h3>
        <p className="text-sm text-stone-600">JPG, PNG o WebP. Al cambiar una imagen, la anterior se borra.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {logos.map((l) => (
            <div key={l.campo} className="space-y-2 rounded-lg border border-stone-100 p-3">
              <p className="text-sm font-medium text-stone-800">{l.titulo}</p>
              <div className="flex h-20 items-center justify-center rounded bg-stone-50">
                {l.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.url} alt={l.titulo} className="max-h-16 max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-stone-400">Sin imagen</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {boton({ campo: "logo", valor: l.campo, texto: l.url ? "Cambiar" : "Subir" })}
                {l.url && (
                  <button type="button" disabled={ocupado} onClick={() => window.confirm(`¿Quitar «${l.titulo}»?`) && ejecutar(() => llamarNV(`/api/negocios-verdes/apariencia?logo=${l.campo}`, "DELETE"))} className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs text-stone-700 hover:bg-red-50">
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-stone-900">Banners de la página de inicio</h3>
          {boton({ campo: "banner", valor: "nuevo", texto: "Agregar banner" })}
        </div>
        {banners.length === 0 && <p className="text-sm text-stone-500">No hay banners.</p>}
        <ul className="space-y-3">
          {banners.map((b) => {
            const e = edicion[b.id] ?? b;
            const cambiado = JSON.stringify(e) !== JSON.stringify(b);
            const set = (c: Partial<BannerNV>) => setEdicion({ ...edicion, [b.id]: { ...e, ...c } });
            return (
              <li key={b.id} className="grid gap-3 rounded-lg border border-stone-100 p-3 md:grid-cols-[12rem_1fr]">
                {b.imagenUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.imagenUrl} alt="Banner" className="h-24 w-full rounded object-cover" />
                ) : (
                  <div className="h-24 rounded bg-stone-100" />
                )}
                <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
                  <label className="text-xs text-stone-600">
                    Enlace al hacer clic (opcional)
                    <input value={e.urlDestino} onChange={(ev) => set({ urlDestino: ev.target.value })} placeholder="https://… o /negocios-verdes/…" className={entrada} />
                  </label>
                  <label className="text-xs text-stone-600">
                    Orden
                    <input type="number" min={0} value={e.orden} onChange={(ev) => set({ orden: Number(ev.target.value) })} className={entrada} />
                  </label>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-stone-700 sm:col-span-2">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={e.activo} onChange={(ev) => set({ activo: ev.target.checked })} /> Visible
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={e.abrirEnPestanaNueva} onChange={(ev) => set({ abrirEnPestanaNueva: ev.target.checked })} /> Abrir en pestaña nueva
                    </label>
                    <span className="flex-1" />
                    <button
                      type="button"
                      disabled={!cambiado || ocupado}
                      onClick={async () => {
                        if (await ejecutar(() => llamarNV("/api/negocios-verdes/apariencia", "PUT", e))) {
                          const { [b.id]: _quitar, ...resto } = edicion;
                          void _quitar;
                          setEdicion(resto);
                        }
                      }}
                      className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
                    >
                      Guardar
                    </button>
                    <button type="button" disabled={ocupado} aria-label="Eliminar banner" onClick={() => window.confirm("¿Eliminar este banner?") && ejecutar(() => llamarNV(`/api/negocios-verdes/apariencia?banner=${b.id}`, "DELETE"))} className="rounded p-1 text-stone-500 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
