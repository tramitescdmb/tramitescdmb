"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

export type ApartadoEditable = {
  id?: string;
  orden: number;
  etiqueta: string;
  titulo: string;
  tituloIndice: string;
  ubicacion: string;
  resumen: string;
  pasos: string[];
  ejemplo: string;
  detalle: string;
  fundamento: string;
};

type Campos = Omit<ApartadoEditable, "id" | "pasos" | "orden"> & { orden: string; pasos: string };

const claseCampo = "mt-0.5 w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-800";

function camposDe(a: ApartadoEditable): Campos {
  return { ...a, orden: String(a.orden), pasos: a.pasos.join("\n") };
}

export function EditarApartadoManual({ apartado }: { apartado: ApartadoEditable }) {
  const router = useRouter();
  const nuevo = !apartado.id;
  const [abierto, setAbierto] = useState(false);
  const [campos, setCampos] = useState<Campos>(camposDe(apartado));
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiar = (k: keyof Campos) => (e: { target: { value: string } }) => setCampos((c) => ({ ...c, [k]: e.target.value }));

  function cerrar() {
    setCampos(camposDe(apartado));
    setError(null);
    setConfirmarBorrado(false);
    setAbierto(false);
  }

  async function enviar(metodo: "POST" | "PATCH" | "DELETE") {
    setGuardando(true);
    setError(null);
    try {
      const url = nuevo ? "/api/correspondencia/manual-demostracion" : `/api/correspondencia/manual-demostracion/${apartado.id}`;
      const res = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: metodo === "DELETE" ? undefined : JSON.stringify(campos),
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error || "No se pudo guardar.");
      setAbierto(false);
      setConfirmarBorrado(false);
      if (nuevo) setCampos(camposDe({ ...apartado, orden: apartado.orden + 1 }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  function guardar(e: FormEvent) {
    e.preventDefault();
    void enviar(nuevo ? "POST" : "PATCH");
  }

  if (!abierto) {
    return nuevo ? (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-cdmb-300 bg-white px-3 py-2 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50 print:hidden"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Agregar apartado
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-cdmb-700 hover:underline print:hidden"
        aria-label={`Editar el apartado ${apartado.titulo}`}
      >
        <Pencil className="h-3 w-3" aria-hidden />
        Editar
      </button>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-2.5 rounded-xl border border-cdmb-200 bg-cdmb-50/40 p-3.5 print:hidden">
      <p className="text-xs font-semibold text-stone-700">{nuevo ? "Nuevo apartado" : `Editar «${apartado.titulo}»`}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[90px_1fr_1fr]">
        <label className="block text-[11px] font-medium text-stone-600">
          Orden
          <input type="number" min={1} value={campos.orden} onChange={cambiar("orden")} className={claseCampo} />
        </label>
        <label className="block text-[11px] font-medium text-stone-600">
          Etiqueta
          <input value={campos.etiqueta} onChange={cambiar("etiqueta")} required maxLength={40} className={claseCampo} />
        </label>
        <label className="block text-[11px] font-medium text-stone-600">
          Título en el índice
          <input value={campos.tituloIndice} onChange={cambiar("tituloIndice")} maxLength={120} className={claseCampo} />
        </label>
      </div>
      <label className="block text-[11px] font-medium text-stone-600">
        Título
        <input value={campos.titulo} onChange={cambiar("titulo")} required maxLength={200} className={claseCampo} />
      </label>
      <label className="block text-[11px] font-medium text-stone-600">
        Ubicación
        <textarea value={campos.ubicacion} onChange={cambiar("ubicacion")} rows={2} className={claseCampo} />
      </label>
      <label className="block text-[11px] font-medium text-stone-600">
        Resumen
        <textarea value={campos.resumen} onChange={cambiar("resumen")} required rows={2} className={claseCampo} />
      </label>
      <label className="block text-[11px] font-medium text-stone-600">
        Procedimiento (un paso por línea)
        <textarea value={campos.pasos} onChange={cambiar("pasos")} rows={6} className={claseCampo} />
      </label>
      <label className="block text-[11px] font-medium text-stone-600">
        Ejemplo
        <textarea value={campos.ejemplo} onChange={cambiar("ejemplo")} rows={4} className={claseCampo} />
      </label>
      <label className="block text-[11px] font-medium text-stone-600">
        En detalle
        <textarea value={campos.detalle} onChange={cambiar("detalle")} rows={4} className={claseCampo} />
      </label>
      <label className="block text-[11px] font-medium text-stone-600">
        Fundamento normativo
        <textarea value={campos.fundamento} onChange={cambiar("fundamento")} rows={2} className={claseCampo} />
      </label>
      <p className="text-[10px] text-stone-500">
        Formato: <code className="font-mono">`código`</code> · <code className="font-mono">**negrita**</code> ·{" "}
        <code className="font-mono">[texto](/ruta)</code>. Los párrafos se separan con una línea en blanco.
      </p>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={guardando}
          className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600 disabled:opacity-50"
        >
          {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {nuevo ? "Agregar" : "Guardar"}
        </button>
        <button type="button" onClick={cerrar} className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
          Cancelar
        </button>
        {!nuevo &&
          (confirmarBorrado ? (
            <span className="ml-auto flex items-center gap-2 text-[11px] text-red-700">
              ¿Eliminar este apartado?
              <button
                type="button"
                disabled={guardando}
                onClick={() => void enviar("DELETE")}
                className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Sí, eliminar
              </button>
              <button type="button" onClick={() => setConfirmarBorrado(false)} className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[11px] text-stone-600">
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmarBorrado(true)}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" aria-hidden />
              Eliminar
            </button>
          ))}
      </div>
    </form>
  );
}
