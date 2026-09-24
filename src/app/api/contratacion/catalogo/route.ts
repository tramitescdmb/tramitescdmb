import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { EtapaContratacion, ModalidadSeleccion } from "@prisma/client";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarContratacion } from "@/lib/permisos";
import { listarCatalogoRequisitos, crearRequisitoCatalogo, ETAPAS_ORDEN, TAG_CATALOGO_REQUISITOS } from "@/lib/contratacion";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarContratacion(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para ver el catálogo de requisitos." }, { status: 403 });
  }
  const requisitos = await listarCatalogoRequisitos();
  return NextResponse.json({ requisitos });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarContratacion(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para modificar el catálogo de requisitos." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const etapa = body.etapa as EtapaContratacion;
  if (!ETAPAS_ORDEN.includes(etapa)) return NextResponse.json({ error: "Debe indicarse una etapa válida." }, { status: 400 });
  const nombre = String(body.nombre || "").trim();
  if (!nombre) return NextResponse.json({ error: "El nombre del requisito es obligatorio." }, { status: 400 });

  try {
    const requisito = await crearRequisitoCatalogo({
      etapa,
      modalidadSeleccion: body.modalidadSeleccion ? (String(body.modalidadSeleccion) as ModalidadSeleccion) : null,
      nombre,
      codigoFormato: typeof body.codigoFormato === "string" ? body.codigoFormato : null,
      fuente: typeof body.fuente === "string" ? body.fuente : null,
      obligatorio: Boolean(body.obligatorio),
    });
    revalidateTag(TAG_CATALOGO_REQUISITOS);
    return NextResponse.json({ id: requisito.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo crear el requisito." }, { status: 400 });
  }
}
