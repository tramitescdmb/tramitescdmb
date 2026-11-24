import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditarNV, exigirPermisoNV } from "@/lib/negocios-verdes-api";
import { validarPuntajes } from "@/lib/negocios-verdes-ficha";
import { guardarPuntajesNV } from "@/lib/negocios-verdes-admin";

/** Reemplaza los puntajes de seguimiento por año (internos: no salen en el sitio público). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const acceso = await exigirPermisoNV("ACTUALIZAR");
  if ("error" in acceso) return acceso.error;
  const { id } = await params;
  const negocio = await db.nvNegocio.findUnique({ where: { id }, select: { nombre: true } });
  if (!negocio) return NextResponse.json({ error: "El negocio ya no existe." }, { status: 404 });
  const { puntajes, errores } = validarPuntajes((await req.json().catch(() => ({}))).puntajes);
  if (errores.length > 0) return NextResponse.json({ error: errores.join(" ") }, { status: 400 });
  await guardarPuntajesNV(id, puntajes);
  await auditarNV({
    entidad: "NvNegocio",
    entidadId: id,
    accion: "MODIFICA",
    usuarioId: acceso.session.userId,
    detalle: `${acceso.session.nombre} actualizó los puntajes de «${negocio.nombre}»: ${puntajes.map((p) => `${p.anio}=${p.puntaje}`).join(", ") || "sin puntajes"}`,
  });
  return NextResponse.json({ puntajes });
}
