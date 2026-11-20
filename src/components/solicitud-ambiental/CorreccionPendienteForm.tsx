"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Upload } from "lucide-react";
import { subirAUrlFirmada } from "@/lib/almacen-cliente";
import { sha256Hex } from "@/lib/uploads-client";

type Item = { id: string; titulo: string; motivo: string };

/** El ciudadano carga solo los documentos que la CDMB le pidió corregir o aportar. */
export function CorreccionPendienteForm({ expedienteId, items }: { expedienteId: string; items: Item[] }) {
  const router = useRouter();
  const [archivos, setArchivos] = useState<Record<string, File | null>>({});
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const faltan = items.filter((i) => !archivos[i.id]);
    if (faltan.length > 0) return setError(`Falta cargar: ${faltan.map((i) => i.titulo).join("; ")}.`);
    try {
      const subidos = [];
      for (const i of items) {
        const file = archivos[i.id]!;
        setProgreso(`Subiendo «${file.name}»…`);
        const firma = await fetch("/api/solicitud-ambiental/cuenta/correccion/subir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: i.id, fileName: file.name }),
        });
        const datos = await firma.json().catch(() => ({}));
        if (!firma.ok) throw new Error(datos.error || `No se pudo preparar la subida de «${file.name}».`);
        if (file.size > datos.topeMb * 1024 * 1024) throw new Error(`«${file.name}» pesa más de ${datos.topeMb} MB.`);
        const { error: fallo } = await subirAUrlFirmada("documentos", datos.path, datos.token, file);
        if (fallo) throw new Error(`Falló la subida de «${file.name}»: ${fallo.message}`);
        subidos.push({ itemId: i.id, path: datos.path, nombre: file.name, hashSha256: await sha256Hex(file) });
      }
      setProgreso("Enviando corrección…");
      const resp = await fetch("/api/solicitud-ambiental/cuenta/correccion/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expedienteId, archivos: subidos }),
      });
      const datos = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(datos.error || "No se pudo enviar la corrección.");
      setEnviado(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la corrección.");
    } finally {
      setProgreso(null);
    }
  }

  if (enviado) return <p className="rounded-xl bg-cdmb-50 px-3 py-2 text-sm text-cdmb-900">Recibimos su corrección. La solicitud volvió a revisión.</p>;

  return (
    <form onSubmit={enviar} className="space-y-3">
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
      <ul className="space-y-3">
        {items.map((i) => (
          <li key={i.id} className="rounded-xl border border-amber-200 bg-white p-3">
            <p className="text-sm font-semibold text-stone-900">{i.titulo}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-stone-700">{i.motivo}</p>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
              <Upload className="h-4 w-4" aria-hidden />
              {archivos[i.id]?.name ?? "Elegir archivo"}
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setArchivos((a) => ({ ...a, [i.id]: e.target.files?.[0] ?? null }))}
              />
            </label>
          </li>
        ))}
      </ul>
      <button
        type="submit"
        disabled={Boolean(progreso)}
        className="inline-flex items-center gap-2 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
      >
        {progreso ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        {progreso ?? "Enviar corrección"}
      </button>
      <p className="text-xs text-stone-500">Cada archivo hasta 2 MB (planos, 10 MB). Los documentos anteriores se conservan en el expediente.</p>
    </form>
  );
}
