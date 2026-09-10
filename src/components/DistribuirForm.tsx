"use client";

import { useMemo, useState } from "react";
import { Send, Search } from "lucide-react";
import { Field } from "@/components/Field";

type Opcion = { id: string; nombre: string };

/**
 * Formulario de reparto de una comunicación. Permite asignarla a UNA dependencia
 * y a VARIOS funcionarios a la vez (lista con filtro de texto + casillas). Por
 * defecto reemplaza el reparto vigente; "sumar" lo mantiene y añade destinatarios.
 * Es un POST normal (las casillas `usuarioId` se envían nativamente).
 */
export function DistribuirForm({
  comunicacionId,
  dependencias,
  usuarios,
}: {
  comunicacionId: string;
  dependencias: Opcion[];
  usuarios: Opcion[];
}) {
  const [q, setQ] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return usuarios;
    return usuarios.filter((u) => u.nombre.toLowerCase().includes(t));
  }, [q, usuarios]);

  function alternar(id: string) {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  return (
    <form
      action={`/api/correspondencia/${comunicacionId}/distribuir`}
      method="post"
      className="mt-4 space-y-3 border-t border-stone-100 pt-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Dependencia" help="El área que debe atenderla.">
          <select name="dependenciaId" className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
            <option value="">— Ninguna —</option>
            {dependencias.map((d) => (
              <option key={d.id} value={d.id}>{d.nombre}</option>
            ))}
          </select>
        </Field>
        <Field label="Término (días)" help="Plazo interno, si es distinto al de ley.">
          <input name="termino" type="number" min={1} placeholder="Ej. 15" className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
        </Field>
        <Field label="Instrucciones" help="Indicaciones para quien la gestiona.">
          <input name="instrucciones" className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
        </Field>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-stone-600">
          Funcionario(s) a cargo{seleccion.size > 0 ? ` — ${seleccion.size} seleccionado(s)` : ""}
        </p>
        <span className="mb-2 flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
          <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por nombre"
            className="w-full text-sm outline-none"
          />
        </span>
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-stone-200 p-2">
          {filtrados.length === 0 ? (
            <p className="px-1 py-2 text-sm text-stone-400">Sin coincidencias.</p>
          ) : (
            filtrados.map((u) => (
              <label key={u.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm text-stone-700 hover:bg-stone-50">
                <input
                  type="checkbox"
                  name="usuarioId"
                  value={u.id}
                  checked={seleccion.has(u.id)}
                  onChange={() => alternar(u.id)}
                  className="rounded border-stone-300"
                />
                {u.nombre}
              </label>
            ))
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" name="sumar" className="rounded border-stone-300" />
        Sumar a los destinatarios actuales (por defecto reemplaza el reparto anterior)
      </label>

      <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
        <Send className="h-3.5 w-3.5" aria-hidden />
        Repartir
      </button>
    </form>
  );
}
