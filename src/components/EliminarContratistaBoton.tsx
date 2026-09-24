"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function EliminarContratistaBoton({ contratistaId, nombre, tieneCuenta }: { contratistaId: string; nombre: string; tieneCuenta: boolean }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function eliminar() {
    const aviso = tieneCuenta
      ? `¿Eliminar a ${nombre} del registro de contratistas? Su cuenta de acceso NO se borra, pero dejará de estar vinculada a este registro. Esta acción no se puede deshacer.`
      : `¿Eliminar a ${nombre} del registro de contratistas? Esta acción no se puede deshacer.`;
    if (!window.confirm(aviso)) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/contratistas/${contratistaId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo eliminar el contratista.");
      router.push("/contratacion/contratistas");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={eliminar}
        disabled={cargando}
        title="Eliminar este contratista del registro (solo posible si no pertenece a ningún expediente)"
        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        {cargando ? "Eliminando…" : "Eliminar contratista"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
