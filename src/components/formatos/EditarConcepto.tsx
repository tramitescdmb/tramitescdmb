"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Trash2 } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { FormularioFormato } from "@/components/formatos/FormularioFormato";
import { ETIQUETA_RESULTADO_VISITA } from "@/lib/temas-visita";
import { MAX_FOTOS_VISITA, filtrarLoteFotosVisita } from "@/lib/visita-tecnica-fotos";
import { comprimirFotoVisitaTecnica } from "@/lib/compresion-cliente";
import { leerExifFoto } from "@/lib/exif-foto";
import { subirArchivoDirecto } from "@/lib/uploads-client";
import { actualizarTextosTipo, aplicarZonificacion, campoAplica, camposObligatoriosFaltantes, camposPlanos, campoVacio, type DatosPrecarga, type EstructuraFormato, type Respuestas } from "@/lib/formato-visita";

const RESULTADOS = ["VIABLE", "REQUIERE_INFORMACION", "NO_VIABLE", "EN_ANALISIS"] as const;
type Foto = { id: string; url: string; pie: string };

export function EditarConcepto({
  visitaId,
  expedienteId,
  visitaTecnicaId,
  estructura,
  precarga,
  respuestasIniciales,
  resultadoInicial,
  fotosIniciales,
}: {
  visitaId: string;
  expedienteId: string;
  visitaTecnicaId: string;
  estructura: EstructuraFormato;
  precarga: DatosPrecarga;
  respuestasIniciales: Respuestas;
  resultadoInicial: string | null;
  fotosIniciales: Foto[];
}) {
  const router = useRouter();
  const [respuestas, setRespuestas] = useState<Respuestas>(respuestasIniciales);
  const [resultado, setResultado] = useState(resultadoInicial ?? "");
  const [fotos, setFotos] = useState<Foto[]>(fotosIniciales);
  const [faltantes, setFaltantes] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function llamar(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "No se pudo completar la operación.");
    return data;
  }

  async function agregarFotos(lista: FileList | null) {
    if (!lista) return;
    const { validas, error: e } = filtrarLoteFotosVisita(Array.from(lista), fotos.length);
    setError(e);
    for (const [i, original] of validas.entries()) {
      setOcupado(`Subiendo foto ${i + 1} de ${validas.length}…`);
      try {
        const exif = await leerExifFoto(original);
        const comprimida = await comprimirFotoVisitaTecnica(original);
        const subida = await subirArchivoDirecto(expedienteId, comprimida);
        const r = await llamar(`/api/expedientes/${expedienteId}/visitas/${visitaTecnicaId}/fotos`, "POST", {
          storagePath: subida.path,
          mimeType: subida.mimeType,
          tamanoBytes: subida.tamanoBytes,
          nombre: subida.nombre,
          tomadaEn: exif.tomadaEn?.toISOString() ?? null,
          latExif: exif.lat,
          lonExif: exif.lon,
        });
        setFotos((f) => [...f, { id: r.id, url: `/api/visitas-fotos/${r.id}`, pie: "" }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
        break;
      }
    }
    setOcupado(null);
  }

  async function guardarPie(f: Foto) {
    try {
      await llamar(`/api/visitas-fotos/${f.id}`, "PATCH", { pie: f.pie });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el pie de foto.");
    }
  }

  async function quitarFoto(f: Foto) {
    if (!window.confirm("¿Quitar esta foto del registro fotográfico?")) return;
    try {
      await llamar(`/api/visitas-fotos/${f.id}`, "DELETE");
      setFotos((x) => x.filter((y) => y.id !== f.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la foto.");
    }
  }

  async function guardar() {
    setError(null);
    const vacios = camposPlanos(estructura).filter((c) => c.obligatorio && campoAplica(c, precarga) && campoVacio(c, respuestas[c.id]));
    setFaltantes(new Set(vacios.map((c) => c.id)));
    if (vacios.length) return setError(`Complete los campos obligatorios del formato: ${camposObligatoriosFaltantes(estructura, respuestas, precarga).join("; ")}.`);
    setOcupado("Guardando…");
    try {
      await Promise.all(fotos.map((f) => llamar(`/api/visitas-fotos/${f.id}`, "PATCH", { pie: f.pie })));
      await llamar(`/api/visitas-programadas/${visitaId}/registro`, "PATCH", { respuestas, resultado });
      router.push(`/expedientes/${expedienteId}/visitas/${visitaId}/formato`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setOcupado(null);
    }
  }

  const bloqueFotos = (
    <div className="space-y-2">
      {fotos.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fotos.map((f, i) => (
            <div key={f.id} className="flex gap-2 rounded-md border border-stone-200 p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={`Foto ${i + 1}`} className="h-20 w-20 flex-none rounded object-cover" />
              <textarea
                value={f.pie}
                onChange={(e) => setFotos(fotos.map((x) => (x.id === f.id ? { ...x, pie: e.target.value.slice(0, 200) } : x)))}
                onBlur={() => guardarPie(f)}
                rows={3}
                aria-label={`Pie de la foto ${i + 1}`}
                placeholder={`Fotografía ${i + 1}: describa lo que se observa`}
                className="min-w-0 flex-1 resize-none rounded border border-stone-200 px-2 py-1 text-xs focus:border-vivo-500 focus:outline-none"
              />
              <button type="button" onClick={() => quitarFoto(f)} aria-label={`Quitar foto ${i + 1}`} className="self-start rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
      {fotos.length < MAX_FOTOS_VISITA && (
        <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
          <Camera className="h-4 w-4" aria-hidden />
          Agregar fotos ({fotos.length}/{MAX_FOTOS_VISITA})
          <input type="file" accept="image/jpeg,image/png" multiple className="hidden" disabled={Boolean(ocupado)} onChange={(e) => agregarFotos(e.target.files)} />
        </label>
      )}
    </div>
  );
  const conCampoFotos = camposPlanos(estructura).some((c) => c.tipo === "fotos");

  return (
    <div className="space-y-3">
      <FormularioFormato
        estructura={estructura}
        respuestas={respuestas}
        precarga={precarga}
        faltantes={faltantes}
        renderFotos={() => bloqueFotos}
        onZonificar={(coordId, zona) => setRespuestas((prev) => actualizarTextosTipo(estructura, prev, aplicarZonificacion(estructura, prev, coordId, zona, null), precarga))}
        onCambio={(id, valor) => {
          setRespuestas((prev) => actualizarTextosTipo(estructura, prev, { ...prev, [id]: valor }, precarga));
          if (faltantes.has(id)) setFaltantes((f) => new Set([...f].filter((x) => x !== id)));
        }}
      />
      {!conCampoFotos && (
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
          <h3 className="mb-2 text-sm font-semibold text-stone-900">Registro fotográfico</h3>
          {bloqueFotos}
        </section>
      )}
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
        <h3 className="mb-2 text-sm font-semibold text-stone-900">Resultado de la visita</h3>
        <select value={resultado} onChange={(e) => setResultado(e.target.value)} aria-label="Resultado de la visita" className="w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm sm:w-80">
          {RESULTADOS.map((r) => (
            <option key={r} value={r}>
              {ETIQUETA_RESULTADO_VISITA[r]}
            </option>
          ))}
        </select>
      </section>
      {error && (
        <p className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={guardar} disabled={Boolean(ocupado)} className="inline-flex items-center gap-2 rounded-lg bg-acento-500 px-4 py-2 text-sm font-semibold text-white hover:bg-acento-600 disabled:opacity-60">
          {ocupado && <Spinner claro />}
          {ocupado ?? "Guardar correcciones"}
        </button>
        <button type="button" onClick={() => router.back()} disabled={Boolean(ocupado)} className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}
