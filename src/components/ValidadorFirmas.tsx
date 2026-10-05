"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, ShieldX, Loader2, Hash, KeyRound, FileText, Building2 } from "lucide-react";

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
type Documento = { codigo: string; plataforma: string; referencia: string; documento: string; hashArchivo: string | null; firmas: Firma[] };

const formato = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });


function Paso({ n, icono, titulo }: { n: number; icono: React.ReactNode; titulo: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-cdmb-600 text-xs font-semibold text-white">{n}</span>
      <span className="text-cdmb-600">{icono}</span>
      {titulo}
    </h2>
  );
}

export function ValidadorFirmas({ csvInicial = "" }: { csvInicial?: string }) {
  const [csv, setCsv] = useState(csvInicial);
  const [numero, setNumero] = useState("");
  const [documentos, setDocumentos] = useState<Documento[] | null>(null);
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultado = useRef<HTMLDivElement>(null);

  async function consultar(codigo: string) {
    setValidando(true);
    setError(null);
    setDocumentos(null);
    try {
      const res = await fetch("/api/validar-firma", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: codigo }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo validar el documento.");
      setDocumentos(body.documentos ?? []);
      requestAnimationFrame(() => resultado.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo validar el documento.");
    } finally {
      setValidando(false);
    }
  }

  useEffect(() => {
    if (csvInicial) consultar(csvInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conFirmas = documentos?.filter((d) => d.firmas.length > 0) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-soft">
          <Paso n={1} icono={<KeyRound className="h-4 w-4" aria-hidden />} titulo="Validar por código seguro de verificación (CSV)" />
          <p className="mt-2 text-xs text-stone-500">
            El código aparece en el margen de cada página del documento firmado y en su hoja de metadatos. También puede leer el código QR.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (csv.trim()) consultar(csv.trim());
            }}
          >
            <input
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder="Ej. G-CMUE2-RYCS0-003KZ-04ZE4-7IUHB"
              className="min-w-0 flex-1 rounded-md border border-stone-200 px-3 py-2 font-mono text-sm uppercase"
            />
            <button type="submit" className="rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">
              Validar
            </button>
          </form>
          <form
            className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (numero.trim()) window.location.href = `/verificar/${encodeURIComponent(numero.trim())}`;
            }}
          >
            <span className="flex-none text-xs text-stone-500">O por radicado / expediente:</span>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ej. CDMB-R-2026-000123"
              className="min-w-0 flex-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs"
            />
            <button type="submit" className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
              Consultar
            </button>
          </form>
        </section>
      </div>

      {validando && (
        <p className="flex items-center gap-2 text-sm text-stone-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Validando…
        </p>
      )}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {documentos && !validando && (
        <div ref={resultado} className="space-y-3">
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${conFirmas.length > 0 ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"}`}
          >
            {conFirmas.length > 0 ? <ShieldCheck className="h-7 w-7 flex-none text-emerald-600" aria-hidden /> : <ShieldX className="h-7 w-7 flex-none text-red-600" aria-hidden />}
            <div>
              <p className="text-base font-semibold text-stone-900">
                {conFirmas.length > 0
                  ? "Documento auténtico, firmado electrónicamente"
                  : documentos.length > 0
                    ? "Documento registrado, sin firmas electrónicas"
                    : "El código no corresponde a ningún documento"}
              </p>
            </div>
          </div>

          {documentos.map((d) => (
            <article key={d.codigo} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
              <div className="grid gap-x-6 gap-y-2 border-b border-stone-100 bg-stone-50/70 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Dato icono={<FileText className="h-3.5 w-3.5" />} k="Documento" v={d.documento} />
                <Dato icono={<Building2 className="h-3.5 w-3.5" />} k="Plataforma" v={d.plataforma} />
                <Dato icono={<Hash className="h-3.5 w-3.5" />} k="Radicado / expediente" v={d.referencia} mono />
                <Dato icono={<KeyRound className="h-3.5 w-3.5" />} k="Código seguro de verificación" v={d.codigo} mono />
                {d.hashArchivo && (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <Dato icono={<Hash className="h-3.5 w-3.5" />} k="SHA-256 del documento original" v={d.hashArchivo} mono />
                  </div>
                )}
              </div>
              {d.firmas.length > 0 && (
                <ul className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {d.firmas.map((f) => (
                    <li key={f.id} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-sm">
                      <p className="flex items-center gap-1.5 font-semibold text-stone-900">
                        <ShieldCheck className="h-4 w-4 flex-none text-emerald-600" aria-hidden />
                        {f.nombre}
                      </p>
                      <p className="text-xs text-stone-600">{f.cargo}</p>
                      <p className="text-xs text-stone-600">{f.entidad}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {f.calidad} · {formato.format(new Date(f.fechaHora))}
                        {f.selloTiempoEn && " · con sello de tiempo"}
                      </p>
                      <p className="mt-1 break-all font-mono text-[10.5px] text-stone-400">
                        Id: {f.id}
                        {f.hashFirma && <> · Huella: {f.hashFirma}</>}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Dato({ icono, k, v, mono }: { icono: React.ReactNode; k: string; v: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-stone-400">
        {icono}
        {k}
      </p>
      <p className={`break-words text-stone-800 ${mono ? "break-all font-mono text-xs" : ""}`}>{v}</p>
    </div>
  );
}
