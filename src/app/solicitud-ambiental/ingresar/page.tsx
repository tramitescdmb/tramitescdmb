import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncabezadoSolicitud } from "@/components/solicitud-ambiental/Encabezado";
import { IngresarCiudadanoForm } from "@/components/solicitud-ambiental/IngresarCiudadanoForm";
import { rutaSiguienteSegura } from "@/lib/cuenta-ciudadana";
import { cuentaEnSesion } from "@/lib/cuenta-ciudadana-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis solicitudes · Ingresar — CDMB",
  description: "Ingrese con su correo para ver sus solicitudes ambientales, su estado y su historial.",
};

export default async function IngresarCiudadanoPage({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const siguiente = rutaSiguienteSegura((await searchParams).siguiente);
  if (await cuentaEnSesion()) redirect(siguiente);
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <EncabezadoSolicitud titulo="Mis solicitudes">
        Ingrese con su correo electrónico para ver todas sus solicitudes ambientales, en qué etapa están y su historial. No necesita
        contraseña: le enviamos un código cada vez. Si es la primera vez, así queda registrado.
      </EncabezadoSolicitud>
      <IngresarCiudadanoForm siguiente={siguiente} />
    </div>
  );
}
