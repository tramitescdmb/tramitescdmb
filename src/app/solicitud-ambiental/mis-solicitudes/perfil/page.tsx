import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncabezadoSolicitud } from "@/components/solicitud-ambiental/Encabezado";
import { BotonSalirCiudadano, CambiarCorreoForm, PerfilCiudadanoForm } from "@/components/solicitud-ambiental/CuentaCiudadana";
import { cuentaEnSesion, perfilDeCuenta } from "@/lib/cuenta-ciudadana-db";
import { formatearFechaLarga as fecha } from "@/lib/fecha";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mi perfil — CDMB", description: "Datos de su cuenta en Mis solicitudes." };

export default async function MiPerfilPage() {
  const cuenta = await cuentaEnSesion();
  if (!cuenta) redirect(`/solicitud-ambiental/ingresar?siguiente=${encodeURIComponent("/solicitud-ambiental/mis-solicitudes/perfil")}`);
  if (!cuenta.completa) redirect("/solicitud-ambiental/mis-solicitudes");
  const perfil = await perfilDeCuenta(cuenta.id);
  if (!perfil) redirect("/solicitud-ambiental/ingresar");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/solicitud-ambiental/mis-solicitudes" className="text-xs font-medium uppercase tracking-wide text-cdmb-700 hover:underline">
        ← Mis solicitudes
      </Link>
      <EncabezadoSolicitud titulo="Mi perfil" acciones={<BotonSalirCiudadano />}>
        {perfil.nombre}
        {perfil.perfilActualizadoEn ? ` · Actualizado el ${fecha(perfil.perfilActualizadoEn)}` : ""}
      </EncabezadoSolicitud>
      <CambiarCorreoForm correoActual={perfil.correo} />
      <PerfilCiudadanoForm inicial={perfil} />
      <p className="text-xs text-stone-500">
        Los cambios de su perfil aplican a las solicitudes nuevas. Las ya radicadas conservan los datos con que se radicaron.
      </p>
    </div>
  );
}
