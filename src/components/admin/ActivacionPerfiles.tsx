"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ETIQUETA_MODULO_PERFIL, type ModuloPerfil } from "@/lib/perfiles-catalogo";

const MODULOS: ModuloPerfil[] = ["TRAMITES", "SGDEA", "GECON", "VITAL", "SINCA"];

export function ActivacionPerfiles({ activos, sinPerfil }: { activos: string[]; sinPerfil: Record<string, { id: string; nombre: string }[]> }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(modulo: ModuloPerfil, activo: boolean) {
    const nombre = ETIQUETA_MODULO_PERFIL[modulo];
    const texto = activo
      ? `Desde ahora los accesos de ${nombre} saldrán de los perfiles y las excepciones, no de los roles. ¿Activar?`
      : `Los accesos de ${nombre} volverán a salir de los roles. ¿Desactivar?`;
    if (!window.confirm(texto)) return;
    setEnviando(modulo);
    setError(null);
    const res = await fetch("/api/admin/perfiles/activacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo, activo }),
    });
    const body = await res.json().catch(() => ({}));
    setEnviando(null);
    if (!res.ok) return setError(body.error || "No se pudo cambiar.");
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-md border border-stone-200 bg-white">
      <h2 className="border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-900">Aplicación de los perfiles por módulo</h2>
      {error && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <ul className="divide-y divide-stone-100">
        {MODULOS.map((modulo) => {
          const activo = activos.includes(modulo);
          const faltan = sinPerfil[modulo] ?? [];
          const bloqueo = !activo && faltan.length > 0;
          return (
            <li key={modulo} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-stone-800">
                  {ETIQUETA_MODULO_PERFIL[modulo]}
                  <span className={`rounded-sm px-1.5 text-[11px] font-semibold ${activo ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>
                    {activo ? "Por perfiles" : "Por roles"}
                  </span>
                </p>
                {bloqueo && <p className="text-xs text-red-700">Sin perfil: {faltan.map((u) => u.nombre).join(", ")}</p>}
              </div>
              <button
                  type="button"
                  onClick={() => cambiar(modulo, !activo)}
                  disabled={enviando !== null || bloqueo}
                  className={`rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                    activo ? "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50" : "bg-acento-500 text-white hover:bg-acento-600"
                  }`}
                >
                  {enviando === modulo ? "Aplicando…" : activo ? "Volver a los roles" : "Activar perfiles"}
                </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
