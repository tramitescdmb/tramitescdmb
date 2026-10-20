"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";

export function AsignarSegunRolesBoton() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function asignar() {
    if (!window.confirm("Se agregará a cada usuario activo el perfil que corresponde a cada uno de sus roles actuales. No se quita ningún perfil ya asignado. ¿Continuar?")) return;
    setEnviando(true);
    setMensaje(null);
    const res = await fetch("/api/admin/perfiles/asignar-segun-roles", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setEnviando(false);
    if (!res.ok) return setMensaje(body.error || "No se pudo asignar.");
    setMensaje(`${body.asignaciones} asignación(es) nuevas en ${body.usuarios} usuario(s).`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {mensaje && <span className="text-sm text-stone-600">{mensaje}</span>}
      <button
        type="button"
        onClick={asignar}
        disabled={enviando}
        className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
      >
        <Wand2 className="h-4 w-4" aria-hidden />
        {enviando ? "Asignando…" : "Asignar según roles actuales"}
      </button>
    </div>
  );
}
