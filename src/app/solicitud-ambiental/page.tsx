import Link from "next/link";
import type { Metadata } from "next";
import { Leaf, ShieldCheck } from "lucide-react";
import { CabeceraTablero } from "@/components/tablero";
import { ElegirTramite } from "@/components/solicitud-ambiental/ElegirTramite";
import { entradasCatalogo } from "@/lib/opciones-catalogo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Solicitud ambiental — CDMB",
  description: "Radique en línea su solicitud de trámite ambiental ante la CDMB, sin crear una cuenta.",
};

export default async function SolicitudAmbientalPage() {
  const entradas = await entradasCatalogo((slug, flujo) => (flujo ? `/solicitud-ambiental/${slug}?flujo=${flujo}` : `/solicitud-ambiental/${slug}`));
  // Los instrumentos económicos no son trámites que radique el ciudadano.
  const tramites = entradas.filter((e) => !e.codigo.startsWith("IE-")).map((e) => ({ clave: e.clave, href: e.href, nombre: e.nombre, codigo: e.codigo, suits: e.suits, enSuit: e.enSuit, radicable: e.radicable, descripcion: e.descripcion }));

  return (
    <div className="space-y-5">
      <CabeceraTablero
        icon={Leaf}
        titulo="Solicitud ambiental"
        descripcion={
          <>
            Radique en línea su solicitud de trámite ambiental ante la CDMB, sin crear una cuenta. Al enviarla recibe un número de
            solicitud con el que puede consultar el estado en{" "}
            <Link href="/solicitud-ambiental/consultar" className="text-cdmb-700 underline hover:no-underline">
              Consultar solicitud ambiental
            </Link>
            .
          </>
        }
      />

      <ElegirTramite tramites={tramites} />

      <div className="rounded-2xl bg-white/80 p-4 text-xs leading-relaxed text-stone-500 ring-1 ring-stone-200/70">
        <p className="flex items-center gap-1.5 font-medium text-stone-600">
          <ShieldCheck className="h-3.5 w-3.5 flex-none text-cdmb-600" aria-hidden /> Antes de empezar
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>Tenga a la mano su cédula o NIT, los datos del predio o lugar del trámite y los documentos que exige el trámite.</li>
          <li>
            Cada archivo puede pesar hasta <strong>2 MB</strong> (los planos, hasta 10 MB). Se aceptan PDF, Word, Excel e imágenes JPG o PNG.
          </li>
          <li>Indique un correo electrónico o un teléfono para que la CDMB pueda comunicarle las novedades de su solicitud.</li>
        </ul>
      </div>
    </div>
  );
}
