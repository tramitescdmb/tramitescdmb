"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Save, Trash2, X } from "lucide-react";
import { MUNICIPIOS_NV, slugNV } from "@/lib/negocios-verdes";
import { CAMPOS_FICHA } from "@/lib/negocios-verdes-ficha";
import type { CatalogosFormularioNV, NegocioEditable } from "@/lib/negocios-verdes-admin";

type Imagen = { ruta: string; url: string | null };
type Producto = { nombre: string; descripcion: string; foto: Imagen | null };

const entrada = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

function Campo({ etiqueta, children, ayuda, ancho }: { etiqueta: string; children: React.ReactNode; ayuda?: string; ancho?: boolean }) {
  return (
    <label className={`block text-sm ${ancho ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block font-medium text-stone-700">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-stone-500">{ayuda}</span>}
    </label>
  );
}

function Seccion({ titulo, children, descripcion }: { titulo: string; children: React.ReactNode; descripcion?: string }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-stone-900">{titulo}</h2>
      {descripcion && <p className="mt-0.5 text-xs text-stone-500">{descripcion}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

async function comprimir(file: File): Promise<File> {
  try {
    const mod = await import("browser-image-compression");
    const r = await mod.default(file, { maxSizeMB: 1.5, maxWidthOrHeight: 1920, useWebWorker: true, initialQuality: 0.82 });
    return new File([r], file.name, { type: r.type || file.type });
  } catch {
    return file;
  }
}

export function FormNegocioNV({
  negocio,
  catalogos,
  puedeEliminar,
}: {
  negocio: NegocioEditable | null;
  catalogos: CatalogosFormularioNV;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const nuevo = !negocio;
  const [d, setD] = useState({
    nombre: negocio?.nombre ?? "",
    slug: negocio?.slug ?? "",
    municipio: negocio?.municipio ?? "",
    veredaId: negocio?.veredaId ?? "",
    direccion: negocio?.direccion ?? "",
    latitud: negocio?.latitud?.toString() ?? "",
    longitud: negocio?.longitud?.toString() ?? "",
    descripcionCorta: negocio?.descripcionCorta ?? "",
    descripcion: negocio?.descripcion ?? "",
    producto: negocio?.producto ?? "",
    telefono: negocio?.telefono ?? "",
    telefonoSecundario: negocio?.telefonoSecundario ?? "",
    whatsapp: negocio?.whatsapp ?? "",
    email: negocio?.email ?? "",
    sitioWeb: negocio?.sitioWeb ?? "",
    facebookUrl: negocio?.facebookUrl ?? "",
    instagramUrl: negocio?.instagramUrl ?? "",
    representanteLegal: negocio?.representanteLegal ?? "",
    categoriaId: negocio?.categoriaId ?? "",
  });
  const [flags, setFlags] = useState({
    activo: negocio?.activo ?? false,
    destacado: negocio?.destacado ?? false,
    avalado: negocio?.avalado ?? false,
    selloMarca: negocio?.selloMarca ?? false,
    emprendimientoVerde: negocio?.emprendimientoVerde ?? false,
  });
  const [categorias, setCategorias] = useState<Set<string>>(new Set(negocio?.categoriaIds ?? []));
  const [subcategorias, setSubcategorias] = useState<Set<string>>(new Set(negocio?.subcategoriaIds ?? []));
  const [actividades, setActividades] = useState<Set<string>>(new Set(negocio?.actividadIds ?? []));
  const [portada, setPortada] = useState<Imagen | null>(negocio?.fotoPortadaRuta ? { ruta: negocio.fotoPortadaRuta, url: negocio.fotoPortadaUrl } : null);
  const [fotos, setFotos] = useState<Imagen[]>(negocio?.fotos ?? []);
  const [productos, setProductos] = useState<Producto[]>(() =>
    [0, 1, 2].map((i) => {
      const p = negocio?.productos.find((x) => x.orden === i);
      return { nombre: p?.nombre ?? "", descripcion: p?.descripcion ?? "", foto: p?.fotoRuta ? { ruta: p.fotoRuta, url: p.fotoUrl } : null };
    })
  );
  const [ficha, setFicha] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS_FICHA.map((c) => [c.clave, negocio?.fichaTecnica[c.clave] != null ? String(negocio.fichaTecnica[c.clave]) : ""]))
  );
  const [puntajes, setPuntajes] = useState<{ anio: string; puntaje: string }[]>(negocio?.puntajes.map((p) => ({ anio: String(p.anio), puntaje: String(p.puntaje) })) ?? []);
  const [actualizadoEn, setActualizadoEn] = useState(negocio?.actualizadoEn ?? null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD((x) => ({ ...x, [k]: e.target.value }));
  const alternar = (conjunto: Set<string>, fijar: (s: Set<string>) => void, id: string) => {
    const s = new Set(conjunto);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    fijar(s);
  };

  const veredas = useMemo(() => catalogos.veredas.filter((v) => v.municipio === d.municipio), [catalogos.veredas, d.municipio]);
  const subsVisibles = catalogos.subcategorias.filter((s) => categorias.has(s.categoriaId) && (s.activo || subcategorias.has(s.id)));
  const actsVisibles = catalogos.actividades.filter((a) => subcategorias.has(a.subcategoriaId) && (a.activo || actividades.has(a.id)));
  const gruposFicha = [...new Set(CAMPOS_FICHA.map((c) => c.grupo))];

  async function subirImagen(file: File, clave: string): Promise<Imagen | null> {
    if (!negocio) return null;
    setSubiendo(clave);
    setMensaje(null);
    try {
      const fd = new FormData();
      fd.append("archivo", await comprimir(file));
      const r = await fetch(`/api/negocios-verdes/negocios/${negocio.id}/imagenes`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "No se pudo subir la imagen.");
      return { ruta: j.ruta, url: j.url };
    } catch (e) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo subir la imagen." });
      return null;
    } finally {
      setSubiendo(null);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    const cuerpo = {
      ...d,
      ...flags,
      slug: d.slug || slugNV(d.nombre),
      veredaId: d.veredaId || null,
      categoriaIds: [...categorias],
      subcategoriaIds: [...subcategorias].filter((id) => subsVisibles.some((s) => s.id === id)),
      actividadIds: [...actividades].filter((id) => actsVisibles.some((a) => a.id === id)),
      fotoPortadaRuta: portada?.ruta ?? null,
      fotos: fotos.map((f) => f.ruta),
      productos: productos.map((p) => ({ nombre: p.nombre, descripcion: p.descripcion, fotoRuta: p.foto?.ruta ?? null })),
      fichaTecnica: ficha,
      actualizadoEn,
    };
    try {
      const r = await fetch(nuevo ? "/api/negocios-verdes/negocios" : `/api/negocios-verdes/negocios/${negocio.id}`, {
        method: nuevo ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "No se pudo guardar.");
      if (!nuevo) {
        const rp = await fetch(`/api/negocios-verdes/negocios/${negocio.id}/puntajes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ puntajes: puntajes.filter((p) => p.anio || p.puntaje) }),
        });
        const jp = await rp.json().catch(() => ({}));
        if (!rp.ok) throw new Error(`Los datos se guardaron, pero los puntajes no: ${jp.error ?? ""}`);
      }
      if (nuevo) {
        router.push(`/negocios-verdes/admin/negocios/${j.id}?creado=1`);
        return;
      }
      setActualizadoEn(j.actualizadoEn);
      setMensaje({ tipo: "ok", texto: "Cambios guardados." });
      router.refresh();
    } catch (e) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo guardar." });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarNegocio() {
    if (!negocio) return;
    const escrito = window.prompt(`Para eliminar «${negocio.nombre}» con todas sus fotos, escriba ELIMINAR:`);
    if (escrito?.trim().toUpperCase() !== "ELIMINAR") return;
    const r = await fetch(`/api/negocios-verdes/negocios/${negocio.id}`, { method: "DELETE" });
    if (r.ok) router.push("/negocios-verdes/admin?eliminado=1");
    else setMensaje({ tipo: "error", texto: (await r.json().catch(() => ({}))).error ?? "No se pudo eliminar." });
  }

  const botonImagen = (clave: string, alElegir: (img: Imagen) => void, texto = "Subir imagen") => (
    <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 ${nuevo ? "pointer-events-none opacity-50" : ""}`}>
      {subiendo === clave ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden />}
      {texto}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={nuevo || subiendo !== null}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const img = await subirImagen(f, clave);
          if (img) alElegir(img);
        }}
      />
    </label>
  );

  return (
    <form onSubmit={guardar} className="space-y-4">
      <Seccion titulo="Datos públicos" descripcion="Lo que verá la ciudadanía en la ficha del negocio cuando esté publicado.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre del negocio *">
            <input required value={d.nombre} onChange={set("nombre")} className={entrada} maxLength={200} />
          </Campo>
          <Campo etiqueta="Dirección en el sitio (slug)" ayuda={`/negocios-verdes/negocio/${d.slug || slugNV(d.nombre) || "…"}${!nuevo ? " · si la cambia, el enlace anterior deja de funcionar" : ""}`}>
            <input value={d.slug} onChange={set("slug")} placeholder={slugNV(d.nombre)} className={entrada} maxLength={120} />
          </Campo>
          <Campo etiqueta="Municipio *">
            <select required value={d.municipio} onChange={(e) => setD((x) => ({ ...x, municipio: e.target.value, veredaId: "" }))} className={entrada}>
              <option value="">Elija…</option>
              {MUNICIPIOS_NV.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Vereda">
            <select value={d.veredaId} onChange={set("veredaId")} className={entrada} disabled={!d.municipio}>
              <option value="">Sin vereda</option>
              {veredas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Dirección" ancho>
            <input value={d.direccion} onChange={set("direccion")} className={entrada} />
          </Campo>
          <Campo etiqueta="Latitud" ayuda="Grados decimales, p. ej. 7.1193">
            <input value={d.latitud} onChange={set("latitud")} inputMode="decimal" className={entrada} />
          </Campo>
          <Campo etiqueta="Longitud" ayuda="Grados decimales, p. ej. -73.1227">
            <input value={d.longitud} onChange={set("longitud")} inputMode="decimal" className={entrada} />
          </Campo>
          <Campo etiqueta="Descripción corta" ancho ayuda="Sale en la tarjeta del buscador.">
            <textarea value={d.descripcionCorta} onChange={set("descripcionCorta")} rows={2} maxLength={400} className={entrada} />
          </Campo>
          <Campo etiqueta="Descripción" ancho>
            <textarea value={d.descripcion} onChange={set("descripcion")} rows={5} maxLength={5000} className={entrada} />
          </Campo>
          <Campo etiqueta="Producto o servicio principal" ancho>
            <input value={d.producto} onChange={set("producto")} className={entrada} />
          </Campo>
          <Campo etiqueta="WhatsApp">
            <input value={d.whatsapp} onChange={set("whatsapp")} inputMode="tel" className={entrada} />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input value={d.telefono} onChange={set("telefono")} inputMode="tel" className={entrada} />
          </Campo>
          <Campo etiqueta="Teléfono secundario">
            <input value={d.telefonoSecundario} onChange={set("telefonoSecundario")} inputMode="tel" className={entrada} />
          </Campo>
          <Campo etiqueta="Correo">
            <input type="email" value={d.email} onChange={set("email")} className={entrada} />
          </Campo>
          <Campo etiqueta="Sitio web">
            <input value={d.sitioWeb} onChange={set("sitioWeb")} className={entrada} />
          </Campo>
          <Campo etiqueta="Facebook">
            <input value={d.facebookUrl} onChange={set("facebookUrl")} className={entrada} />
          </Campo>
          <Campo etiqueta="Instagram">
            <input value={d.instagramUrl} onChange={set("instagramUrl")} className={entrada} />
          </Campo>
          <Campo etiqueta="Representante (se muestra en la ficha)">
            <input value={d.representanteLegal} onChange={set("representanteLegal")} className={entrada} />
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="Clasificación (PNNV 2022-2030)">
        <div className="space-y-4 text-sm">
          <fieldset>
            <legend className="mb-1.5 font-medium text-stone-700">Categorías *</legend>
            <div className="flex flex-wrap gap-2">
              {catalogos.categorias
                .filter((c) => c.activo || categorias.has(c.id) || c.id === d.categoriaId)
                .map((c) => (
                  <label key={c.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 ${categorias.has(c.id) ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-stone-300"}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={categorias.has(c.id)}
                      onChange={() => {
                        alternar(categorias, setCategorias, c.id);
                        if (!d.categoriaId) setD((x) => ({ ...x, categoriaId: c.id }));
                      }}
                    />
                    {c.icono} {c.nombre}
                    {!c.activo && <span className="text-xs text-stone-500">(inactiva)</span>}
                  </label>
                ))}
            </div>
          </fieldset>
          <Campo etiqueta="Categoría principal *">
            <select required value={d.categoriaId} onChange={set("categoriaId")} className={entrada}>
              <option value="">Elija…</option>
              {catalogos.categorias
                .filter((c) => categorias.has(c.id) || c.id === d.categoriaId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </select>
          </Campo>
          {subsVisibles.length > 0 && (
            <fieldset>
              <legend className="mb-1.5 font-medium text-stone-700">Subcategorías</legend>
              <div className="flex flex-wrap gap-2">
                {subsVisibles.map((s) => (
                  <label key={s.id} className={`flex cursor-pointer items-center rounded-full border px-3 py-1 ${subcategorias.has(s.id) ? "border-emerald-500 bg-emerald-50" : "border-stone-300"}`}>
                    <input type="checkbox" className="sr-only" checked={subcategorias.has(s.id)} onChange={() => alternar(subcategorias, setSubcategorias, s.id)} />
                    {s.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {actsVisibles.length > 0 && (
            <fieldset>
              <legend className="mb-1.5 font-medium text-stone-700">Actividades productivas</legend>
              <div className="flex flex-wrap gap-2">
                {actsVisibles.map((a) => (
                  <label key={a.id} className={`flex cursor-pointer items-center rounded-full border px-3 py-1 ${actividades.has(a.id) ? "border-emerald-500 bg-emerald-50" : "border-stone-300"}`}>
                    <input type="checkbox" className="sr-only" checked={actividades.has(a.id)} onChange={() => alternar(actividades, setActividades, a.id)} />
                    {a.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      </Seccion>

      <Seccion titulo="Publicación y reconocimientos">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {(
            [
              ["activo", "Publicado en el sitio público"],
              ["destacado", "Destacado (sale primero)"],
              ["avalado", "Avalado por la CDMB"],
              ["selloMarca", "Sello de marca Negocios Verdes"],
              ["emprendimientoVerde", "Emprendimiento verde"],
            ] as const
          ).map(([k, t]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={flags[k]} onChange={(e) => setFlags((x) => ({ ...x, [k]: e.target.checked }))} className="rounded border-stone-300" />
              {t}
            </label>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Fotos y productos destacados" descripcion={nuevo ? "Guarde el negocio primero; después podrá subir sus fotos." : "JPG, PNG o WebP. Se reducen antes de subir y se guardan en el NAS."}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-24 w-36 overflow-hidden rounded-lg bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {portada?.url && <img src={portada.url} alt="Portada" className="h-full w-full object-cover" />}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-stone-700">Foto de portada</p>
              <div className="flex gap-2">
                {botonImagen("portada", setPortada, portada ? "Cambiar" : "Subir portada")}
                {portada && (
                  <button type="button" onClick={() => setPortada(null)} className="text-xs text-red-700 hover:underline">
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-stone-700">Galería ({fotos.length}/12)</p>
            <div className="flex flex-wrap gap-2">
              {fotos.map((f, i) => (
                <div key={f.ruta} className="relative h-20 w-20 overflow-hidden rounded-lg bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {f.url && <img src={f.url} alt="" className="h-full w-full object-cover" />}
                  <button type="button" aria-label="Quitar foto" onClick={() => setFotos(fotos.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-red-700">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {fotos.length < 12 && botonImagen("galeria", (img) => setFotos((x) => [...x, img]), "Agregar foto")}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {productos.map((p, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-stone-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Producto {i + 1}</p>
                <input
                  value={p.nombre}
                  placeholder="Nombre"
                  maxLength={80}
                  onChange={(e) => setProductos(productos.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                  className={entrada}
                />
                <textarea
                  value={p.descripcion}
                  placeholder="Descripción (máx. 300)"
                  maxLength={300}
                  rows={2}
                  onChange={(e) => setProductos(productos.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))}
                  className={entrada}
                />
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.foto?.url && <img src={p.foto.url} alt="" className="h-12 w-12 rounded object-cover" />}
                  {botonImagen(`producto-${i}`, (img) => setProductos((xs) => xs.map((x, j) => (j === i ? { ...x, foto: img } : x))), p.foto ? "Cambiar foto" : "Foto")}
                  {p.foto && (
                    <button type="button" onClick={() => setProductos(productos.map((x, j) => (j === i ? { ...x, foto: null } : x)))} className="text-xs text-red-700 hover:underline">
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Ficha técnica CDMB (interna)" descripcion="Nunca se muestra en el sitio público.">
        <div className="space-y-5">
          {gruposFicha.map((g) => (
            <fieldset key={g}>
              <legend className="mb-2 text-sm font-semibold text-emerald-800">{g}</legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CAMPOS_FICHA.filter((c) => c.grupo === g).map((c) => {
                  const valor = ficha[c.clave] ?? "";
                  const cambiar = (v: string) => setFicha((x) => ({ ...x, [c.clave]: v }));
                  const lista = `nv-opciones-${c.clave}`;
                  return (
                    <label key={c.clave} className={`block text-sm ${c.tipo === "textoLargo" ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                      <span className="mb-1 block text-stone-700">{c.etiqueta}</span>
                      {c.tipo === "lista" ? (
                        <select value={valor} onChange={(e) => cambiar(e.target.value)} className={entrada}>
                          <option value="">—</option>
                          {c.valores?.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      ) : c.tipo === "textoLargo" ? (
                        <textarea value={valor} onChange={(e) => cambiar(e.target.value)} rows={2} className={entrada} />
                      ) : (
                        <>
                          <input
                            type={c.tipo === "fecha" ? "date" : c.tipo === "entero" ? "number" : "text"}
                            value={valor}
                            onChange={(e) => cambiar(e.target.value)}
                            list={c.catalogo ? lista : undefined}
                            className={entrada}
                          />
                          {c.catalogo && (
                            <datalist id={lista}>
                              {(catalogos.opcionesPorCampo[c.clave] ?? []).map((v) => (
                                <option key={v} value={v} />
                              ))}
                            </datalist>
                          )}
                        </>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </Seccion>

      {!nuevo && (
        <Seccion titulo="Puntajes de seguimiento (internos)" descripcion="Un puntaje de 0 a 100 por año.">
          <div className="space-y-2">
            {puntajes.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={p.anio} onChange={(e) => setPuntajes(puntajes.map((x, j) => (j === i ? { ...x, anio: e.target.value } : x)))} placeholder="Año" inputMode="numeric" className={entrada.replace("w-full", "w-28")} />
                <input value={p.puntaje} onChange={(e) => setPuntajes(puntajes.map((x, j) => (j === i ? { ...x, puntaje: e.target.value } : x)))} placeholder="Puntaje" inputMode="decimal" className={entrada.replace("w-full", "w-32")} />
                <button type="button" aria-label="Quitar año" onClick={() => setPuntajes(puntajes.filter((_, j) => j !== i))} className="rounded p-1 text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setPuntajes([...puntajes, { anio: String(new Date().getFullYear()), puntaje: "" }])} className="text-sm font-medium text-emerald-700 hover:underline">
              + Agregar año
            </button>
          </div>
        </Seccion>
      )}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-stone-200 bg-white/95 px-1 py-3 backdrop-blur">
        <button disabled={guardando || subiendo !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {nuevo ? "Crear negocio" : "Guardar cambios"}
        </button>
        {mensaje && (
          <p role="status" className={`text-sm ${mensaje.tipo === "ok" ? "text-emerald-700" : "text-red-700"}`}>
            {mensaje.texto}
          </p>
        )}
        {!nuevo && puedeEliminar && (
          <button type="button" onClick={eliminarNegocio} className="ml-auto inline-flex items-center gap-1 text-sm text-red-700 hover:underline">
            <Trash2 className="h-4 w-4" aria-hidden /> Eliminar negocio
          </button>
        )}
      </div>
    </form>
  );
}
