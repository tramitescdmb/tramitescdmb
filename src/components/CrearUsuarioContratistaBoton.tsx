"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

type Resultado = { modo: "dominio"; usuarioRed: string } | { modo: "temporal" };

export function CrearUsuarioContratistaBoton({ contratistaId }: { contratistaId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function crear() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/contratistas/${contratistaId}/usuario`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo crear el usuario.");
        return;
      }
      setResultado(data);
      router.refresh();
    } catch {
      setError("No se pudo crear el usuario.");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <p className="max-w-md rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        {resultado.modo === "dominio"
          ? `Usuario creado con su cuenta del dominio ${resultado.usuarioRed}: ingresa con la contraseña de la red CDMB.`
          : "Usuario temporal creado y vinculado al contratista. Cuando sistemas cree sus credenciales en el dominio, la plataforma lo actualiza sola con su usuario de red."}
      </p>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={crear}
        disabled={enviando}
        title="Si el contratista ya está en el dominio, se crea con su usuario de red; si no, queda como usuario temporal hasta que existan sus credenciales de red."
        className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60"
      >
        <UserPlus className="h-4 w-4" aria-hidden />
        {enviando ? "Creando…" : "Crear usuario temporal"}
      </button>
      {error && <span className="max-w-sm text-xs text-red-700">{error}</span>}
    </span>
  );
}
