import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, puedeAdministrarGecon } from "@/lib/permisos";
import { construirWhereExpedienteContractual } from "@/lib/contratacion";
import { usuarioFlujo } from "@/lib/flujos";
import { operarFlujoDeObjeto } from "@/lib/flujos-operar";
import { registrarAccesoDenegadoAccion, datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/contratacion/expedientes/${id}#flujo-trabajo`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const visible =
    puedeAccederContratacion(permisos) &&
    Boolean(await db.expedienteContractual.findFirst({ where: { AND: [{ id }, construirWhereExpedienteContractual({}, permisos)] }, select: { id: true } }));
  if (!visible) {
    await registrarAccesoDenegadoAccion("Operar flujo de trabajo de contrato", id, session, await headers());
    volver.searchParams.set("error", "No tiene acceso a este expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  const usuario = await usuarioFlujo(session.userId, permisos, "GECON");
  const r = await operarFlujoDeObjeto({
    ambito: "CONTRATO",
    objetoId: id,
    form: await req.formData(),
    usuario,
    puedeIniciarOCancelar: puedeAdministrarGecon(permisos) || permisos.asignadoExpedientes.has(id),
    ip: datosPeticion(await headers()).ip,
  });
  if ("ok" in r) volver.searchParams.set("ok", r.ok);
  else volver.searchParams.set("error", r.error);
  return NextResponse.redirect(volver, { status: 303 });
}
