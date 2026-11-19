import Link from "next/link";
import type { Metadata } from "next";
import { EncabezadoSolicitud } from "@/components/solicitud-ambiental/Encabezado";
import { ConsultarSolicitudForm } from "@/components/solicitud-ambiental/ConsultarSolicitudForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consultar solicitud ambiental — CDMB",
  description: "Consulte el estado de su solicitud de trámite ambiental con su cédula o NIT y el número de solicitud.",
};

export default function ConsultarSolicitudAmbientalPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <EncabezadoSolicitud titulo="Consultar solicitud ambiental">
        Ingrese la cédula o el NIT con el que radicó y el número de solicitud que recibió.{" "}
        <Link href="/solicitud-ambiental" className="font-semibold text-white underline underline-offset-2 hover:no-underline">
          ¿Necesita radicar una nueva solicitud?
        </Link>
      </EncabezadoSolicitud>
      <ConsultarSolicitudForm />
    </div>
  );
}
