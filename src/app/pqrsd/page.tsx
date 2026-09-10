import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION } from "@/lib/municipios";
import { PqrsdPublicoForm } from "@/components/PqrsdPublicoForm";

export const metadata: Metadata = {
  title: "Radicar PQRSD — CDMB",
  description: "Radique peticiones, quejas, reclamos, sugerencias y denuncias ante la CDMB.",
};

// Página pública (sin autenticación) — habilitada por prefijo en src/middleware.ts.
export default function PqrsdPublicoPage() {
  const municipios = [...MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Peticiones, quejas, reclamos, sugerencias y denuncias</h1>
        <p className="mt-1.5 text-sm text-stone-600">
          Radique su solicitud ante la CDMB sin crear una cuenta. Al enviarla recibe un número de radicado con
          el que puede consultar el estado en{" "}
          <Link href="/pqrsd/consultar" className="text-cdmb-700 underline hover:no-underline">Consultar estado</Link>.
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3.5 text-xs leading-relaxed text-stone-500">
        <p className="flex items-center gap-1.5 font-medium text-stone-600">
          <ShieldCheck className="h-3.5 w-3.5 flex-none text-cdmb-600" aria-hidden /> Su derecho
        </p>
        <p className="mt-1">
          El derecho de petición está garantizado por el <strong>artículo 23 de la Constitución Política</strong>{" "}
          y regulado por la <strong>Ley 1755 de 2015</strong>. Términos de respuesta: <strong>15 días hábiles</strong>{" "}
          como regla general, <strong>10</strong> para copia de documentos e información, <strong>30</strong>{" "}
          para consultas. Si la solicitud está incompleta, la CDMB puede pedirle que la complete (art. 17 del
          CPACA), lo que suspende el término hasta que responda.
        </p>
        <p className="mt-1.5">
          <strong>Puede radicar de forma anónima.</strong> Las quejas y denuncias anónimas se tramitan cuando
          aportan pruebas o datos concretos que permitan iniciar la actuación (art. 38 de la Ley 190 de 1995 y
          arts. 67 a 70 de la Ley 1474 de 2011 — Estatuto Anticorrupción). Sin datos de contacto la CDMB no
          puede notificarle el resultado de forma individual; guarde el código de seguimiento que recibirá al
          enviar.
        </p>
      </div>

      <PqrsdPublicoForm municipios={municipios} />
    </div>
  );
}
