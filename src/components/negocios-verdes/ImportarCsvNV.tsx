"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { llamarNV } from "@/lib/negocios-verdes-cliente";

type Resumen = { total: number; conError: number; errores: { fila: number; errores: string[] }[]; creados?: number; actualizados?: number; omitidas?: number };

/** Exportar todos los negocios y, con perfil para crear, importar un CSV en dos pasos: revisar y confirmar. */
export function ImportarCsvNV({ puedeImportar }: { puedeImportar: boolean }) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [hecho, setHecho] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(confirmar: boolean, omitirErrores = false) {
    if (!archivo) return;
    setOcupado(true);
    setError(null);
    const fd = new FormData();
    fd.append("archivo", archivo);
    if (confirmar) fd.append("confirmar", "1");
    if (omitirErrores) fd.append("omitirErrores", "1");
    try {
      const r = await llamarNV<Resumen>("/api/negocios-verdes/importar", "POST", fd);
      if (confirmar) {
        setHecho(r);
        setResumen(null);
        setArchivo(null);
        router.refresh();
      } else setResumen(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="font-semibold text-stone-900">Exportar</h3>
        <p className="text-sm text-stone-600">
          Descarga todos los negocios (publicados y sin publicar) con las mismas columnas de la plataforma anterior. Se abre en Excel. Sirve también como plantilla para importar.
          No incluye ficha técnica, puntajes ni personas.
        </p>
        <a href="/api/negocios-verdes/exportar" className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">
          <Download className="h-4 w-4" /> Exportar CSV
        </a>
      </section>

      {puedeImportar && (
        <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="font-semibold text-stone-900">Importar</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-stone-600">
            <li>Las filas con «id» o «slug» de un negocio existente lo actualizan; las demás crean negocios nuevos, que quedan sin publicar.</li>
            <li>Categorías, subcategorías y actividades se escriben por su nombre, separadas por «|», y deben existir en la clasificación.</li>
            <li>Solo cambia datos públicos y clasificación: nunca fotos, productos, ficha técnica ni puntajes.</li>
            <li>Primero se revisa el archivo sin cambiar nada. Si hay filas con error puede corregirlas o importar solo las válidas. Máximo 2.000 filas.</li>
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null);
                setResumen(null);
                setHecho(null);
                setError(null);
              }}
              className="text-sm"
            />
            <button type="button" disabled={!archivo || ocupado} onClick={() => enviar(false)} className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50">
              <Upload className="h-4 w-4" /> Revisar archivo
            </button>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {resumen && (
            <div className="space-y-2 rounded-lg bg-stone-50 p-3 text-sm">
              <p>
                {resumen.total} fila{resumen.total === 1 ? "" : "s"} leída{resumen.total === 1 ? "" : "s"}; {resumen.conError === 0 ? "todas válidas." : `${resumen.conError} con error.`}
              </p>
              {resumen.errores.length > 0 && (
                <ul className="max-h-64 space-y-1 overflow-auto text-xs text-red-700">
                  {resumen.errores.map((f) => (
                    <li key={f.fila}>
                      Fila {f.fila}: {f.errores.join(" ")}
                    </li>
                  ))}
                  {resumen.conError > resumen.errores.length && <li>… y {resumen.conError - resumen.errores.length} filas más.</li>}
                </ul>
              )}
              {resumen.conError > 0 && resumen.conError < resumen.total && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => window.confirm(`Se importarán ${resumen.total - resumen.conError} filas y se omitirán ${resumen.conError} con error, que quedan como están. ¿Continuar?`) && enviar(true, true)}
                  className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                >
                  Importar solo las {resumen.total - resumen.conError} filas válidas
                </button>
              )}
              {resumen.conError === 0 && resumen.total > 0 && (
                <button type="button" disabled={ocupado} onClick={() => enviar(true)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                  Importar {resumen.total} fila{resumen.total === 1 ? "" : "s"}
                </button>
              )}
            </div>
          )}
          {hecho && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Importación terminada: {hecho.creados ?? 0} negocios nuevos (sin publicar) y {hecho.actualizados ?? 0} actualizados{hecho.omitidas ? `; ${hecho.omitidas} filas con error se omitieron` : ""}.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
