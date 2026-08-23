import Link from "next/link";
import { NuevoSolicitanteForm } from "@/components/NuevoSolicitanteForm";

export default function NuevoSolicitantePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/solicitantes" className="text-sm text-cdmb-700 hover:underline">
          ← Solicitantes
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-stone-900">Nuevo solicitante</h1>
        <p className="text-sm text-stone-500">
          Permite registrar un NIT o cédula antes de que llegue su primer trámite. Al radicar un
          expediente, la búsqueda por esta identificación completa automáticamente estos datos.
        </p>
      </div>

      <NuevoSolicitanteForm />
    </div>
  );
}
