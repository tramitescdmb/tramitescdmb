import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChevronRight, FilePlus2, UserRound } from "lucide-react";
import { BotonEncabezado, EncabezadoSolicitud } from "@/components/solicitud-ambiental/Encabezado";
import { BotonSalirCiudadano, PerfilCiudadanoForm, VincularSolicitudForm } from "@/components/solicitud-ambiental/CuentaCiudadana";
import { cuentaEnSesion, perfilDeCuenta } from "@/lib/cuenta-ciudadana-db";
import { rutaSiguienteSegura } from "@/lib/cuenta-ciudadana";
import { db } from "@/lib/db";
import { formatearFechaLarga as fecha } from "@/lib/fecha";
import { nombreFlujo } from "@/lib/flujo-nombre";
import { estadoPublico, etapaPublica } from "@/lib/solicitud-ambiental";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mis solicitudes — CDMB", description: "Sus solicitudes ambientales ante la CDMB." };

export default async function MisSolicitudesPage({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const cuenta = await cuentaEnSesion();
  const { siguiente } = await searchParams;
  const volverA = siguiente ? rutaSiguienteSegura(siguiente) : null;
  if (!cuenta) redirect(volverA ? `/solicitud-ambiental/ingresar?siguiente=${encodeURIComponent(volverA)}` : "/solicitud-ambiental/ingresar");

  const salir = <BotonSalirCiudadano />;
  // Primer ingreso, o cuenta creada antes del perfil completo: se piden los datos antes de seguir.
  if (!cuenta.perfilCompleto) {
    const perfil = await perfilDeCuenta(cuenta.id);
    if (!perfil) redirect("/solicitud-ambiental/ingresar");
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <EncabezadoSolicitud titulo="Mis solicitudes" acciones={salir}>
          {cuenta.completa ? "Antes de seguir, complete los datos de su perfil." : "Un paso más y queda registrado."}
        </EncabezadoSolicitud>
        <PerfilCiudadanoForm inicial={perfil} siguiente={volverA} />
      </div>
    );
  }

  const solicitudes = await db.expediente.findMany({
    where: { cuentaCiudadanaId: cuenta.id },
    orderBy: { fechaRadicacion: "desc" },
    take: 200,
    select: {
      id: true,
      numero: true,
      codigoSolicitudPublica: true,
      estado: true,
      pasoActualNumero: true,
      fechaRadicacion: true,
      fechaUltimoMovimiento: true,
      fechaCierre: true,
      requerimientosCorreccion: { where: { estado: "PENDIENTE" }, select: { plazoHasta: true }, take: 1 },
      tramiteTipo: { select: { nombre: true } },
      flujo: { select: { nombre: true, pasos: { select: { numero: true, titulo: true }, orderBy: { numero: "asc" } } } },
    },
  });

  return (
    <div className="space-y-5">
      <EncabezadoSolicitud
        titulo="Mis solicitudes"
        acciones={
          <>
            <BotonEncabezado href="/solicitud-ambiental" principal>
              <FilePlus2 className="h-4 w-4" aria-hidden /> Radicar una solicitud
            </BotonEncabezado>
            <BotonEncabezado href="/solicitud-ambiental/mis-solicitudes/perfil">
              <UserRound className="h-4 w-4" aria-hidden /> Mi perfil
            </BotonEncabezado>
            {salir}
          </>
        }
      >
        {cuenta.nombre} · {cuenta.correo}
      </EncabezadoSolicitud>

      {solicitudes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-600">
          Todavía no tiene solicitudes en su cuenta. Las que radique con la sesión abierta aparecerán aquí.
        </p>
      ) : (
        <ul className="space-y-3">
          {solicitudes.map((s) => {
            const estado = estadoPublico(s.estado);
            const etapa = etapaPublica({ ...s, pasos: s.flujo.pasos });
            const tipo = nombreFlujo(s.flujo.nombre);
            const requiereAccion = s.estado === "INFORMACION_ADICIONAL_REQUERIDA";
            const correccion = s.requerimientosCorreccion[0];
            return (
              <li key={s.id}>
                <Link
                  href={`/solicitud-ambiental/mis-solicitudes/${s.id}`}
                  className={`flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-soft transition hover:border-cdmb-300 ${requiereAccion ? "border-amber-300" : "border-stone-200"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-900">{s.tramiteTipo.nombre}</p>
                    {tipo !== s.tramiteTipo.nombre && <p className="text-xs text-stone-500">{tipo}</p>}
                    <p className="mt-1 font-mono text-xs text-stone-500">
                      {s.codigoSolicitudPublica ?? "—"} · Expediente {s.numero}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${requiereAccion ? "bg-amber-100 text-amber-900" : "bg-cdmb-50 text-cdmb-800"}`}>
                        {estado.etiqueta}
                      </span>
                      {correccion && <span className="font-semibold text-amber-800">Debe corregir documentos antes del {fecha(correccion.plazoHasta)}</span>}
                      {etapa && !correccion && (
                        <span className="text-stone-600">
                          Etapa {etapa.posicion} de {etapa.total}: {etapa.titulo}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-stone-400">
                      Radicada el {fecha(s.fechaRadicacion)} · Último movimiento {fecha(s.fechaUltimoMovimiento)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 flex-none text-stone-400" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <VincularSolicitudForm />
    </div>
  );
}
