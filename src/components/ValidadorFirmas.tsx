"use client";

import { useState } from "react";
import { FileSearch, ShieldCheck, ShieldX, Loader2, Hash, Upload } from "lucide-react";

type Firma = {
  id: string;
  nombre: string;
  cargo: string;
  calidad: string;
  fechaHora: string;
  selloTiempoEn: string | null;
  hashFirma: string | null;
  entidad: string;
};
type Documento = { plataforma: string; referencia: string; documento: string; hashArchivo: string | null; firmas: Firma[] };

const formato = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });

async function sha256Hex(archivo: File): Promise<string> {
  const buffer = await archivo.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function ValidadorFirmas() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<Documento[] | null>(null);
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numero, setNumero] = useState("");

  async function validar(f: File) {
    setArchivo(f);
    setValidando(true);
    setError(null);
    setDocumentos(null);
    try {
      const h = await sha256Hex(f);
      setHash(h);
      const res = await fetch("/api/validar-firma", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash: h }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo validar el documento.");
      setDocumentos(body.documentos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo validar el documento.");
    } finally {
      setValidando(false);
    }
  }

  const conFirmas = documentos?.filter((d) => d.firmas.length > 0) ?? [];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-soft">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cdmb-600 text-xs font-semibold text-white">1</span>
          <Upload className="h-4 w-4 text-cdmb-600" aria-hidden />
          Documento a validar
        </h2>
        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cdmb-200 bg-cdmb-50/40 px-4 py-8 text-center hover:bg-cdmb-50">
          <FileSearch className="h-8 w-8 text-cdmb-600" aria-hidden />
          <span className="text-sm font-medium text-stone-800">{archivo ? archivo.name : "Seleccione el archivo firmado"}</span>
          <span className="text-xs text-stone-500">El archivo no sale de su equipo: solo se compara su huella digital SHA-256.</span>
          <input
            type="file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) validar(f);
            }}
          />
        </label>
        {hash && (
          <p className="mt-2 flex items-start gap-1.5 break-all font-mono text-[11px] text-stone-500">
            <Hash className="mt-0.5 h-3 w-3 flex-none" aria-hidden />
            {hash}
          </p>
        )}
      </section>

      {validando && (
        <p className="flex items-center gap-2 text-sm text-stone-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Validando…
        </p>
      )}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {documentos && !validando && (
        <section
          className={`rounded-xl border p-5 shadow-soft ${conFirmas.length > 0 ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"}`}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cdmb-600 text-xs font-semibold text-white">2</span>
            {conFirmas.length > 0 ? <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden /> : <ShieldX className="h-5 w-5 text-red-600" aria-hidden />}
            {conFirmas.length > 0 ? "Documento auténtico y firmado electrónicamente" : documentos.length > 0 ? "Documento registrado, sin firmas electrónicas" : "No coincide con ningún documento firmado"}
          </h2>
          {documentos.length === 0 && (
            <p className="mt-2 text-sm text-stone-600">
              El archivo no corresponde, byte a byte, a ningún original registrado en las plataformas de la CDMB. Si se trata de una copia con
              sello de firma impreso, valídela con el código QR del sello o con el número de radicado o expediente.
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {documentos.map((d, i) => (
              <li key={`${d.referencia}-${i}`} className="rounded-lg border border-stone-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-cdmb-700">{d.plataforma}</p>
                <p className="text-sm font-medium text-stone-900">{d.documento}</p>
                <p className="font-mono text-xs text-stone-500">{d.referencia}</p>
                {d.hashArchivo && <p className="mt-1 break-all font-mono text-[10.5px] text-stone-400">SHA-256 del documento: {d.hashArchivo}</p>}
                {d.firmas.length > 0 && (
                  <ul className="mt-2 divide-y divide-stone-100 border-t border-stone-100">
                    {d.firmas.map((f) => (
                      <li key={f.id} className="py-2 text-sm">
                        <p className="flex items-center gap-1.5 font-medium text-stone-900">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                          {f.nombre}
                          <span className="font-normal text-stone-500">— {f.cargo}</span>
                        </p>
                        <p className="text-xs text-stone-500">
                          {f.calidad} · {formato.format(new Date(f.fechaHora))}
                          {f.selloTiempoEn && " · con sello de tiempo"}
                        </p>
                        <p className="text-xs text-stone-500">Entidad: {f.entidad}</p>
                        <p className="break-all font-mono text-[10.5px] text-stone-400">
                          Identificador: {f.id}
                          {f.hashFirma && <> · Huella de la firma: {f.hashFirma}</>}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-soft">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <Hash className="h-4 w-4 text-cdmb-600" aria-hidden />
          Validar por número de radicado o expediente
        </h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (numero.trim()) window.location.href = `/verificar/${encodeURIComponent(numero.trim())}`;
          }}
        >
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ej. CDMB-R-2026-000123"
            className="min-w-0 flex-1 rounded-md border border-stone-200 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">
            Validar
          </button>
        </form>
      </section>
    </div>
  );
}
