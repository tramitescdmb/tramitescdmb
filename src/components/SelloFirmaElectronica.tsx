import { ShieldCheck } from "lucide-react";
import { formatearFechaHora } from "@/lib/fecha";
import { denominacionParaFirma } from "@/lib/denominacion-empleo";

type FirmaSello = {
  usuario: {
    nombre: string;
    denominacionEmpleo?: string | null;
    denominacionComplemento?: string | null;
    sexo?: string | null;
    dependencia?: { nombre: string } | null;
  };
  fechaHora: Date | string;
  hashContenido: string;
  selloTiempoEn?: Date | string | null;
  selloTiempoFuente?: string | null;
  selloTiempoToken?: string | null;
};

/**
 * Sello de firma electrónica (Ley 527/1999 · Decreto 1074/2015) — deliberadamente
 * compacto y por líneas: nombre, denominación del empleo, oficina y la marca de
 * tiempo con el hash, una por firmante; el fundamento legal una sola vez al pie.
 * Firma electrónica (identifica al firmante y garantiza la integridad) — distinta
 * de la firma digital con certificado de una entidad de certificación acreditada.
 */
export function SelloFirmaElectronica({ firmas, className = "" }: { firmas: FirmaSello[]; className?: string }) {
  if (!firmas.length) return null;

  return (
    <div
      className={`rounded-md border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-[10px] leading-tight text-stone-600 print:break-inside-avoid ${className}`}
    >
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
        <ShieldCheck className="h-3 w-3 flex-none" aria-hidden />
        Documento firmado electrónicamente
      </p>
      <div className="mt-1 space-y-1.5">
        {firmas.map((f, i) => {
          const cargo = denominacionParaFirma(f.usuario.denominacionEmpleo, f.usuario.sexo, f.usuario.denominacionComplemento);
          const oficina = f.usuario.dependencia?.nombre;
          const sello = f.selloTiempoEn ?? f.fechaHora;
          return (
            <div key={i}>
              <p className="font-medium text-stone-800">{f.usuario.nombre}</p>
              {cargo && <p className="text-stone-500">{cargo}</p>}
              {oficina && <p className="text-stone-500">{oficina}</p>}
              <p className="text-stone-400">
                {formatearFechaHora(sello)}
                {" · "}
                <span className="font-mono" title={`SHA-256: ${f.hashContenido}`}>SHA-256 {f.hashContenido.slice(0, 12)}…</span>
                {f.selloTiempoToken && f.selloTiempoFuente ? ` · sello de tiempo RFC-3161 (${f.selloTiempoFuente})` : ""}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-1 border-t border-emerald-200/70 pt-1 text-stone-400">
        Firma electrónica · Ley 527 de 1999 · Decreto 1074 de 2015
      </p>
    </div>
  );
}
