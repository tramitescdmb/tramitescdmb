import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditarNV, exigirPermisoNV } from "@/lib/negocios-verdes-api";
import { TIPOS_PERSONA, validarPersona } from "@/lib/negocios-verdes-catalogo";

/** Crea o edita una persona (responsable CDMB, delegado o representante). Datos internos. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" && body.id ? body.id : null;
  const acceso = await exigirPermisoNV(id ? "ACTUALIZAR" : "CREAR");
  if ("error" in acceso) return acceso.error;
  const { datos, errores } = validarPersona(body);
  if (!datos) return NextResponse.json({ error: errores.join(" ") }, { status: 400 });
  try {
    const p = id ? await db.nvPersona.update({ where: { id }, data: datos }) : await db.nvPersona.create({ data: datos });
    await auditarNV({
      entidad: "NvPersona",
      entidadId: p.id,
      accion: id ? "MODIFICA" : "CREA",
      usuarioId: acceso.session.userId,
      detalle: `${acceso.session.nombre} ${id ? "editó" : "registró"} a ${p.nombres} ${p.apellidos ?? ""} (${TIPOS_PERSONA[p.tipo]}) en Negocios Verdes`,
    });
    return NextResponse.json({ id: p.id });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const acceso = await exigirPermisoNV("ELIMINAR");
  if ("error" in acceso) return acceso.error;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const vinculos = await db.nvNegocioPersona.count({ where: { personaId: id } });
  if (vinculos > 0) return NextResponse.json({ error: `Tiene ${vinculos} vínculo(s) con negocios (vigentes o históricos). Márquela como inactiva en lugar de eliminarla.` }, { status: 409 });
  try {
    const p = await db.nvPersona.delete({ where: { id } });
    await auditarNV({ entidad: "NvPersona", entidadId: id, accion: "ELIMINA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} eliminó a ${p.nombres} ${p.apellidos ?? ""} de Negocios Verdes` });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "La persona ya no existe." }, { status: 404 });
  }
}
