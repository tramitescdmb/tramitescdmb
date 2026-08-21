"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Field";
import { subirArchivoDirecto } from "@/lib/uploads-client";

export function SubirDocumentoPasoForm({
  expedienteId,
  pasoNumero,
}: {
  expedienteId: string;
  pasoNumero: number;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const input = form.elements.namedItem("archivo") as HTMLInputElement | null;
    const files = input?.files ? Array.from(input.files) : [];
    if (files.length === 0) {
      setError("Selecciona al menos un archivo.");
      return;
    }

    setSubmitting(true);
    try {
      const archivos = [];
      for (const file of files) {
        setProgreso(`Subiendo "${file.name}"…`);
        archivos.push(await subirArchivoDirecto(expedienteId, file));
      }

      setProgreso("Guardando…");
      const res = await fetch(`/api/expedientes/${expedienteId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasoNumero, archivos }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo guardar el documento.");
      }

      form.reset();
      setProgreso(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Field
        label="Adjuntar documento de este paso"
        help="Ej: el informe técnico, el auto firmado, la resolución — lo que este paso genere. No importa el tamaño del archivo (planos, estudios grandes, etc.)."
      >
        <input
          type="file"
          name="archivo"
          multiple
          disabled={submitting}
          className="block text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-cdmb-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-cdmb-700 hover:file:bg-cdmb-100"
        />
      </Field>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Subiendo…" : "Subir"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
      {progreso && (
        <p className="flex w-full items-center gap-2 text-xs text-cdmb-700">
          <span className="h-3 w-3 flex-none animate-spin rounded-full border-2 border-cdmb-600 border-t-transparent" />
          {progreso}
        </p>
      )}
    </form>
  );
}
