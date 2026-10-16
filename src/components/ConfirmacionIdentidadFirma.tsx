"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, PenLine, ShieldCheck } from "lucide-react";

type Modulo = "SGDEA" | "TRAMITES" | "GECON";
type Accion = "FIRMA" | "VISTO_BUENO";

type Identidad = {
  nombre: string;
  cargo: string;
  actoAdministrativo: string | null;
  identificacion: string | null;
  dependencia: string | null;
  encargo: boolean;
  faltantes: string[];
};

type Opciones = { accion?: Accion; solicitudId?: string | null; detalle?: string | null };

export function solicitudDeEndpoint(endpoint: string): string | null {
  return endpoint.match(/solicitudes-firma\/([^/]+)\/completar/)?.[1] ?? null;
}

export function moduloDeEndpoint(endpoint: string): Modulo {
  if (endpoint.startsWith("/api/contratacion")) return "GECON";
  if (endpoint.startsWith("/api/solicitudes-firma") || endpoint.startsWith("/api/documentos/")) return "TRAMITES";
  return "SGDEA";
}

export function useConfirmacionFirma(modulo: Modulo): { confirmarIdentidad: (opciones?: Opciones) => Promise<boolean>; dialogo: ReactNode } {
  const [estado, setEstado] = useState<{ opciones: Opciones; identidad: Identidad | null; error: string | null } | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const cerrar = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setEstado(null);
  }, []);

  const confirmarIdentidad = useCallback(
    (opciones: Opciones = {}) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setEstado({ opciones, identidad: null, error: null });
        const params = new URLSearchParams({ modulo });
        if (opciones.solicitudId) params.set("solicitudId", opciones.solicitudId);
        fetch(`/api/firma/identidad?${params.toString()}`)
          .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "No se pudo consultar los datos del firmante.");
            setEstado((prev) => (prev ? { ...prev, identidad: body as Identidad } : prev));
          })
          .catch((err) => setEstado((prev) => (prev ? { ...prev, error: err instanceof Error ? err.message : "Error inesperado." } : prev)));
      }),
    [modulo]
  );

  const accion = estado?.opciones.accion ?? "FIRMA";
  const verbo = accion === "FIRMA" ? "firmar" : "dar visto bueno";
  const identidad = estado?.identidad ?? null;

  const dialogo = estado ? (
    <div role="dialog" aria-modal="true" aria-label="Confirmación de identidad del firmante" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
          <ShieldCheck className="h-4 w-4 text-cdmb-600" aria-hidden />
          Confirmación de identidad
        </h3>
        {estado.opciones.detalle && <p className="mt-1 text-xs text-stone-500">{estado.opciones.detalle}</p>}

        {estado.error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{estado.error}</p>
        ) : !identidad ? (
          <p className="mt-3 text-xs text-stone-400">Consultando los datos del firmante…</p>
        ) : (
          <>
            <p className="mt-3 text-xs text-stone-600">Usted va a {verbo} como:</p>
            <div className="mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm text-stone-800">
              <p className="font-semibold">{identidad.nombre}</p>
              <p className="text-xs text-stone-600">{identidad.identificacion ?? "Sin número de identificación"}</p>
              <p>{identidad.cargo}</p>
              {identidad.actoAdministrativo && <p>{identidad.actoAdministrativo}</p>}
              {identidad.dependencia && <p className="text-xs text-stone-600">{identidad.dependencia}</p>}
            </div>
            {identidad.faltantes.length > 0 && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
                Su perfil no tiene: {identidad.faltantes.join(", ")}. La firma quedará sin ese dato.
              </p>
            )}
            <p className="mt-2 text-[11px] text-stone-500">
              Si el cargo, el encargo o el acto administrativo no corresponden a su situación actual, cancele y solicite la actualización de su firma con el Administrador.
            </p>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => cerrar(false)} className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => cerrar(true)}
            disabled={!identidad}
            className="inline-flex items-center gap-1 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600 disabled:opacity-50"
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden />
            {accion === "FIRMA" ? "Sí, firmar" : "Sí, dar visto bueno"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirmarIdentidad, dialogo };
}
