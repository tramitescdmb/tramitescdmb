"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleSlash, Trash2 } from "lucide-react";

type Accion = "cancelar" | "no_realizada" | "eliminar";

const TEXTOS: Record<Accion, { boton: string; placeholder: string; confirmar: string }> = {
  cancelar: { boton: "Cancelar", placeholder: "Motivo de la cancelación", confirmar: "Confirmar" },
  no_realizada: { boton: "No realizada", placeholder: "Por qué no se pudo realizar (sin acceso, no atendieron…)", confirmar: "Confirmar" },
  eliminar: { boton: "Eliminar", placeholder: "Por qué se elimina (queda en el historial)", confirmar: "Eliminar definitivamente" },
};

export function AccionesVisita({
  visitaId,
  puedeNoRealizada,
  puedeCancelar,
  puedeEliminar = false,
  bloqueoEliminar = null,
  trasEliminar,
}: {
  visitaId: string;
  puedeNoRealizada: boolean;
  puedeCancelar: boolean;
  /** Solo administrador y Subdirector(a) SEYCA, y solo si la visita no tiene hoja registrada. */
  puedeEliminar?: boolean;
  /** Por qué no se puede eliminar (se muestra al pulsar «Eliminar»); `null` si no aplica. */
  bloqueoEliminar?: string | null;
  /** Adónde ir después de eliminar (p. ej. desde la propia hoja de la visita). */
  trasEliminar?: string;
}) {
  const router = useRouter();
  const [accion, setAccion] = useState<Accion | null>(null);
  const [verBloqueo, setVerBloqueo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    if (!accion) return;
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(`/api/visitas-programadas/${visitaId}`, {
        method: accion === "eliminar" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accion === "eliminar" ? { motivo } : { accion, motivo }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      const eliminada = accion === "eliminar";
      setAccion(null);
      setMotivo("");
      if (eliminada && trasEliminar) router.push(trasEliminar);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  }

  const boton = "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-50";

  if (accion) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex w-full flex-wrap items-center gap-1.5"
      >
        {accion === "eliminar" && (
          <p className="w-full rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
            La visita se borrará del Planeador de forma definitiva (con su equipo asignado). Queda constancia en el historial del
            expediente y en la auditoría. Si solo no se va a realizar, es preferible cancelarla.
          </p>
        )}
        <input
          autoFocus
          required
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={TEXTOS[accion].placeholder}
          className="min-w-0 flex-1 rounded-md border border-stone-200 px-2 py-1 text-xs"
        />
        <button type="submit" disabled={ocupado} className={`${boton} border-red-200 bg-white text-red-700 hover:bg-red-50`}>
          {TEXTOS[accion].confirmar}
        </button>
        <button type="button" onClick={() => setAccion(null)} className="text-[11px] text-stone-400 hover:text-stone-600">
          Volver
        </button>
        {error && <p className="w-full text-[11px] text-red-700">{error}</p>}
      </form>
    );
  }

  if (verBloqueo && bloqueoEliminar) {
    return (
      <div className="flex w-full flex-wrap items-center gap-1.5">
        <p className="w-full rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">{bloqueoEliminar}</p>
        {puedeCancelar && (
          <button
            type="button"
            onClick={() => {
              setVerBloqueo(false);
              setAccion("cancelar");
            }}
            className={`${boton} border-stone-200 bg-white text-stone-600 hover:bg-stone-50`}
          >
            <Ban className="h-3 w-3" aria-hidden />
            Cancelar en su lugar
          </button>
        )}
        <button type="button" onClick={() => setVerBloqueo(false)} className="text-[11px] text-stone-400 hover:text-stone-600">
          Volver
        </button>
      </div>
    );
  }

  return (
    <>
      {puedeNoRealizada && (
        <button type="button" onClick={() => setAccion("no_realizada")} className={`${boton} border-amber-200 bg-white text-amber-800 hover:bg-amber-50`}>
          <CircleSlash className="h-3 w-3" aria-hidden />
          {TEXTOS.no_realizada.boton}
        </button>
      )}
      {puedeCancelar && (
        <button type="button" onClick={() => setAccion("cancelar")} className={`${boton} border-stone-200 bg-white text-stone-600 hover:bg-stone-50`}>
          <Ban className="h-3 w-3" aria-hidden />
          {TEXTOS.cancelar.boton}
        </button>
      )}
      {(puedeEliminar || (bloqueoEliminar && puedeCancelar)) && (
        <button
          type="button"
          onClick={() => (puedeEliminar ? setAccion("eliminar") : setVerBloqueo(true))}
          className={`${boton} border-red-200 bg-white text-red-700 hover:bg-red-50`}
        >
          <Trash2 className="h-3 w-3" aria-hidden />
          {TEXTOS.eliminar.boton}
        </button>
      )}
    </>
  );
}
