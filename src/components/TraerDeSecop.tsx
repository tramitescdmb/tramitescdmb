"use client";

import { useState } from "react";
import Link from "next/link";
import { DownloadCloud, ExternalLink } from "lucide-react";
import type { ContratoSecop } from "@/lib/secop-datos";

export type ContratoSecopRespuesta = ContratoSecop & {
  usuario: { id: string; nombre: string; email: string; cedulaONit: string | null } | null;
  expedienteExistente: { id: string; numero: string; codigoProceso: string | null } | null;
};

const pesos = (v: number) => `$ ${v.toLocaleString("es-CO")}`;

export function TraerDeSecop({ onAplicar }: { onAplicar: (c: ContratoSecopRespuesta) => void }) {
  const [ref, setRef] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ContratoSecopRespuesta[] | null>(null);
  const [aplicado, setAplicado] = useState<ContratoSecopRespuesta | null>(null);

  async function consultar() {
    if (ref.trim().length < 3) return setError("Escriba el número del contrato o el ID del proceso en SECOP II.");
    setCargando(true);
    setError(null);
    setResultados(null);
    setAplicado(null);
    try {
      const res = await fetch(`/api/contratacion/secop?ref=${encodeURIComponent(ref.trim())}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo consultar SECOP II.");
      setResultados(body.contratos);
      if (body.contratos.length === 0) setError("No se encontró en SECOP II un contrato de la CDMB con ese número.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  function aplicar(c: ContratoSecopRespuesta) {
    onAplicar(c);
    setAplicado(c);
    setResultados(null);
  }

  return (
    <div className="space-y-2 rounded-xl border border-cdmb-100 bg-cdmb-50/40 px-4 py-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-medium text-stone-700">
          Traer datos de SECOP II
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                consultar();
              }
            }}
            placeholder="N.° de contrato (ej. 210-17708-8) o ID del proceso (CO1.BDOS…)"
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-normal focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
          />
        </label>
        <button
          type="button"
          onClick={consultar}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
        >
          <DownloadCloud className="h-3.5 w-3.5" aria-hidden />
          {cargando ? "Consultando…" : "Consultar"}
        </button>
      </div>
      <p className="text-[11px] text-stone-500">Datos abiertos de SECOP II en datos.gov.co. Revise y complete lo que traiga antes de crear el expediente.</p>
      {error && <p className="text-xs text-amber-800">{error}</p>}

      {resultados?.map((c) => (
        <div key={c.idContrato ?? c.numeroContrato} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs">
          <p className="font-semibold text-stone-900">
            Contrato {c.numeroContrato ?? "sin número"} · {c.contratista.nombre ?? "sin contratista"}
            {c.contratista.documento && <span className="font-normal text-stone-500"> ({c.contratista.documento})</span>}
          </p>
          <p className="line-clamp-2 text-stone-600">{c.objeto}</p>
          <p className="text-stone-500">
            {c.modalidadSecop} · {c.justificacionSecop} · {c.tipoSecop}
            {c.valor !== null && ` · ${pesos(c.valor)}`}
            {c.estado && ` · ${c.estado}`}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {c.expedienteExistente ? (
              <Link href={`/contratacion/expedientes/${c.expedienteExistente.id}`} className="font-medium text-amber-800 underline">
                Ya existe el expediente {c.expedienteExistente.codigoProceso ?? c.expedienteExistente.numero}
              </Link>
            ) : (
              <button type="button" onClick={() => aplicar(c)} className="rounded bg-cdmb-600 px-2.5 py-1 font-medium text-white hover:bg-cdmb-700">
                Usar estos datos
              </button>
            )}
            {c.url && (
              <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cdmb-700 hover:underline">
                Ver en SECOP II <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </div>
        </div>
      ))}

      {aplicado && (
        <p className={`rounded-md px-3 py-1.5 text-xs ${aplicado.usuario ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          Se cargaron los datos del contrato {aplicado.numeroContrato}.{" "}
          {aplicado.usuario
            ? `Contratista vinculado: ${aplicado.usuario.nombre} (${aplicado.usuario.email}).`
            : `El contratista con documento ${aplicado.contratista.documento ?? "—"} no tiene usuario en la plataforma: el administrador del sistema debe crearlo en Usuarios para vincularlo.`}
        </p>
      )}
    </div>
  );
}
