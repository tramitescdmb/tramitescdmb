"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CalendarClock, X, AlertTriangle } from "lucide-react";
import { BuscadorExpediente } from "@/components/planeador/BuscadorExpediente";
import { sumarMinutosHora } from "@/lib/planeador";

function minutos(hora: string) {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

export type ValoresVisita = { fecha: string; hora: string; horaFin: string; lugar: string; profesionalId: string; observaciones: string };
export type ExpedienteParaVisita = {
  id: string;
  numero: string;
  tramite: string;
  solicitante: string;
  identificacion: string;
  municipio: string;
  otrosIdentificadores: string[];
  lugar: string;
  asignados: { id: string; nombre: string }[];
  porProgramar: boolean;
};

export function ModalVisita({
  titulo,
  endpoint,
  metodo,
  profesionales,
  iniciales,
  expedientes,
  expedienteInicial,
  onCerrar,
}: {
  titulo: string;
  endpoint?: string;
  metodo: "POST" | "PATCH";
  profesionales?: { id: string; nombre: string }[];
  iniciales: ValoresVisita;
  expedientes?: ExpedienteParaVisita[];
  expedienteInicial?: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [valores, setValores] = useState<ValoresVisita>(() => {
    const exp = expedientes?.find((e) => e.id === expedienteInicial);
    if (!exp) return iniciales;
    return { ...iniciales, lugar: iniciales.lugar || exp.lugar, profesionalId: exp.asignados.length === 1 ? exp.asignados[0]!.id : "" };
  });
  const [expedienteId, setExpedienteId] = useState(expedienteInicial ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cruce, setCruce] = useState(false);

  const expediente = expedientes?.find((e) => e.id === expedienteId);
  const opcionesProfesional = expedientes ? (expediente?.asignados ?? []) : (profesionales ?? []);
  const destino = expedientes ? (expediente ? `/api/expedientes/${expediente.id}/visitas-programadas` : null) : endpoint;

  const campo = (k: keyof ValoresVisita) => (e: { target: { value: string } }) => {
    const valor = e.target.value;
    setValores((v) => {
      const siguiente = { ...v, [k]: valor };
      if (k === "hora" && valor && (!v.horaFin || v.horaFin <= valor)) {
        const duracion = v.hora && v.horaFin > v.hora ? minutos(v.horaFin) - minutos(v.hora) : 60;
        siguiente.horaFin = sumarMinutosHora(valor, duracion);
      }
      return siguiente;
    });
    setCruce(false);
  };

  function elegirExpediente(id: string) {
    setExpedienteId(id);
    const exp = expedientes?.find((e) => e.id === id);
    setValores((v) => ({ ...v, lugar: exp?.lugar ?? "", profesionalId: exp && exp.asignados.length === 1 ? exp.asignados[0]!.id : "" }));
    setCruce(false);
    setError(null);
  }

  async function guardar(forzar: boolean) {
    if (!destino) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(destino, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...valores, forzar, ...(metodo === "PATCH" ? { accion: "editar" } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCruce(Boolean(body.cruce));
        throw new Error(body.error || "No se pudo guardar.");
      }
      onCerrar();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  const claseCampo = "w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          guardar(false);
        }}
        className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 text-left shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">{titulo}</h3>
          <button type="button" onClick={onCerrar} className="text-stone-400 hover:text-stone-600" aria-label="Cerrar">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {expedientes && (
          <div className="text-xs font-medium text-stone-700">
            Trámite en ejecución
            <BuscadorExpediente expedientes={expedientes} seleccionado={expediente} onSeleccionar={elegirExpediente} />
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs font-medium text-stone-700">
            Fecha
            <input type="date" required value={valores.fecha} onChange={campo("fecha")} className={`mt-0.5 ${claseCampo}`} />
          </label>
          <label className="text-xs font-medium text-stone-700">
            Desde
            <input type="time" required value={valores.hora} onChange={campo("hora")} className={`mt-0.5 ${claseCampo}`} />
          </label>
          <label className="text-xs font-medium text-stone-700">
            Hasta
            <input type="time" required min={valores.hora} value={valores.horaFin} onChange={campo("horaFin")} className={`mt-0.5 ${claseCampo}`} />
          </label>
        </div>
        <label className="block text-xs font-medium text-stone-700">
          Lugar
          <input type="text" required maxLength={300} value={valores.lugar} onChange={campo("lugar")} className={`mt-0.5 ${claseCampo}`} />
        </label>
        <label className="block text-xs font-medium text-stone-700">
          Profesional o técnico de evaluación
          <select required value={valores.profesionalId} onChange={campo("profesionalId")} className={`mt-0.5 ${claseCampo}`}>
            <option value="">Seleccione…</option>
            {opcionesProfesional.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        {expediente && expediente.asignados.length === 0 && (
          <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
            Este trámite no tiene personal asignado.{" "}
            <a href={`/expedientes/${expediente.id}#planeador`} className="font-medium underline">
              Asignarlo en el expediente
            </a>
          </p>
        )}
        <label className="block text-xs font-medium text-stone-700">
          Observaciones (opcional)
          <textarea rows={2} value={valores.observaciones} onChange={campo("observaciones")} className={`mt-0.5 ${claseCampo}`} />
        </label>

        {error && (
          <div className={`flex items-start gap-1.5 rounded-md px-2.5 py-2 text-xs ${cruce ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-700"}`}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={guardando || !destino}
            className="flex-1 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600 disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          {cruce && (
            <button
              type="button"
              disabled={guardando}
              onClick={() => guardar(true)}
              className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
            >
              Programar de todas formas
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function ProgramarVisitaForm({
  endpoint,
  metodo,
  profesionales,
  iniciales,
  modo,
}: {
  endpoint: string;
  metodo: "POST" | "PATCH";
  profesionales: { id: string; nombre: string }[];
  iniciales: ValoresVisita;
  modo: "nueva" | "reprogramar";
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      {modo === "nueva" ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600"
        >
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
          Programar visita
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
        >
          <CalendarClock className="h-3 w-3" aria-hidden />
          Reprogramar
        </button>
      )}

      {abierto && (
        <ModalVisita
          titulo={modo === "nueva" ? "Programar visita técnica" : "Reprogramar visita técnica"}
          endpoint={endpoint}
          metodo={metodo}
          profesionales={profesionales}
          iniciales={iniciales}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
