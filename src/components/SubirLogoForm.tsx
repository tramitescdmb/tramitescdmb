"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubirLogoForm({
  campo,
  urlActual,
  etiqueta,
  ayuda,
}: {
  campo: "logo" | "govco" | "colombia" | "potencia";
  urlActual: string | null;
  etiqueta: string;
  ayuda: string;
}) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSubiendo(true);
    try {
      const signRes = await fetch("/api/branding/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo, fileName: file.name }),
      });
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error || "No se pudo preparar la subida.");

      const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      const supabase = getSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from("branding")
        .uploadToSignedUrl(signData.path, signData.token, file);
      if (uploadError) throw uploadError;

      const confirmRes = await fetch("/api/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo, path: signData.path }),
      });
      if (!confirmRes.ok) {
        const d = await confirmRes.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo guardar la imagen.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  }

  async function quitar() {
    setSubiendo(true);
    setError(null);
    try {
      const res = await fetch("/api/branding", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo }),
      });
      if (!res.ok) throw new Error("No se pudo quitar la imagen.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-medium text-stone-800">{etiqueta}</p>
      <p className="mb-3 text-xs text-stone-500">{ayuda}</p>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-32 flex-none items-center justify-center rounded-md border border-dashed border-stone-300 bg-stone-50">
          {urlActual ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlActual} alt={etiqueta} className="max-h-14 max-w-28 object-contain" />
          ) : (
            <span className="text-xs text-stone-300">Sin imagen</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="cursor-pointer rounded-md border border-stone-300 px-3 py-1.5 text-center text-sm font-medium text-stone-700 hover:bg-stone-50">
            {subiendo ? "Subiendo…" : urlActual ? "Cambiar imagen" : "Subir imagen"}
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleChange} disabled={subiendo} className="hidden" />
          </label>
          {urlActual && (
            <button
              type="button"
              onClick={quitar}
              disabled={subiendo}
              className="text-xs text-stone-400 hover:text-red-600"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
