import Link from "next/link";
import { PqrsdConsultarForm } from "@/components/PqrsdConsultarForm";
import { Search } from "lucide-react";
import { CabeceraTablero } from "@/components/tablero";

export default function PqrsdConsultarPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <CabeceraTablero
        icon={Search}
        titulo="Consultar estado de una solicitud"
        descripcion={
          <>
            Ingrese el número de radicado y la identificación con la que la radicó, o el código de seguimiento si fue anónima.{" "}
            <Link href="/pqrsd" className="text-cdmb-700 hover:underline">¿Necesita radicar una nueva solicitud?</Link>
          </>
        }
      />
      <PqrsdConsultarForm />
    </div>
  );
}
