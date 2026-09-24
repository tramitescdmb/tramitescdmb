import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { reiniciarDatosPruebaSgdea } from "@/lib/mantenimiento-pruebas";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia/admin", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "Solo quien administra el archivo puede reiniciar los datos de prueba.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  if (String(form.get("confirmacion") || "").trim().toUpperCase() !== "BORRAR") {
    volver.searchParams.set("error", 'Debe escribir "BORRAR" para confirmar el reinicio de datos de prueba.');
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "MantenimientoPruebas",
    entidadId: "reset-sgdea",
    accion: "ELIMINA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `${session.nombre} reinició los datos de prueba del SGDEA (herramienta temporal previa al lanzamiento).`,
  });

  const resultado = await reiniciarDatosPruebaSgdea();

  volver.searchParams.set(
    "ok",
    `Datos de prueba reiniciados: ${resultado.comunicaciones} comunicación(es), ${resultado.firmas} firma(s), ` +
      `${resultado.archivosStorage} archivo(s) de Storage borrados` +
      (resultado.archivosStorageConError > 0 ? ` (${resultado.archivosStorageConError} con error, revisar)` : "") +
      `, ${resultado.solicitantes} solicitante(s) de prueba, ${resultado.seriesConsecutivoReiniciadas} serie(s) de radicación reiniciadas a 0.`
  );
  return NextResponse.redirect(volver, { status: 303 });
}
