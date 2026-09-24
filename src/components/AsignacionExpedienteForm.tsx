"use client";

import { useState } from "react";
import { Search, User, Tag, X } from "lucide-react";

type Opcion = { id: string; nombre: string; detalle?: string | null };

const MAX_RESULTADOS = 8;

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function Buscador({
  etiqueta,
  placeholder,
  opciones,
  seleccionados,
  onAgregar,
  icono: Icono,
}: {
  etiqueta: string;
  placeholder: string;
  opciones: Opcion[];
  seleccionados: string[];
  onAgregar: (id: string) => void;
  icono: typeof User;
}) {
  const [consulta, setConsulta] = useState("");
  const q = normalizar(consulta.trim());
  const resultados = q
    ? opciones.filter((o) => !seleccionados.includes(o.id) && normalizar(`${o.nombre} ${o.detalle ?? ""}`).includes(q)).slice(0, MAX_RESULTADOS)
    : [];

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-stone-700">{etiqueta}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-stone-200 py-1.5 pl-8 pr-3 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
      </div>
      {q && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-stone-200 bg-white text-sm shadow-sm">
          {resultados.length === 0 ? (
            <li className="px-3 py-2 text-xs text-stone-400">Sin coincidencias.</li>
          ) : (
            resultados.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAgregar(o.id);
                    setConsulta("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-cdmb-50"
                >
                  <Icono className="h-3.5 w-3.5 flex-none text-stone-400" aria-hidden />
                  <span className="text-stone-800">{o.nombre}</span>
                  {o.detalle && <span className="truncate text-xs text-stone-400">{o.detalle}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function AsignacionExpedienteForm({
  expedienteId,
  usuarios,
  cargos,
  usuariosIniciales,
  cargosIniciales,
}: {
  expedienteId: string;
  usuarios: Opcion[];
  cargos: Opcion[];
  usuariosIniciales: string[];
  cargosIniciales: string[];
}) {
  const [usuarioIds, setUsuarioIds] = useState(usuariosIniciales);
  const [cargoIds, setCargoIds] = useState(cargosIniciales);
  const nombre = (lista: Opcion[], id: string) => lista.find((o) => o.id === id)?.nombre ?? id;
  const cambio =
    usuarioIds.join() !== usuariosIniciales.join() || cargoIds.join() !== cargosIniciales.join();

  return (
    <form action={`/api/expedientes/${expedienteId}/asignar`} method="post" className="mt-2 space-y-3 border-t border-stone-100 pt-3">
      {usuarioIds.map((id) => (
        <input key={id} type="hidden" name="usuarioIds" value={id} />
      ))}
      {cargoIds.map((id) => (
        <input key={id} type="hidden" name="cargoIds" value={id} />
      ))}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Buscador
          etiqueta="Agregar usuario"
          placeholder="Buscar por nombre o cargo…"
          opciones={usuarios}
          seleccionados={usuarioIds}
          onAgregar={(id) => setUsuarioIds((prev) => [...prev, id])}
          icono={User}
        />
        <Buscador
          etiqueta="Agregar rol (cargo completo)"
          placeholder="Buscar cargo…"
          opciones={cargos}
          seleccionados={cargoIds}
          onAgregar={(id) => setCargoIds((prev) => [...prev, id])}
          icono={Tag}
        />
      </div>

      {usuarioIds.length + cargoIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {usuarioIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-cdmb-50 py-1 pl-2.5 pr-1 text-xs font-medium text-cdmb-800">
              <User className="h-3 w-3" aria-hidden />
              {nombre(usuarios, id)}
              <button type="button" onClick={() => setUsuarioIds((prev) => prev.filter((x) => x !== id))} title="Quitar" className="rounded-full p-0.5 hover:bg-cdmb-100">
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
          {cargoIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-teal-50 py-1 pl-2.5 pr-1 text-xs font-medium text-teal-800">
              <Tag className="h-3 w-3" aria-hidden />
              {nombre(cargos, id)}
              <button type="button" onClick={() => setCargoIds((prev) => prev.filter((x) => x !== id))} title="Quitar" className="rounded-full p-0.5 hover:bg-teal-100">
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-stone-400">Nadie seleccionado. Guardar así deja el expediente sin asignar.</p>
      )}

      <button
        type="submit"
        disabled={!cambio}
        className="rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Guardar asignación
      </button>
    </form>
  );
}
