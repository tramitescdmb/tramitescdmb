import { NextRequest, NextResponse } from "next/server";
import { auditarNV, exigirPermisoNV } from "@/lib/negocios-verdes-api";
import { limpiarFicha, validarNegocio } from "@/lib/negocios-verdes-ficha";
import { guardarNegocioNV, slugDisponible } from "@/lib/negocios-verdes-admin";

/** Crea un negocio (sin fotos: se suben al editarlo, cuando ya tiene su carpeta). */
export async function POST(req: NextRequest) {
  const acceso = await exigirPermisoNV("CREAR");
  if ("error" in acceso) return acceso.error;
  const body = await req.json().catch(() => ({}));
  const { datos, errores } = validarNegocio(body, { negocioId: null });
  const ficha = limpiarFicha(body.fichaTecnica);
  if (!datos || errores.length > 0 || ficha.errores.length > 0) return NextResponse.json({ error: [...errores, ...ficha.errores].join(" ") }, { status: 400 });
  if (!(await slugDisponible(datos.slug, null))) return NextResponse.json({ error: `Ya hay un negocio con la dirección «${datos.slug}». Cambie el nombre o la dirección.` }, { status: 409 });
  try {
    const n = await guardarNegocioNV(null, datos, ficha.ficha, acceso.session.userId);
    await auditarNV({ entidad: "NvNegocio", entidadId: n.id, accion: "CREA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} creó el negocio verde «${n.nombre}»${n.activo ? " (publicado)" : ""}` });
    return NextResponse.json({ id: n.id });
  } catch (e) {
    console.error("[negocios-verdes] crear", e);
    return NextResponse.json({ error: "No se pudo guardar. Revise que la categoría, subcategorías y vereda sigan existiendo." }, { status: 400 });
  }
}
