"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Undo2, X } from "lucide-react";

type Doc = { id: string; titulo: string; nombre: string };
type Requisito = { id: string; nombre: string };
type Pendiente = { plazoHasta: string; mensaje: string; items: { titulo: string; motivo: string; respondido: boolean }[] };

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

/**
 * Ficha del trámite (solo solicitudes en línea): devolver al solicitante para corregir o completar
 * documentos en el mismo expediente, o retirar la devolución pendiente.
 */
export function DevolverCorreccion({
  expedienteId,
  documentos,
  requisitos,
  plazoSugerido,
  pendiente,
  puedeGestionar,
  tieneCorreo,
}: {
  expedienteId: string;
  documentos: Doc[];
  requisitos: Requisito[];
  plazoSugerido: string;
  pendiente: Pendiente | null;
  puedeGestionar: boolean;
  tieneCorreo: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [faltantes, setFaltantes] = useState<{ requisitoId: string; titulo: string; motivo: string }[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [plazo, setPlazo] = useState(plazoSugerido);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function llamar(url: string, datos?: unknown) {
    setError(null);
    setOcupado(true);
    try {
      const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos ?? {}) });
      const r = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(r.error || "No se pudo completar.");
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar.");
    } finally {
      setOcupado(false);
    }
  }

  if (pendiente) {
    return (
      <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-semibold">Devuelta al solicitante para corrección · plazo hasta el {pendiente.plazoHasta}</p>
        <ul className="mt-1 list-disc pl-5">
          {pendiente.items.map((i, n) => (
            <li key={n}>
              <strong>{i.titulo}</strong>: {i.motivo}
            </li>
          ))}
        </ul>
        {pendiente.mensaje && <p className="mt-1 whitespace-pre-line">{pendiente.mensaje}</p>}
        {error && <p className="mt-2 text-red-700">{error}</p>}
        {puedeGestionar && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => llamar(`/api/expedientes/${expedienteId}/correccion/cancelar`)}
            className="mt-2 text-xs font-medium text-amber-900 underline hover:no-underline"
          >
            Retirar la devolución
          </button>
        )}
      </div>
    );
  }
  if (!puedeGestionar) return null;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
      >
        <Undo2 className="h-3.5 w-3.5" aria-hidden /> Devolver para corrección
      </button>
    );
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const items = [
      ...documentos.filter((d) => marcados[d.id]).map((d) => ({ documentoId: d.id, motivo: motivos[d.id] ?? "" })),
      ...faltantes.map((f) => ({ requisitoId: f.requisitoId || undefined, titulo: f.titulo, motivo: f.motivo })),
    ];
    void llamar(`/api/expedientes/${expedienteId}/correccion`, { items, mensaje, plazoHasta: plazo });
  }

  return (
    <form onSubmit={enviar} className="mt-3 space-y-3 rounded-xl border border-amber-300 bg-white p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-stone-900">Devolver al solicitante para corrección</p>
          <p className="text-xs text-stone-500">
            El solicitante verá lo que escriba aquí y cargará solo esos documentos, en este mismo expediente. El trámite queda en «Información
            adicional requerida» hasta que responda. Vencido el plazo no se hace nada automático.
          </p>
          {!tieneCorreo && <p className="mt-1 text-xs font-medium text-amber-700">El solicitante no dejó correo: comuníquele la devolución por teléfono.</p>}
        </div>
        <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-stone-400 hover:text-stone-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-red-700">{error}</div>}

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-stone-500">Documentos radicados que debe corregir</legend>
        {documentos.length === 0 && <p className="text-xs text-stone-500">No hay documentos radicados por el solicitante.</p>}
        {documentos.map((d) => (
          <div key={d.id} className="rounded-md border border-stone-200 p-2">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={Boolean(marcados[d.id])} onChange={(e) => setMarcados((m) => ({ ...m, [d.id]: e.target.checked }))} className="mt-1" />
              <span>
                <span className="block text-stone-800">{d.titulo}</span>
                {d.titulo !== d.nombre && <span className="block text-[11px] text-stone-400">{d.nombre}</span>}
              </span>
            </label>
            {marcados[d.id] && (
              <textarea
                value={motivos[d.id] ?? ""}
                onChange={(e) => setMotivos((m) => ({ ...m, [d.id]: e.target.value }))}
                className={`${inputCls} mt-2`}
                rows={2}
                maxLength={2000}
                placeholder="Qué está mal y cómo corregirlo (lo verá el solicitante)"
              />
            )}
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-stone-500">Documentos que faltan</legend>
        {faltantes.map((f, n) => (
          <div key={n} className="space-y-2 rounded-md border border-stone-200 p-2">
            <div className="flex gap-2">
              <select
                value={f.requisitoId}
                onChange={(e) => {
                  const r = requisitos.find((x) => x.id === e.target.value);
                  setFaltantes((l) => l.map((x, i) => (i === n ? { ...x, requisitoId: e.target.value, titulo: r?.nombre ?? x.titulo } : x)));
                }}
                className={inputCls}
              >
                <option value="">Otro documento (escriba el nombre)</option>
                {requisitos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setFaltantes((l) => l.filter((_, i) => i !== n))} aria-label="Quitar" className="text-stone-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            {!f.requisitoId && (
              <input
                value={f.titulo}
                onChange={(e) => setFaltantes((l) => l.map((x, i) => (i === n ? { ...x, titulo: e.target.value } : x)))}
                className={inputCls}
                maxLength={200}
                placeholder="Nombre del documento"
              />
            )}
            <textarea
              value={f.motivo}
              onChange={(e) => setFaltantes((l) => l.map((x, i) => (i === n ? { ...x, motivo: e.target.value } : x)))}
              className={inputCls}
              rows={2}
              maxLength={2000}
              placeholder="Qué debe aportar (lo verá el solicitante)"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFaltantes((l) => [...l, { requisitoId: "", titulo: "", motivo: "" }])}
          className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar documento faltante
        </button>
      </fieldset>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Mensaje general (opcional)</span>
        <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} className={`${inputCls} mt-1`} rows={2} maxLength={3000} />
      </label>
      <label className="block max-w-xs">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Plazo para responder</span>
        <input type="date" value={plazo} onChange={(e) => setPlazo(e.target.value)} className={`${inputCls} mt-1`} required />
        <span className="mt-1 block text-[11px] text-stone-400">Por defecto, un mes (art. 17 CPACA).</span>
      </label>
      <button
        type="submit"
        disabled={ocupado}
        className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Undo2 className="h-4 w-4" aria-hidden />}
        Devolver y avisar al solicitante
      </button>
    </form>
  );
}
