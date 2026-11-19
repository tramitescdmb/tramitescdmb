import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { CabeceraTablero } from "@/components/tablero";
import { ConsultarSolicitudForm } from "@/components/solicitud-ambiental/ConsultarSolicitudForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consultar solicitud ambiental — CDMB",
  description: "Consulte el estado de su solicitud de trámite ambiental con su cédula o NIT y el número de solicitud.",
};

export default function ConsultarSolicitudAmbientalPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <CabeceraTablero
        icon={Search}
        titulo="Consultar solicitud ambiental"
        descripcion={
          <>
            Ingrese la cédula o el NIT con el que radicó y el número de solicitud que recibió.{" "}
            <Link href="/solicitud-ambiental" className="text-cdmb-700 hover:underline">
              ¿Necesita radicar una nueva solicitud?
            </Link>
          </>
        }
      />
      <ConsultarSolicitudForm />
    </div>
  );
}
