import { ShieldCheck } from "lucide-react";
import { formatearFechaHora } from "@/lib/fecha";
import { denominacionParaFirma } from "@/lib/denominacion-empleo";

const LEGAL =
  "La firma electrónica identifica al firmante y garantiza la integridad del documento, con la misma validez y efectos jurídicos que la firma manuscrita, conforme a la Ley 527 de 1999 y el Decreto 1074 de 2015.";

type FirmaSello = {
  usuario: {
    nombre: string;
    denominacionEmpleo?: string | null;
    denominacionComplemento?: string | null;
    sexo?: string | null;
  };
  fechaHora: Date | string;
  hashContenido: string;
};

/**
 * Sello de firma electrónica (Ley 527/1999 · Decreto 1074/2015) — deliberadamente
 * compacto: una línea de encabezado, una por firmante y una de fundamento legal.
 * En pantalla el fundamento se abrevia (texto completo en `title`); al imprimir se
 * despliega entero, porque ahí sí es un documento con valor probatorio.
 */
export function SelloFirmaElectronica({ firmas, className = "" }: { firmas: FirmaSello[]; className?: string }) {
  if (!firmas.length) return null;

  return (
    <div
      className={`rounded-md border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-[11px] leading-tight text-stone-600 print:break-inside-avoid ${className}`}
    >
      <p className="flex items-center gap-1 font-medium text-emerald-800">
        <ShieldCheck className="h-3 w-3 flex-none" aria-hidden />
        Documento firmado electrónicamente
      </p>
      {firmas.map((f, i) => {
        const cargo = denominacionParaFirma(f.usuario.denominacionEmpleo, f.usuario.sexo, f.usuario.denominacionComplemento);
        return (
          <p key={i} className="mt-0.5">
            <span className="font-medium text-stone-700">{f.usuario.nombre}</span>
            {cargo ? ` · ${cargo}` : ""}
            {" · "}
            {formatearFechaHora(f.fechaHora)}
            {" · "}
            <span className="font-mono" title={`SHA-256: ${f.hashContenido}`}>
              SHA-256 {f.hashContenido.slice(0, 12)}…
            </span>
          </p>
        );
      })}
      <p className="mt-0.5 text-stone-400" title={LEGAL}>
        <span className="print:hidden">Ley 527 de 1999 · Decreto 1074 de 2015</span>
        <span className="hidden print:inline">{LEGAL}</span>
      </p>
    </div>
  );
}
