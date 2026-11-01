"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { DownloadCloud, Eraser, ExternalLink } from "lucide-react";
import type { ContratoSecop } from "@/lib/secop-datos";
import { formatearFechaCalendario } from "@/lib/fecha";

export type ContratoSecopRespuesta = ContratoSecop & {
  usuario: { id: string; nombre: string; email: string; cedulaONit: string | null } | null;
  expedienteExistente: { id: string; numero: string; codigoProceso: string | null } | null;
};

const pesos = (v: number) => `$ ${v.toLocaleString("es-CO")}`;

export function TarjetaContratoSecop({ contrato: c, accion, aviso }: { contrato: ContratoSecopRespuesta; accion: ReactNode; aviso?: ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs">
      <p className="font-semibold text-stone-900">
        Contrato {c.numeroContrato ?? "sin número"} · {c.contratista.nombre ?? "sin contratista"}
        {c.contratista.documento && <span className="font-normal text-stone-500"> ({c.contratista.documento})</span>}
      </p>
      <p className="line-clamp-2 text-stone-600">{c.objeto}</p>
      <p className="text-stone-700">
        Firma {formatearFechaCalendario(c.fechaSuscripcion)} · {formatearFechaCalendario(c.fechaInicio)} – {formatearFechaCalendario(c.fechaFin)}
        {c.valor !== null && ` · ${pesos(c.valor)}`}
        {c.estado && ` · ${c.estado}`}
      </p>
      <p className="text-stone-500">
        {c.modalidadSecop} · {c.justificacionSecop} · {c.tipoSecop}
      </p>
      {aviso}
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {c.expedienteExistente ? (
          <Link href={`/contratacion/expedientes/${c.expedienteExistente.id}`} className="font-medium text-amber-800 underline">
            Ya existe el expediente {c.expedienteExistente.codigoProceso ?? c.expedienteExistente.numero}
          </Link>
        ) : (
          accion
        )}
        {c.url && (
          <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cdmb-700 hover:underline">
            Ver en SECOP II <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}

export function TraerDeSecop({
  onAplicar,
  onLimpiar,
  conDatos = false,
  consulta,
}: {
  onAplicar: (c: ContratoSecopRespuesta) => void;
  onLimpiar?: () => void;
  conDatos?: boolean;
  consulta?: { texto: string; n: number } | null;
}) {
  const [ref, setRef] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ContratoSecopRespuesta[] | null>(null);
  const [aplicado, setAplicado] = useState<ContratoSecopRespuesta | null>(null);

  async function consultar(texto = ref) {
    if (texto.trim().length < 3) return setError("Escriba el número del contrato, el ID del proceso en SECOP II o el documento del contratista.");
    setCargando(true);
    setError(null);
    setResultados(null);
    setAplicado(null);
    try {
      const res = await fetch(`/api/contratacion/secop?ref=${encodeURIComponent(texto.trim())}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo consultar SECOP II.");
      setResultados(body.contratos);
      if (body.contratos.length === 0) setError("No se encontró en SECOP II un contrato de la CDMB con ese dato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!consulta?.texto) return;
    setRef(consulta.texto);
    consultar(consulta.texto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta?.n]);

  function aplicar(c: ContratoSecopRespuesta) {
    onAplicar(c);
    setAplicado(c);
    setResultados(null);
  }

  function limpiar() {
    setRef("");
    setResultados(null);
    setError(null);
    setAplicado(null);
    onLimpiar?.();
  }

  const hayAlgo = Boolean(ref.trim() || resultados || error || aplicado || conDatos);

  return (
    <div className="space-y-2 rounded-xl border border-cdmb-100 bg-cdmb-50/40 px-4 py-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-medium text-stone-700">
          Traer datos de SECOP II
          <input
            value={ref}
            onChange={(e) => {
              setRef(e.target.value);
              if (resultados || error) {
                setResultados(null);
                setError(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                consultar();
              }
            }}
            placeholder="N.° de contrato (ej. 210-17708-8), ID del proceso (CO1.BDOS…) o documento del contratista"
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-normal focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
          />
        </label>
        <button
          type="button"
          onClick={() => consultar()}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
        >
          <DownloadCloud className="h-3.5 w-3.5" aria-hidden />
          {cargando ? "Consultando…" : "Consultar"}
        </button>
        {hayAlgo && (
          <button
            type="button"
            onClick={limpiar}
            disabled={cargando}
            title="Borra la búsqueda y los datos traídos de SECOP II, incluido el contratista"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden />
            Limpiar
          </button>
        )}
      </div>
      <p className="text-[11px] text-stone-500">Datos abiertos de SECOP II en datos.gov.co. Revise y complete lo que traiga antes de crear el expediente.</p>
      {error && <p className="text-xs text-amber-800">{error}</p>}
      {resultados && resultados.length > 1 && (
        <p className="text-xs font-medium text-stone-700">Se encontraron {resultados.length} contratos con la CDMB. Elija el que corresponde a este expediente.</p>
      )}

      {resultados?.map((c) => (
        <TarjetaContratoSecop
          key={c.idContrato ?? c.numeroContrato}
          contrato={c}
          accion={
            <button type="button" onClick={() => aplicar(c)} className="rounded bg-cdmb-600 px-2.5 py-1 font-medium text-white hover:bg-cdmb-700">
              Usar estos datos
            </button>
          }
        />
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
