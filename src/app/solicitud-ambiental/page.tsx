import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, FileCheck2, FolderOpen, Mail, Search, ShieldCheck, UserRound } from "lucide-react";
import { cuentaEnSesion } from "@/lib/cuenta-ciudadana-db";
import { ElegirTramite } from "@/components/solicitud-ambiental/ElegirTramite";
import { BotonEncabezado, EncabezadoSolicitud, PasosSolicitud } from "@/components/solicitud-ambiental/Encabezado";
import { entradasCatalogo } from "@/lib/opciones-catalogo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Solicitud ambiental — CDMB",
  description: "Radique en línea su solicitud de trámite ambiental ante la CDMB y siga su estado.",
};

export default async function SolicitudAmbientalPage() {
  const entradas = await entradasCatalogo((slug, flujo) => (flujo ? `/solicitud-ambiental/${slug}?flujo=${flujo}` : `/solicitud-ambiental/${slug}`));
  // Los instrumentos económicos no son trámites que radique el ciudadano.
  const tramites = entradas
    .filter((e) => !e.codigo.startsWith("IE-"))
    .map((e) => ({ clave: e.clave, href: e.href, nombre: e.nombre, codigo: e.codigo, suits: e.suits, enSuit: e.enSuit, radicable: e.radicable, descripcion: e.descripcion, diasEstimados: e.diasEstimados }));
  const radicables = tramites.filter((t) => t.radicable).length;
  const cuenta = await cuentaEnSesion();

  return (
    <div className="space-y-6">
      <EncabezadoSolicitud
        titulo="Solicitud ambiental"
        acciones={
          <>
            <BotonEncabezado href="#elegir" principal>
              Comenzar <ArrowRight className="h-4 w-4" aria-hidden />
            </BotonEncabezado>
            <BotonEncabezado href="/solicitud-ambiental/consultar">
              <Search className="h-4 w-4" aria-hidden /> Consultar mi solicitud
            </BotonEncabezado>
            <BotonEncabezado href={cuenta ? "/solicitud-ambiental/mis-solicitudes" : "/solicitud-ambiental/ingresar"}>
              {cuenta ? <FolderOpen className="h-4 w-4" aria-hidden /> : <UserRound className="h-4 w-4" aria-hidden />}
              {cuenta ? "Mis solicitudes" : "Ingresar o registrarse"}
            </BotonEncabezado>
          </>
        }
      >
        Radique en línea su trámite ambiental ante la CDMB. Hay {radicables} trámites disponibles; al enviar recibe un número de solicitud
        para seguir su estado. Si ingresa con su correo, verá todas sus solicitudes, su historial y lo que esté pendiente en «Mis
        solicitudes».
      </EncabezadoSolicitud>

      {cuenta ? (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-cdmb-200 bg-cdmb-50 px-4 py-3 text-sm text-cdmb-900">
          <UserRound className="h-4 w-4" aria-hidden />
          Ingresó como <strong>{cuenta.correo}</strong>. Lo que radique quedará en{" "}
          <Link href="/solicitud-ambiental/mis-solicitudes" className="font-semibold underline hover:no-underline">
            Mis solicitudes
          </Link>
          .
        </p>
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl border border-cdmb-200 bg-cdmb-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-cdmb-900">
            <p className="font-semibold">Para radicar, ingrese o regístrese con su correo</p>
            <p className="mt-0.5">
              Sin contraseña: le enviamos un código. Puede consultar el catálogo libremente; al elegir un trámite le pediremos ingresar. Así verá
              todas sus solicitudes, su historial y, si la CDMB le pide corregir un documento, lo cargará sin empezar de nuevo.
            </p>
          </div>
          <Link
            href="/solicitud-ambiental/ingresar?siguiente=/solicitud-ambiental"
            className="inline-flex flex-none items-center justify-center gap-1.5 rounded-md bg-cdmb-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cdmb-800"
          >
            <UserRound className="h-4 w-4" aria-hidden /> Ingresar o registrarse
          </Link>
        </section>
      )}

      <PasosSolicitud actual={1} />

      <ElegirTramite tramites={tramites} />

      <section aria-labelledby="titulo-antes" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
        <h2 id="titulo-antes" className="flex items-center gap-2 text-sm font-semibold text-stone-800">
          <ShieldCheck className="h-4 w-4 text-cdmb-600" aria-hidden /> Antes de empezar
        </h2>
        <ul className="mt-3 grid gap-3 text-sm text-stone-600 sm:grid-cols-3">
          <li className="flex gap-2">
            <FileCheck2 className="mt-0.5 h-4 w-4 flex-none text-cdmb-600" aria-hidden />
            <span>Tenga a la mano su cédula o NIT, los datos del lugar del trámite y los documentos que exige.</span>
          </li>
          <li className="flex gap-2">
            <Clock className="mt-0.5 h-4 w-4 flex-none text-cdmb-600" aria-hidden />
            <span>
              Cada archivo puede pesar hasta <strong>2 MB</strong> (planos, 10 MB). PDF, Word, Excel, JPG o PNG.
            </span>
          </li>
          <li className="flex gap-2">
            <Mail className="mt-0.5 h-4 w-4 flex-none text-cdmb-600" aria-hidden />
            <span>Indique un correo o un teléfono para que la CDMB le comunique las novedades.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
