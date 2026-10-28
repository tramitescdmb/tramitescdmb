import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarTramite, puedeVerExpedienteTramite } from "@/lib/permisos";
import { usuarioFlujo } from "@/lib/flujos";
import { operarFlujoDeObjeto } from "@/lib/flujos-operar";
import { registrarAccesoDenegadoAccion, datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/expedientes/${id}#flujo-trabajo`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const expediente = await db.expediente.findUnique({ where: { id }, select: { id: true, tramiteTipoId: true } });
  if (!expediente || !permisos.modulos.has("TRAMITES") || !puedeVerExpedienteTramite(permisos, expediente)) {
    await registrarAccesoDenegadoAccion("Operar flujo de trabajo de trámite", id, session, await headers());
    volver.searchParams.set("error", "No tiene acceso a este expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  const usuario = await usuarioFlujo(session.userId, permisos, "TRAMITES");
  const r = await operarFlujoDeObjeto({
    ambito: "TRAMITE",
    objetoId: id,
    form: await req.formData(),
    usuario,
    puedeIniciarOCancelar: puedeEditarTramite(permisos, expediente.tramiteTipoId),
    ip: datosPeticion(await headers()).ip,
  });
  if ("ok" in r) volver.searchParams.set("ok", r.ok);
  else volver.searchParams.set("error", r.error);
  return NextResponse.redirect(volver, { status: 303 });
}
