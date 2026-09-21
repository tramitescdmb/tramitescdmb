"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Pencil, Trash2, Plus, X } from "lucide-react";
import type { EtapaContratacion, ModalidadSeleccion } from "@prisma/client";
import { ETAPAS_ORDEN, ETIQUETA_ETAPA, ETIQUETA_MODALIDAD, ORDEN_MODALIDADES } from "@/lib/contratacion";

export type RequisitoCatalogo = {
  id: string;
  etapa: EtapaContratacion;
  modalidadSeleccion: ModalidadSeleccion | null;
  orden: number;
  nombre: string;
  codigoFormato: string | null;
  fuente: string | null;
  notaOrigenExterno: string | null;
  obligatorio: boolean;
  gestionadoEnSecop: boolean;
  activo: boolean;
};

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

/** Pantalla administrable del catálogo de requisitos documentales — antes solo se podía
 * agregar/reordenar/activar editando `data/contratacion/requisitos.json` y corriendo el seed. Los
 * cambios se reflejan de inmediato en el checklist de cada expediente (mismo `activo`/`orden` que
 * ya consume `obtenerRequisitosDeEtapa`). Reservado al Administrador de Contratación.
 *
 * Navegación por MODALIDAD primero (no por etapa): mostrar las 10 modalidades desplegadas a la vez
 * dentro de cada etapa hacía ver el catálogo como si todo fuera común a todas — en Precontractual,
 * el 90% de los requisitos SÍ dependen de la modalidad (ver data/contratacion/requisitos.json).
 * Elegir una modalidad muestra su checklist real por etapa: los comunes de esa etapa + los propios
 * de la modalidad, separados y etiquetados, para que quede claro qué se está editando. */
export function CatalogoRequisitosAdmin({ requisitos }: { requisitos: RequisitoCatalogo[] }) {
  const router = useRouter();
  const [modalidad, setModalidad] = useState<ModalidadSeleccion>(ORDEN_MODALIDADES[0]);
  const [error, setError] = useState<string | null>(null);
  const [agregarEn, setAgregarEn] = useState<EtapaContratacion | null>(null);
  const [editando, setEditando] = useState<RequisitoCatalogo | null>(null);

  async function accion(fn: () => Promise<Response>) {
    setError(null);
    const res = await fn();
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "No se pudo completar la acción.");
      return;
    }
    router.refresh();
  }

  const mover = (id: string, direccion: "arriba" | "abajo") =>
    accion(() => fetch(`/api/contratacion/catalogo/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direccion }) }));

  const alternar = (id: string, campo: "activo" | "obligatorio", valorActual: boolean) =>
    accion(() => fetch(`/api/contratacion/catalogo/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [campo]: !valorActual }) }));

  const eliminar = (id: string) => {
    if (!window.confirm("¿Eliminar este requisito del catálogo? Si ya tiene documentos cargados, use Desactivar en su lugar.")) return;
    accion(() => fetch(`/api/contratacion/catalogo/${id}`, { method: "DELETE" }));
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50/80 p-1">
        {ORDEN_MODALIDADES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModalidad(m)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              modalidad === m ? "bg-white text-techblue-700 shadow-soft ring-1 ring-techblue-200" : "text-stone-500 hover:bg-white/70 hover:text-stone-800"
            }`}
          >
            {ETIQUETA_MODALIDAD[m]}
          </button>
        ))}
      </div>

      {ETAPAS_ORDEN.map((etapa) => {
        const deEstaEtapa = requisitos.filter((r) => r.etapa === etapa);
        const grupos: { modalidad: ModalidadSeleccion | null; items: RequisitoCatalogo[] }[] = [
          { modalidad: null, items: deEstaEtapa.filter((r) => r.modalidadSeleccion === null) },
          { modalidad, items: deEstaEtapa.filter((r) => r.modalidadSeleccion === modalidad) },
        ].filter((g) => g.items.length > 0);

        return (
          <details key={etapa} open className="rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold text-stone-900">{ETIQUETA_ETAPA[etapa]}</span>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setAgregarEn(etapa); }}
                className="inline-flex items-center gap-1 rounded-md border border-techblue-200 bg-techblue-50 px-2.5 py-1 text-xs font-medium text-techblue-700 hover:bg-techblue-100"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Agregar requisito
              </button>
            </summary>

            {grupos.length === 0 ? (
              <p className="mt-3 text-xs text-stone-400">Sin requisitos para {ETIQUETA_MODALIDAD[modalidad].toLowerCase()} en esta etapa.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {grupos.map((g) => (
                  <div key={g.modalidad ?? "comun"}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
                      {g.modalidad ? `Específico de ${ETIQUETA_MODALIDAD[g.modalidad]}` : "Común a todas las modalidades"}
                    </p>
                    <ul className="divide-y divide-stone-100 rounded-lg border border-stone-100">
                      {g.items.map((r, i) => (
                        <li key={r.id} className={`flex flex-wrap items-center gap-2 p-2.5 text-sm ${r.activo ? "" : "opacity-50"}`}>
                          <div className="flex flex-none flex-col">
                            <button type="button" disabled={i === 0} onClick={() => mover(r.id, "arriba")} className="text-stone-400 hover:text-stone-700 disabled:opacity-20" title="Subir">
                              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button type="button" disabled={i === g.items.length - 1} onClick={() => mover(r.id, "abajo")} className="text-stone-400 hover:text-stone-700 disabled:opacity-20" title="Bajar">
                              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-stone-800">{r.nombre}</p>
                            {(r.codigoFormato || r.fuente) && (
                              <p className="truncate text-xs text-stone-400">
                                {r.codigoFormato && `${r.codigoFormato} · `}
                                {r.fuente}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => alternar(r.id, "obligatorio", r.obligatorio)}
                            className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-medium ${r.obligatorio ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-500"}`}
                          >
                            {r.obligatorio ? "Obligatorio" : "Opcional"}
                          </button>
                          <button
                            type="button"
                            onClick={() => alternar(r.id, "activo", r.activo)}
                            className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-medium ${r.activo ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"}`}
                          >
                            {r.activo ? "Activo" : "Inactivo"}
                          </button>
                          <button type="button" onClick={() => setEditando(r)} title="Editar" className="flex-none text-stone-400 hover:text-stone-700">
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button type="button" onClick={() => eliminar(r.id)} title="Eliminar" className="flex-none text-stone-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </details>
        );
      })}

      {agregarEn && (
        <ModalAgregarRequisito
          etapa={agregarEn}
          modalidadSugerida={modalidad}
          onClose={() => setAgregarEn(null)}
          onSaved={() => { setAgregarEn(null); router.refresh(); }}
        />
      )}
      {editando && <ModalEditarRequisito requisito={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); router.refresh(); }} />}
    </div>
  );
}

function ModalAgregarRequisito({
  etapa,
  modalidadSugerida,
  onClose,
  onSaved,
}: {
  etapa: EtapaContratacion;
  modalidadSugerida: ModalidadSeleccion;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [codigoFormato, setCodigoFormato] = useState("");
  const [fuente, setFuente] = useState("");
  const [modalidadSeleccion, setModalidadSeleccion] = useState<string>(modalidadSugerida);
  const [obligatorio, setObligatorio] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!nombre.trim()) return setError("El nombre es obligatorio.");
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/contratacion/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapa, nombre, codigoFormato: codigoFormato || null, fuente: fuente || null, modalidadSeleccion: modalidadSeleccion || null, obligatorio }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo crear el requisito.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">Agregar requisito — {ETIQUETA_ETAPA[etapa]}</h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-stone-600">
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-stone-600">
            Código de formato (opcional)
            <input value={codigoFormato} onChange={(e) => setCodigoFormato(e.target.value)} placeholder="Ej. A-BS-FO92" className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-stone-600">
            Fuente (opcional)
            <input value={fuente} onChange={(e) => setFuente(e.target.value)} placeholder="Ej. Manual A-BS-MA01, num. 6.2" className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-stone-600">
            Modalidad
            <select value={modalidadSeleccion} onChange={(e) => setModalidadSeleccion(e.target.value)} className={`mt-1 ${inputCls}`}>
              <option value="">Común a todas</option>
              {ORDEN_MODALIDADES.map((m) => (
                <option key={m} value={m}>{ETIQUETA_MODALIDAD[m]}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={obligatorio} onChange={(e) => setObligatorio(e.target.checked)} className="rounded border-stone-300" />
            Obligatorio
          </label>
        </div>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="mt-4 w-full rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Agregar"}
        </button>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}

function ModalEditarRequisito({ requisito, onClose, onSaved }: { requisito: RequisitoCatalogo; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(requisito.nombre);
  const [codigoFormato, setCodigoFormato] = useState(requisito.codigoFormato ?? "");
  const [fuente, setFuente] = useState(requisito.fuente ?? "");
  const [notaOrigenExterno, setNotaOrigenExterno] = useState(requisito.notaOrigenExterno ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!nombre.trim()) return setError("El nombre es obligatorio.");
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/catalogo/${requisito.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, codigoFormato: codigoFormato || null, fuente: fuente || null, notaOrigenExterno: notaOrigenExterno || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">Editar requisito</h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-stone-600">
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-stone-600">
            Código de formato
            <input value={codigoFormato} onChange={(e) => setCodigoFormato(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-stone-600">
            Fuente
            <input value={fuente} onChange={(e) => setFuente(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-stone-600">
            Nota (ej. si se gestiona fuera de esta plataforma)
            <input value={notaOrigenExterno} onChange={(e) => setNotaOrigenExterno(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
        </div>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="mt-4 w-full rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}
