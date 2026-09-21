import { NextRequest, NextResponse } from "next/server";
import type { TipoPersonaContratista } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";

/** Crea un Contratista en el registro maestro del módulo — desde `/contratacion/contratistas/nuevo`
 * o, si aún no existe, al crear un expediente. Administrador o Jefe de Contratación. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) {
    return NextResponse.json({ error: "No tiene permiso." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const identificacion = String(body.identificacion || "").trim();
  const nombreORazonSocial = String(body.nombreORazonSocial || "").trim();
  const tipoPersona: TipoPersonaContratista = body.tipoPersona === "JURIDICA" ? "JURIDICA" : "NATURAL";

  if (!identificacion) return NextResponse.json({ error: "La identificación es obligatoria." }, { status: 400 });
  if (!nombreORazonSocial) return NextResponse.json({ error: "El nombre o razón social es obligatorio." }, { status: 400 });

  const existente = await db.contratista.findUnique({ where: { identificacion } });
  if (existente) {
    return NextResponse.json({ error: "Ya existe un contratista con esta identificación.", id: existente.id }, { status: 409 });
  }

  const creado = await db.contratista.create({
    data: {
      identificacion,
      nombreORazonSocial,
      tipoPersona,
      nombres: String(body.nombres || "").trim() || null,
      apellidos: String(body.apellidos || "").trim() || null,
      regimenTributario: body.regimenTributario || null,
      granContribuyente: Boolean(body.granContribuyente),
      contactoEmail: String(body.contactoEmail || "").trim() || null,
      contactoTelefono: String(body.contactoTelefono || "").trim() || null,
      direccion: String(body.direccion || "").trim() || null,
      departamento: String(body.departamento || "").trim() || null,
      ciudad: String(body.ciudad || "").trim() || null,
    },
  });

  return NextResponse.json({ id: creado.id }, { status: 201 });
}
