"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Copy, Check } from "lucide-react";

type Resultado = { modo: "dominio"; usuarioRed: string } | { modo: "temporal"; correo: string; password: string };

export function CrearUsuarioContratistaBoton({ contratistaId }: { contratistaId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);

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
    } catch {
      setError("No se pudo crear el usuario.");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <div className="max-w-md rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        {resultado.modo === "dominio" ? (
          <p>
            Usuario creado con su cuenta del dominio <b>{resultado.usuarioRed}</b>: ingresa con la contraseña de la red CDMB.
          </p>
        ) : (
          <>
            <p>
              Cuenta temporal creada. Ingresa con <b>{resultado.correo}</b> y la contraseña provisional:
            </p>
            <p className="mt-1 flex items-center gap-2">
              <code className="rounded bg-white px-2 py-0.5 font-mono text-sm text-stone-900">{resultado.password}</code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(resultado.password).then(() => setCopiado(true));
                }}
                className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-emerald-800"
              >
                {copiado ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
                {copiado ? "Copiada" : "Copiar"}
              </button>
            </p>
            <p className="mt-1">Entréguela al contratista: no se vuelve a mostrar. Cuando su cédula exista en el dominio, la cuenta pasa sola al directorio activo.</p>
          </>
        )}
        <button type="button" onClick={() => router.refresh()} className="mt-1.5 font-medium text-emerald-800 underline">
          Listo
        </button>
      </div>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={crear}
        disabled={enviando}
        title="Si el contratista ya está en el dominio, se crea con su usuario de red; si no, con una cuenta temporal que pasa al dominio en la sincronización."
        className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60"
      >
        <UserPlus className="h-4 w-4" aria-hidden />
        {enviando ? "Creando…" : "Crear usuario"}
      </button>
      {error && <span className="max-w-sm text-xs text-red-700">{error}</span>}
    </span>
  );
}
