"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { Field } from "@/components/Field";

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";
const botonCls =
  "inline-flex items-center gap-2 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60";

/** Prueba anti-robots: busca n tal que SHA-256(reto:n) empiece con `dificultad` bits en cero. */
async function resolverReto(reto: string, dificultad: number): Promise<string> {
  const codificador = new TextEncoder();
  for (let n = 0; n < 50_000_000; n++) {
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", codificador.encode(`${reto}:${n}`)));
    let bits = 0;
    for (const byte of hash) {
      if (byte === 0) {
        bits += 8;
        continue;
      }
      bits += Math.clz32(byte) - 24;
      break;
    }
    if (bits >= dificultad) return String(n);
  }
  throw new Error("No se pudo completar la verificación.");
}

/**
 * Ingreso sin contraseña a «Mis solicitudes»: correo → código de 6 dígitos. Sirve igual para la
 * primera vez (registro) y para volver a entrar.
 */
export function IngresarCiudadanoForm({ siguiente }: { siguiente: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [sitioWeb, setSitioWeb] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function pedirCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!correo.trim()) return setError("Escriba su correo electrónico.");
    try {
      setOcupado("Verificando…");
      const r = await fetch("/api/solicitud-ambiental/cuenta/reto", { cache: "no-store" });
      const { reto, dificultad } = await r.json();
      const solucion = await resolverReto(reto, dificultad);
      setOcupado("Enviando código…");
      const resp = await fetch("/api/solicitud-ambiental/cuenta/codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correo.trim(), reto, solucion, sitioWeb }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo enviar el código.");
      setAviso(data.mensaje);
      setPaso("codigo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el código.");
    } finally {
      setOcupado(null);
    }
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOcupado("Comprobando…");
    try {
      const resp = await fetch("/api/solicitud-ambiental/cuenta/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correo.trim(), codigo }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "El código no es válido.");
      router.replace(siguiente);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "El código no es válido.");
      setOcupado(null);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      {error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
      {paso === "correo" ? (
        <form onSubmit={pedirCodigo} className="space-y-4">
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>
              Sitio web
              <input tabIndex={-1} autoComplete="off" value={sitioWeb} onChange={(e) => setSitioWeb(e.target.value)} />
            </label>
          </div>
          <Field label="Correo electrónico" required help="Le enviaremos un código de 6 dígitos. No necesita contraseña.">
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className={inputCls} autoComplete="email" maxLength={200} />
          </Field>
          <button type="submit" disabled={Boolean(ocupado)} className={botonCls}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
            {ocupado ?? "Enviarme el código"}
          </button>
        </form>
      ) : (
        <form onSubmit={verificar} className="space-y-4">
          {aviso && <p className="rounded-xl bg-cdmb-50 px-3 py-2 text-sm text-cdmb-900">{aviso}</p>}
          <Field label="Código de 6 dígitos" required help={`Enviado a ${correo.trim()}. Vence en 10 minutos.`}>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${inputCls} font-mono text-lg tracking-[0.4em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={Boolean(ocupado) || codigo.length !== 6} className={botonCls}>
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
              {ocupado ?? "Ingresar"}
            </button>
            <button type="button" onClick={() => pedirCodigo()} disabled={Boolean(ocupado)} className="text-sm text-cdmb-700 underline hover:no-underline">
              Enviar otro código
            </button>
            <button
              type="button"
              onClick={() => {
                setPaso("correo");
                setCodigo("");
                setAviso(null);
              }}
              className="text-sm text-stone-500 hover:underline"
            >
              Cambiar correo
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
