"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine } from "lucide-react";
import { useConfirmacionFirma } from "@/components/ConfirmacionIdentidadFirma";

/** Firma de quien proyectó o revisó el memorando (su solicitud de firma pendiente). */
export function BotonFirmarMemorando({ comunicacionId, solicitudId, calidad, asunto }: { comunicacionId: string; solicitudId: string; calidad: string; asunto: string }) {
  const router = useRouter();
  const { confirmarIdentidad, dialogo } = useConfirmacionFirma("SGDEA");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function firmar() {
    setError(null);
    if (!(await confirmarIdentidad({ solicitudId, detalle: `Memorando: ${asunto}` }))) return;
    setEnviando(true);
    try {
      const resp = await fetch(`/api/memorandos/${comunicacionId}/firmar`, { method: "POST", headers: { Accept: "application/json" } });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo registrar la firma.");
      router.replace(`/memorandos/${comunicacionId}?ok=${encodeURIComponent("Su firma quedó registrada en el memorando.")}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la firma.");
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-stone-600">Usted aparece como quien {calidad} este memorando. Revise el documento y fírmelo.</p>
      {error && <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>}
      <button
        type="button"
        onClick={firmar}
        disabled={enviando}
        className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-semibold text-white hover:bg-acento-600 disabled:opacity-60"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PenLine className="h-4 w-4" aria-hidden />}
        {enviando ? "Firmando…" : "Firmar memorando"}
      </button>
      {dialogo}
    </div>
  );
}
