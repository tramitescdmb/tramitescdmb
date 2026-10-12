"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, FileUp, Upload } from "lucide-react";
import { COLUMNAS_IMPORTACION, MAX_FILAS_IMPORTACION, type ResultadoFila } from "@/lib/importar-contratistas";

const URL_PLANTILLA = "/api/contratacion/contratistas/importar";

const ESTADO: Record<ResultadoFila["estado"], { texto: string; clase: string }> = {
  listo: { texto: "Listo para importar", clase: "bg-sky-50 text-sky-700" },
  creado: { texto: "Registrado", clase: "bg-emerald-50 text-emerald-700" },
  existente: { texto: "Ya existe", clase: "bg-stone-100 text-stone-600" },
  error: { texto: "Con errores", clase: "bg-red-50 text-red-700" },
};

export function ImportarContratistasSeccion() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [verFormato, setVerFormato] = useState(false);
  const [archivo, setArchivo] = useState<{ nombre: string; texto: string } | null>(null);
  const [resultados, setResultados] = useState<ResultadoFila[] | null>(null);
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  const [importado, setImportado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(texto: string, confirmar: boolean) {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/contratacion/contratistas/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: texto, confirmar }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo procesar el archivo.");
      setResultados(body.resultados);
      setIgnoradas(body.columnasIgnoradas ?? []);
      setImportado(confirmar);
      if (confirmar) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setResultados(null);
    } finally {
      setCargando(false);
    }
  }

  async function elegirArchivo(f: File | undefined) {
    if (!f) return;
    const texto = await f.text();
    setArchivo({ nombre: f.name, texto });
    setImportado(false);
    await enviar(texto, false);
  }

  const listos = resultados?.filter((r) => r.estado === "listo").length ?? 0;
  const conteo = (e: ResultadoFila["estado"]) => resultados?.filter((r) => r.estado === e).length ?? 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <button type="button" onClick={() => setAbierto((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-sky-50 text-sky-700">
          <FileUp className="h-4 w-4" aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-stone-900">Importar contratistas desde CSV</h2>
          <p className="text-xs text-stone-400">Registro masivo de perfiles mínimos. Se revisa cada fila antes de guardar.</p>
        </div>
        <ChevronDown className={`h-4 w-4 flex-none text-stone-400 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {abierto && (
        <div className="mt-4 space-y-4">
          <ol className="grid gap-2 text-xs text-stone-600 sm:grid-cols-3">
            <li className="rounded-lg bg-stone-50 p-3">
              <span className="font-semibold text-stone-800">1. Descargue la plantilla.</span> Ábrala en Excel; ya trae los encabezados y dos filas de ejemplo
              (persona natural y jurídica) que debe reemplazar.
            </li>
            <li className="rounded-lg bg-stone-50 p-3">
              <span className="font-semibold text-stone-800">2. Diligencie una fila por contratista</span> y guarde como «CSV UTF-8 (delimitado por comas)». Se
              aceptan comas o punto y coma; máximo {MAX_FILAS_IMPORTACION} filas.
            </li>
            <li className="rounded-lg bg-stone-50 p-3">
              <span className="font-semibold text-stone-800">3. Cargue el archivo y revise.</span> Nada se guarda hasta confirmar. Los documentos ya registrados se
              omiten.
            </li>
          </ol>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={URL_PLANTILLA}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Descargar plantilla
            </a>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600">
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {archivo ? "Cargar otro archivo" : "Cargar archivo CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  elegirArchivo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <button type="button" onClick={() => setVerFormato((v) => !v)} className="text-xs font-medium text-cdmb-700 hover:underline">
              {verFormato ? "Ocultar formato" : "Ver formato de las columnas"}
            </button>
            {archivo && <span className="text-xs text-stone-400">{archivo.nombre}</span>}
          </div>

          {verFormato && (
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full text-xs">
                <thead className="bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Columna</th>
                    <th className="px-3 py-2 font-medium">Contenido</th>
                    <th className="px-3 py-2 font-medium">Obligatoria</th>
                    <th className="px-3 py-2 font-medium">Ejemplo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {COLUMNAS_IMPORTACION.map((c) => (
                    <tr key={c.clave}>
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-stone-800">{c.clave}</td>
                      <td className="px-3 py-1.5 text-stone-600">
                        {c.titulo}
                        {c.descripcion ? <span className="text-stone-400"> · {c.descripcion}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-stone-600">{c.requerido}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-stone-400">{c.ejemplo.filter(Boolean)[0] ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {cargando && <p className="text-xs text-stone-500">Procesando…</p>}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          {resultados && !cargando && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {(["listo", "creado", "existente", "error"] as const).map((e) =>
                  conteo(e) > 0 ? (
                    <span key={e} className={`rounded-full px-2 py-0.5 font-medium ${ESTADO[e].clase}`}>
                      {conteo(e)} · {ESTADO[e].texto}
                    </span>
                  ) : null
                )}
                {ignoradas.length > 0 && <span className="text-stone-400">Columnas no reconocidas (se ignoran): {ignoradas.join(", ")}</span>}
              </div>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-stone-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Fila</th>
                      <th className="px-3 py-2 font-medium">Documento</th>
                      <th className="px-3 py-2 font-medium">Nombre</th>
                      <th className="px-3 py-2 font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {resultados.map((r) => (
                      <tr key={r.fila}>
                        <td className="px-3 py-1.5 text-stone-400">{r.fila}</td>
                        <td className="px-3 py-1.5 text-stone-700">{r.documento || "—"}</td>
                        <td className="px-3 py-1.5 text-stone-700">
                          {r.contratistaId ? (
                            <Link href={`/contratacion/contratistas/${r.contratistaId}`} className="text-cdmb-700 hover:underline">
                              {r.nombre || "—"}
                            </Link>
                          ) : (
                            r.nombre || "—"
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`rounded-full px-2 py-0.5 font-medium ${ESTADO[r.estado].clase}`}>{ESTADO[r.estado].texto}</span>
                          {r.detalle && <span className="ml-2 text-stone-500">{r.detalle}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!importado && listos > 0 && archivo && (
                <button
                  type="button"
                  onClick={() => enviar(archivo.texto, true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
                >
                  Importar {listos} contratista{listos === 1 ? "" : "s"}
                </button>
              )}
              {!importado && listos === 0 && <p className="text-xs text-stone-500">No hay filas nuevas para importar. Corrija el archivo y vuelva a cargarlo.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
