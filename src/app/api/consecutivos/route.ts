import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { fijarSiguienteConsecutivo, reiniciarSeriesSinRegistros } from "@/lib/consecutivos";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const form = await req.formData();
  const anio = Number(form.get("anio"));
  const volver = new URL("/admin/consecutivos", req.url);
  if (Number.isInteger(anio)) volver.searchParams.set("anio", String(anio));
  if (!session || session.rol !== "ADMIN") {
    volver.searchParams.set("error", "Solo el administrador del sistema puede cambiar los consecutivos.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  if (form.get("accion") === "reiniciar_libres" && Number.isInteger(anio)) {
    const n = await reiniciarSeriesSinRegistros(anio);
    await registrarAuditoria({
      tipo: "CONFIGURACION_ACTUALIZADA",
      descripcion: `${session.nombre} reinició en 1 las ${n} series de consecutivos sin registros de ${anio}.`,
      usuarioId: session.userId,
    });
    volver.searchParams.set("ok", n ? `${n} series sin registros en ${anio} empezarán en 1.` : `No había series por reiniciar en ${anio}.`);
    return NextResponse.redirect(volver, { status: 303 });
  }

  const serie = String(form.get("serie") ?? "");
  const siguiente = Number(form.get("siguiente"));
  const nombre = String(form.get("nombre") ?? serie);
  if (!serie || !Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    volver.searchParams.set("error", "Datos incompletos.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await fijarSiguienteConsecutivo(serie, anio, siguiente);
  } catch (e) {
    volver.searchParams.set("error", `${nombre}: ${e instanceof Error ? e.message : "no se pudo guardar."}`);
    return NextResponse.redirect(volver, { status: 303 });
  }

  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} fijó en ${siguiente} el siguiente número de «${nombre}» (${serie}) para ${anio}.`,
    usuarioId: session.userId,
  });
  volver.searchParams.set("ok", `${nombre}: el siguiente número de ${anio} será ${siguiente}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
