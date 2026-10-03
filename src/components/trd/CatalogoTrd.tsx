"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SerieBuscable } from "@/components/BuscadorSubserieTRD";

const ContextoCatalogo = createContext<SerieBuscable[] | null>(null);

let pendiente: Promise<SerieBuscable[]> | null = null;

function pedirCatalogo(): Promise<SerieBuscable[]> {
  if (!pendiente) {
    pendiente = fetch("/api/trd/catalogo")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudo cargar la TRD."))))
      .then((d: { series: SerieBuscable[] }) => d.series)
      .catch((e) => {
        pendiente = null;
        throw e;
      });
  }
  return pendiente;
}

export function ProveedorCatalogoTrd({ series, children }: { series: SerieBuscable[]; children: ReactNode }) {
  return <ContextoCatalogo.Provider value={series}>{children}</ContextoCatalogo.Provider>;
}

export function useCatalogoTrd(): { series: SerieBuscable[]; cargando: boolean; error: string | null } {
  const delProveedor = useContext(ContextoCatalogo);
  const [series, setSeries] = useState<SerieBuscable[] | null>(delProveedor);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (delProveedor) return;
    let vigente = true;
    pedirCatalogo()
      .then((s) => vigente && setSeries(s))
      .catch((e) => vigente && setError(e instanceof Error ? e.message : "No se pudo cargar la TRD."));
    return () => {
      vigente = false;
    };
  }, [delProveedor]);

  return { series: delProveedor ?? series ?? [], cargando: !delProveedor && !series && !error, error };
}

export function DetallesPerezosos({
  resumen,
  children,
  className,
  abiertoInicial = false,
}: {
  resumen: ReactNode;
  children: ReactNode;
  className?: string;
  abiertoInicial?: boolean;
}) {
  const [montado, setMontado] = useState(abiertoInicial);
  return (
    <details className={className} open={abiertoInicial} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && setMontado(true)}>
      <summary className="cursor-pointer font-medium text-cdmb-700">{resumen}</summary>
      {montado && <div className="mt-2">{children}</div>}
    </details>
  );
}
