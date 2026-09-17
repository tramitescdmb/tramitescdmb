import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarContratacion } from "@/lib/permisos";

/** Crea un Contratista directamente (antes de que tenga cuenta de dominio CDMB) — el Administrador
 * de Contratación lo registra al crear el expediente si aún no existe. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarContratacion(permisos)) {
    return NextResponse.json({ error: "No tiene permiso." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const identificacion = String(body.identificacion || "").trim();
  const nombreORazonSocial = String(body.nombreORazonSocial || "").trim();
  const tipoPersona = body.tipoPersona === "JURIDICA" ? "JURIDICA" : "NATURAL";

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
      contactoEmail: String(body.contactoEmail || "").trim() || null,
      contactoTelefono: String(body.contactoTelefono || "").trim() || null,
    },
  });

  return NextResponse.json({ id: creado.id }, { status: 201 });
}
