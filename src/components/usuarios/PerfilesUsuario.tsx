"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Wand2, Check, Plus, Minus } from "lucide-react";
import {
  ACCIONES,
  ETIQUETA_ACCION,
  ETIQUETA_MODULO_PERFIL,
  FUNCIONALIDADES,
  FUNCIONALIDAD_POR_CLAVE,
  MODULOS_PERFIL,
  type Accion,
  type Matriz,
  type ModuloPerfil,
} from "@/lib/perfiles-catalogo";
import { permisosEfectivos, tieneAccion, type Excepcion } from "@/lib/perfiles-efectivos";

type PerfilOpcion = { id: string; nombre: string; modulo: string; descripcion: string | null; sugerido: boolean; matriz: Matriz };

const clave = (funcionalidad: string, tipo: Excepcion["tipo"]) => `${funcionalidad}|${tipo}`;

export function PerfilesUsuario({
  usuarioId,
  perfiles,
  asignadosIniciales,
  excepcionesIniciales,
}: {
  usuarioId: string;
  perfiles: PerfilOpcion[];
  asignadosIniciales: string[];
  excepcionesIniciales: Excepcion[];
}) {
  const router = useRouter();
  const [asignados, setAsignados] = useState(() => new Set(asignadosIniciales));
  const [excepciones, setExcepciones] = useState<Map<string, Excepcion>>(
    () => new Map(excepcionesIniciales.map((e) => [clave(e.funcionalidad, e.tipo), e]))
  );
  const [modulo, setModulo] = useState<ModuloPerfil>(() => {
    const conAlgo = MODULOS_PERFIL.find((m) => perfiles.some((p) => p.modulo === m && asignadosIniciales.includes(p.id)));
    return conAlgo ?? "GENERAL";
  });
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const listaExcepciones = [...excepciones.values()].filter((e) => e.acciones.length > 0);
  const efectivos = useMemo(
    () => permisosEfectivos(perfiles.filter((p) => asignados.has(p.id)).map((p) => ({ nombre: p.nombre, matriz: p.matriz })), listaExcepciones),
    [perfiles, asignados, listaExcepciones]
  );

  const resumen = useMemo(() => {
    const r = {} as Record<ModuloPerfil, { perfiles: number; excepciones: number }>;
    for (const m of MODULOS_PERFIL) r[m] = { perfiles: 0, excepciones: 0 };
    for (const p of perfiles) if (asignados.has(p.id) && r[p.modulo as ModuloPerfil]) r[p.modulo as ModuloPerfil].perfiles++;
    for (const e of listaExcepciones) {
      const m = FUNCIONALIDAD_POR_CLAVE.get(e.funcionalidad)?.modulo;
      if (m) r[m].excepciones += e.acciones.length;
    }
    return r;
  }, [perfiles, asignados, listaExcepciones]);

  function alternarPerfil(id: string) {
    setAsignados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
    setEstado(null);
  }

  function aplicarSugeridos() {
    setAsignados(new Set(perfiles.filter((p) => p.sugerido).map((p) => p.id)));
    setEstado(null);
  }

  function editarExcepcion(funcionalidad: string, tipo: Excepcion["tipo"], accion: Accion, poner: boolean) {
    setExcepciones((prev) => {
      const m = new Map(prev);
      const k = clave(funcionalidad, tipo);
      const actual = m.get(k) ?? { funcionalidad, tipo, acciones: [], motivo: null };
      const acciones = poner ? [...new Set([...actual.acciones, accion])] : actual.acciones.filter((a) => a !== accion);
      m.set(k, { ...actual, acciones });
      return m;
    });
    setEstado(null);
  }

  function alternarCelda(funcionalidad: string, accion: Accion) {
    const origen = efectivos[funcionalidad]?.find((o) => o.accion === accion);
    const porPerfil = (origen?.perfiles.length ?? 0) > 0;
    if (origen?.quitadaPorExcepcion) return editarExcepcion(funcionalidad, "QUITAR", accion, false);
    if (origen?.concedidaPorExcepcion) return editarExcepcion(funcionalidad, "CONCEDER", accion, false);
    if (porPerfil) return editarExcepcion(funcionalidad, "QUITAR", accion, true);
    editarExcepcion(funcionalidad, "CONCEDER", accion, true);
  }

  function cambiarMotivo(k: string, motivo: string) {
    setExcepciones((prev) => {
      const m = new Map(prev);
      const e = m.get(k);
      if (e) m.set(k, { ...e, motivo });
      return m;
    });
  }

  async function guardar() {
    setGuardando(true);
    setEstado(null);
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}/perfiles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfilIds: [...asignados], excepciones: listaExcepciones }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      setEstado({ tipo: "ok", texto: "Perfiles guardados." });
      router.refresh();
    } catch (e) {
      setEstado({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo guardar." });
    } finally {
      setGuardando(false);
    }
  }

  const perfilesModulo = perfiles.filter((p) => p.modulo === modulo);
  const funcionalidades = FUNCIONALIDADES.filter((f) => f.modulo === modulo);
  const excepcionesModulo = [...excepciones.entries()].filter(([, e]) => e.acciones.length > 0 && FUNCIONALIDAD_POR_CLAVE.get(e.funcionalidad)?.modulo === modulo);
  const haySugeridos = perfiles.some((p) => p.sugerido);

  return (
    <section className="rounded-md border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Perfiles y permisos</h2>
          <p className="text-xs text-stone-500">
            En preparación: los accesos todavía salen de los roles configurados arriba. Aquí se definen los perfiles que los reemplazarán.
          </p>
        </div>
        {haySugeridos && (
          <button
            type="button"
            onClick={aplicarSugeridos}
            className="inline-flex items-center gap-1.5 rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
          >
            <Wand2 className="h-4 w-4" aria-hidden />
            Asignar según sus roles actuales
          </button>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <nav className="flex overflow-x-auto border-b border-stone-200 lg:flex-col lg:border-b-0 lg:border-r" aria-label="Módulos">
          {MODULOS_PERFIL.map((m) => {
            const sel = m === modulo;
            const r = resumen[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => setModulo(m)}
                className={`flex flex-none items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-left text-sm lg:w-full lg:border-b lg:border-l-[3px] lg:border-b-stone-100 ${
                  sel ? "border-b-cdmb-600 bg-white font-semibold text-stone-900 lg:border-l-cdmb-600" : "border-transparent text-stone-600 hover:bg-stone-50 lg:bg-stone-50/60"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{ETIQUETA_MODULO_PERFIL[m]}</span>
                {r.perfiles > 0 && <span className="rounded-sm bg-sky-100 px-1.5 text-[11px] font-semibold tabular-nums text-sky-800">{r.perfiles}</span>}
                {r.excepciones > 0 && (
                  <span className="rounded-sm bg-amber-100 px-1.5 text-[11px] font-semibold tabular-nums text-amber-800" title="Excepciones">
                    {r.excepciones}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4 p-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Perfiles de {ETIQUETA_MODULO_PERFIL[modulo]}</h3>
            {perfilesModulo.length === 0 ? (
              <p className="text-sm text-stone-400">No hay perfiles en este módulo.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {perfilesModulo.map((p) => (
                  <li key={p.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 ${
                        asignados.has(p.id) ? "border-cdmb-300 bg-cdmb-50/50" : "border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      <input type="checkbox" checked={asignados.has(p.id)} onChange={() => alternarPerfil(p.id)} className="mt-0.5 h-4 w-4" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-stone-800">{p.nombre}</span>
                        {p.descripcion && <span className="block text-xs text-stone-500">{p.descripcion}</span>}
                        {p.sugerido && <span className="mt-0.5 inline-block rounded-sm bg-sky-50 px-1.5 text-[10px] font-medium text-sky-700">Corresponde a su rol actual</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Permisos efectivos</h3>
            <p className="mb-2 text-xs text-stone-500">
              Haga clic en una casilla para crear una excepción solo para esta persona: concede lo que su perfil no da o quita lo que sí da.
            </p>
            <div className="overflow-x-auto rounded border border-stone-200">
              <table className="tabla-listado w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2">Funcionalidad</th>
                    {ACCIONES.map((a) => (
                      <th key={a} className="w-20 px-2 py-2 text-center">
                        {ETIQUETA_ACCION[a]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {funcionalidades.map((f) => (
                    <tr key={f.clave}>
                      <td className="px-3 py-1.5 text-stone-800">{f.nombre}</td>
                      {ACCIONES.map((a) => {
                        if (!f.acciones.includes(a)) {
                          return (
                            <td key={a} className="px-2 py-1.5 text-center text-stone-300">
                              —
                            </td>
                          );
                        }
                        const o = efectivos[f.clave]?.find((x) => x.accion === a);
                        const activo = o ? tieneAccion(o) : false;
                        const titulo = o?.quitadaPorExcepcion
                          ? "Quitado por excepción"
                          : o?.concedidaPorExcepcion && !o.perfiles.length
                            ? "Concedido por excepción"
                            : o?.perfiles.length
                              ? `Por perfil: ${o.perfiles.join(", ")}`
                              : "Sin permiso";
                        return (
                          <td key={a} className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => alternarCelda(f.clave, a)}
                              title={titulo}
                              aria-label={`${f.nombre}, ${ETIQUETA_ACCION[a]}: ${titulo}`}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-sm border ${
                                o?.quitadaPorExcepcion
                                  ? "border-red-300 bg-red-50 text-red-600"
                                  : o?.concedidaPorExcepcion && !o.perfiles.length
                                    ? "border-amber-300 bg-amber-50 text-amber-700"
                                    : activo
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                      : "border-stone-200 text-transparent hover:border-stone-400"
                              }`}
                            >
                              {o?.quitadaPorExcepcion ? (
                                <Minus className="h-3.5 w-3.5" aria-hidden />
                              ) : o?.concedidaPorExcepcion && !o.perfiles.length ? (
                                <Plus className="h-3.5 w-3.5" aria-hidden />
                              ) : (
                                <Check className="h-3.5 w-3.5" aria-hidden />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-50" />Por perfil</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-amber-300 bg-amber-50" />Concedido por excepción</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-red-300 bg-red-50" />Quitado por excepción</span>
            </p>
          </div>

          {excepcionesModulo.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Excepciones de esta persona</h3>
              <ul className="space-y-2">
                {excepcionesModulo.map(([k, e]) => (
                  <li key={k} className="grid grid-cols-1 gap-2 rounded border border-stone-200 px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
                    <span className="text-sm text-stone-700">
                      <span className={e.tipo === "QUITAR" ? "font-semibold text-red-700" : "font-semibold text-amber-700"}>
                        {e.tipo === "QUITAR" ? "Quita" : "Concede"}
                      </span>{" "}
                      {FUNCIONALIDAD_POR_CLAVE.get(e.funcionalidad)?.nombre}: {e.acciones.map((a) => ETIQUETA_ACCION[a]).join(", ")}
                    </span>
                    <input
                      value={e.motivo ?? ""}
                      onChange={(ev) => cambiarMotivo(k, ev.target.value)}
                      placeholder="Motivo (opcional)"
                      className="rounded border border-stone-300 px-2 py-1 text-sm"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-200 px-4 py-2.5">
        {estado && <span className={`text-sm ${estado.tipo === "ok" ? "text-emerald-700" : "text-red-700"}`}>{estado.texto}</span>}
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="inline-flex items-center gap-1.5 rounded bg-acento-500 px-4 py-2 text-sm font-semibold text-white hover:bg-acento-600 disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden />
          {guardando ? "Guardando…" : "Guardar perfiles"}
        </button>
      </div>
    </section>
  );
}
