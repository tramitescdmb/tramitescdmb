"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";

type RolFirmante = "FIRMA" | "VISTO_BUENO" | "LECTURA";
type EstadoSolicitudFirma = "PENDIENTE" | "COMPLETADA" | "RECHAZADA";

const ETIQUETA_ROL: Record<RolFirmante, string> = {
  FIRMA: "Debe firmar",
  VISTO_BUENO: "Debe dar visto bueno",
  LECTURA: "Solo lectura",
};

const ETIQUETA_ESTADO: Record<EstadoSolicitudFirma, string> = {
  PENDIENTE: "Pendiente",
  COMPLETADA: "Completada",
  RECHAZADA: "Rechazada",
};

const CLASE_ESTADO: Record<EstadoSolicitudFirma, string> = {
  PENDIENTE: "bg-amber-50 text-amber-700",
  COMPLETADA: "bg-emerald-50 text-emerald-700",
  RECHAZADA: "bg-red-50 text-red-700",
};

export type FirmanteAsignado = {
  id: string;
  usuarioAsignadoNombre: string;
  rol: RolFirmante;
  orden: number;
  estado: EstadoSolicitudFirma;
};

/**
 * Modal compartido SGDEA/SIGEC para designar quién debe firmar, dar visto
 * bueno, o tener acceso de solo lectura sobre un documento/comunicación —
 * reemplaza el modelo anterior de "cualquiera con el rol firma cuando
 * quiere". `endpointAsignar` decide el dominio (documento de contrato o
 * comunicación); la lógica de negocio vive en src/lib/solicitudes-firma.ts.
 */
export function AsignarFirmantesModal({
  endpointAsignar,
  usuarios,
  firmantesActuales,
}: {
  endpointAsignar: string;
  usuarios: { id: string; nombre: string; dependenciaNombre?: string | null }[];
  firmantesActuales: FirmanteAsignado[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [usuarioId, setUsuarioId] = useState("");
  const [filtro, setFiltro] = useState("");
  const [dependenciaFiltro, setDependenciaFiltro] = useState("");
  const [rol, setRol] = useState<RolFirmante>("FIRMA");
  const [orden, setOrden] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dependencias = Array.from(new Set(usuarios.map((u) => u.dependenciaNombre).filter((d): d is string => Boolean(d)))).sort();
  const q = filtro.trim().toLowerCase();
  // No se muestra nadie hasta que se busque por nombre o dependencia — con la planta completa de
  // la CDMB, listar todo de entrada vuelve el cuadro inmanejable a medida que crece el personal.
  const usuariosFiltrados =
    q || dependenciaFiltro
      ? usuarios.filter(
          (u) =>
            (!q || u.nombre.toLowerCase().includes(q)) &&
            (!dependenciaFiltro || u.dependenciaNombre === dependenciaFiltro)
        )
      : [];

  async function agregar() {
    if (!usuarioId) return setError("Seleccione una persona.");
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(endpointAsignar, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmantes: [{ usuarioId, rol, orden }] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo asignar.");
      setUsuarioId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Asignar quién debe firmar, dar visto bueno, o tener solo lectura"
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        <UserPlus className="h-3 w-3" aria-hidden />
        Asignar firmantes
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onKeyDown={(e) => e.key === "Escape" && setAbierto(false)}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Firmantes / lectores asignados</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {firmantesActuales.length > 0 ? (
              <ul className="mb-4 divide-y divide-stone-100 rounded-lg border border-stone-100 text-xs">
                {firmantesActuales.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 p-2">
                    <span className="text-stone-700">
                      {f.usuarioAsignadoNombre} <span className="text-stone-400">— {ETIQUETA_ROL[f.rol]} (turno {f.orden})</span>
                    </span>
                    <span className={`flex-none rounded-full px-2 py-0.5 font-medium ${CLASE_ESTADO[f.estado]}`}>{ETIQUETA_ESTADO[f.estado]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-xs text-stone-400">Todavía no hay nadie asignado.</p>
            )}

            <div className="space-y-2 border-t border-stone-100 pt-3">
              <label className="block text-xs font-medium text-stone-600">
                Persona
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    placeholder="Buscar por nombre…"
                    className="rounded-md border border-stone-200 px-2 py-1.5 text-sm"
                  />
                  <select
                    value={dependenciaFiltro}
                    onChange={(e) => setDependenciaFiltro(e.target.value)}
                    className="rounded-md border border-stone-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">Todas las dependencias</option>
                    {dependencias.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                {!q && !dependenciaFiltro ? (
                  <p className="mt-1.5 text-xs text-stone-400">Escriba un nombre o elija una dependencia para buscar.</p>
                ) : usuariosFiltrados.length === 0 ? (
                  <p className="mt-1.5 text-xs text-stone-400">Sin coincidencias.</p>
                ) : (
                  // Pastillas en vez de un <select size> nativo — con ese listbox, un clic sobre una
                  // opción a veces actualizaba lo que se veía en pantalla pero no el estado de React
                  // (el botón "Agregar" seguía pidiendo "Seleccione una persona" aunque se viera
                  // marcada). Mismo patrón que ya usan Supervisión y Nuevo expediente para elegir
                  // personas de una lista filtrada.
                  <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-stone-200 p-2">
                    {usuariosFiltrados.map((u) => {
                      const activo = usuarioId === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setUsuarioId(u.id)}
                          aria-pressed={activo}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            activo ? "border-cdmb-600 bg-cdmb-600 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                          }`}
                        >
                          {u.nombre}
                          {u.dependenciaNombre ? ` — ${u.dependenciaNombre}` : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </label>
              <label className="block text-xs font-medium text-stone-600">
                Rol
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as RolFirmante)}
                  className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
                >
                  <option value="FIRMA">Debe firmar</option>
                  <option value="VISTO_BUENO">Debe dar visto bueno</option>
                  <option value="LECTURA">Solo lectura</option>
                </select>
              </label>
              {rol !== "LECTURA" && (
                <label className="block text-xs font-medium text-stone-600">
                  Turno (firmantes con el mismo número actúan en cualquier orden entre sí)
                  <input
                    type="number"
                    min={1}
                    value={orden}
                    onChange={(e) => setOrden(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
                  />
                </label>
              )}
              {error && <p className="text-xs text-red-700">{error}</p>}
              <button
                type="button"
                onClick={agregar}
                disabled={cargando}
                className="w-full rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
              >
                {cargando ? "Agregando…" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
