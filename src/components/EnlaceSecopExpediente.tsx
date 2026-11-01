"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Link2, Search, Unlink, X } from "lucide-react";
import { TarjetaContratoSecop, type ContratoSecopRespuesta } from "@/components/TraerDeSecop";

type Modo = "elegir" | "desvincular";

const soloDigitos = (v: string) => v.replace(/\D/g, "");

export function EnlaceSecopExpediente({
  expedienteId,
  enlazado,
  documentoContratista,
}: {
  expedienteId: string;
  enlazado: { idContrato: string; numeroContrato: string | null } | null;
  documentoContratista: string | null;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo | null>(null);
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<ContratoSecopRespuesta[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modo) return;
    const cerrarConEsc = (e: KeyboardEvent) => e.key === "Escape" && !enviando && setModo(null);
    window.addEventListener("keydown", cerrarConEsc);
    return () => window.removeEventListener("keydown", cerrarConEsc);
  }, [modo, enviando]);

  async function buscar(texto?: string) {
    setCargando(true);
    setError(null);
    setResultados(null);
    try {
      const q = texto?.trim();
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/secop${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo consultar SECOP II.");
      setConsulta(body.consulta ?? q ?? "");
      setResultados(body.contratos);
      if (!body.consulta) setError("Escriba el número de contrato, el ID del proceso o el documento del contratista.");
      else if (body.contratos.length === 0) setError("No se encontraron contratos de la CDMB en SECOP II con ese dato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  function abrir(e: React.MouseEvent, m: Modo) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setModo(m);
    if (m === "elegir") buscar();
  }

  async function enlazar(c: ContratoSecopRespuesta) {
    if (!c.idContrato) return;
    setEnviando(c.idContrato);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/secop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idContrato: c.idContrato }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo enlazar el contrato.");
      setModo(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setEnviando(null);
    }
  }

  async function desvincular() {
    setEnviando("desvincular");
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/secop`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo desvincular.");
      router.refresh();
      setModo("elegir");
      buscar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setEnviando(null);
    }
  }

  const modal = modo && (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !enviando && setModo(null)}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">
            {modo === "desvincular" ? `Desvincular el contrato ${enlazado?.numeroContrato ?? enlazado?.idContrato ?? ""}` : "Enlazar con SECOP II"}
          </h3>
          <button type="button" onClick={() => setModo(null)} disabled={Boolean(enviando)} className="text-stone-400 hover:text-stone-600" aria-label="Cerrar">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {modo === "desvincular" ? (
          <>
            <p className="text-xs text-stone-600">
              Se retiran del expediente el número de contrato y de proceso, el valor, las fechas y el panel de SECOP II; los documentos, el contratista y los
              supervisores se conservan.
            </p>
            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setModo(null)} disabled={Boolean(enviando)} className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={desvincular}
                disabled={Boolean(enviando)}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Unlink className="h-3.5 w-3.5" aria-hidden />
                {enviando ? "Desvinculando…" : "Desvincular"}
              </button>
            </div>
          </>
        ) : (
          <>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                buscar(consulta);
              }}
            >
              <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-medium text-stone-700">
                Contrato, proceso o documento del contratista
                <input
                  value={consulta}
                  onChange={(e) => setConsulta(e.target.value)}
                  placeholder="210-17708-8, CO1.BDOS… o cédula/NIT"
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-normal focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
                />
              </label>
              <button
                type="submit"
                disabled={cargando}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
              >
                <Search className="h-3.5 w-3.5" aria-hidden />
                {cargando ? "Consultando…" : "Buscar"}
              </button>
            </form>
            {error && <p className="mt-2 text-xs text-amber-800">{error}</p>}
            {resultados && resultados.length > 0 && (
              <p className="mt-3 text-xs font-medium text-stone-700">
                {resultados.length === 1 ? "Se encontró 1 contrato" : `Se encontraron ${resultados.length} contratos`} con la CDMB. Elija el que corresponde a este expediente.
              </p>
            )}
            <div className="mt-2 space-y-2 overflow-y-auto">
              {resultados?.map((c) => (
                <TarjetaContratoSecop
                  key={c.idContrato ?? c.numeroContrato}
                  contrato={c}
                  aviso={
                    documentoContratista && c.contratista.documento && soloDigitos(c.contratista.documento) !== soloDigitos(documentoContratista) ? (
                      <p className="mt-1 text-amber-800">El contratista de este contrato es otro: al enlazarlo reemplaza al del expediente.</p>
                    ) : null
                  }
                  accion={
                    <button
                      type="button"
                      onClick={() => enlazar(c)}
                      disabled={Boolean(enviando) || !c.idContrato}
                      className="inline-flex items-center gap-1 rounded bg-cdmb-600 px-2.5 py-1 font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
                    >
                      <Link2 className="h-3 w-3" aria-hidden />
                      {enviando === c.idContrato ? "Enlazando…" : "Enlazar este contrato"}
                    </button>
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {enlazado ? (
        <button
          type="button"
          onClick={(e) => abrir(e, "desvincular")}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          <Unlink className="h-3.5 w-3.5" aria-hidden />
          Desvincular
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => abrir(e, "elegir")}
          className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          Enlazar con SECOP II
        </button>
      )}
      {modal && createPortal(modal, document.body)}
    </>
  );
}
