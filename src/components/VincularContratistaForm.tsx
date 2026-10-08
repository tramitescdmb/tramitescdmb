"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BuscadorContratistaUsuario, type ContratistaElegido } from "@/components/BuscadorContratistaUsuario";

export function VincularContratistaForm({
  expedienteId,
  contratistaActual,
  enlaceUsuarios,
}: {
  expedienteId: string;
  contratistaActual?: { nombreORazonSocial: string } | null;
  enlaceUsuarios?: string | null;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vincular(c: ContratistaElegido) {
    if (contratistaActual && !window.confirm(`¿Cambiar el contratista de «${contratistaActual.nombreORazonSocial}» a «${c.nombre}»? El anterior deja de tener acceso a este expediente.`)) {
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contratistaUsuarioId: c.usuarioId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo vincular el contratista.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {contratistaActual && (
        <p className="text-[11px] text-amber-700">
          Contratista actual: <strong>{contratistaActual.nombreORazonSocial}</strong>. Elegir otro lo reemplaza.
        </p>
      )}
      {guardando ? (
        <p className="text-xs text-stone-500">Vinculando…</p>
      ) : (
        <BuscadorContratistaUsuario onElegir={vincular} enlaceUsuarios={enlaceUsuarios} />
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
