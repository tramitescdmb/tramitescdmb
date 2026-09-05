import Link from "next/link";
import { PqrsdConsultarForm } from "@/components/PqrsdConsultarForm";

export default function PqrsdConsultarPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">Consultar estado de una solicitud</h1>
        <p className="mt-1 text-sm text-stone-500">
          Ingrese el número de radicado y la identificación con la que la radicó.{" "}
          <Link href="/pqrsd" className="text-cdmb-700 hover:underline">¿Necesita radicar una nueva solicitud?</Link>
        </p>
      </div>
      <PqrsdConsultarForm />
    </div>
  );
}
