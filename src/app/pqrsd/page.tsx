import Link from "next/link";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION } from "@/lib/municipios";
import { PqrsdPublicoForm } from "@/components/PqrsdPublicoForm";

// Página pública (sin autenticación) — habilitada por prefijo en src/middleware.ts.
export default function PqrsdPublicoPage() {
  const municipios = [...MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">Peticiones, quejas, reclamos, sugerencias y denuncias</h1>
        <p className="mt-1 text-sm text-stone-500">
          Radique su solicitud directamente ante la CDMB, sin necesidad de crear una cuenta. Al enviarla recibe un
          número de radicado con el que puede consultar el estado más adelante en{" "}
          <Link href="/pqrsd/consultar" className="text-cdmb-700 hover:underline">/pqrsd/consultar</Link>.
        </p>
      </div>
      <PqrsdPublicoForm municipios={municipios} />
    </div>
  );
}
