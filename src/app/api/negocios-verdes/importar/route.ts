import { NextRequest, NextResponse } from "next/server";
import { auditarNV, exigirPermisoNV } from "@/lib/negocios-verdes-api";
import { aplicarImportacionNV, catalogoCsvNV } from "@/lib/negocios-verdes-admin";
import { interpretarCsvNV } from "@/lib/negocios-verdes-csv";

/**
 * Importa negocios desde CSV. Sin «confirmar» solo revisa y devuelve el resumen (nada cambia);
 * con «confirmar=1» aplica las filas. Si alguna fila tiene errores no se aplica ninguna, salvo que
 * se pida «omitirErrores=1»: entonces se aplican solo las válidas y las demás quedan como estaban.
 */
export async function POST(req: NextRequest) {
  const acceso = await exigirPermisoNV("CREAR");
  if ("error" in acceso) return acceso.error;
  // Importar también actualiza negocios existentes.
  const actualizar = await exigirPermisoNV("ACTUALIZAR");
  if ("error" in actualizar) return actualizar.error;
  const form = await req.formData().catch(() => null);
  const archivo = form?.get("archivo");
  if (!archivo || typeof archivo === "string") return NextResponse.json({ error: "Falta el archivo CSV." }, { status: 400 });
  if (archivo.size > 5 * 1024 * 1024) return NextResponse.json({ error: "El archivo supera 5 MB." }, { status: 413 });
  const { filas, errorGeneral } = interpretarCsvNV(await archivo.text(), await catalogoCsvNV());
  if (errorGeneral) return NextResponse.json({ error: errorGeneral }, { status: 400 });
  const conError = filas.filter((f) => f.errores.length > 0);
  const resumen = { total: filas.length, conError: conError.length, errores: conError.slice(0, 50).map((f) => ({ fila: f.fila, errores: f.errores })) };
  if (form?.get("confirmar") !== "1") return NextResponse.json({ revision: true, ...resumen });
  const omitir = form.get("omitirErrores") === "1";
  if (conError.length > 0 && !omitir) return NextResponse.json({ error: "Corrija las filas con error antes de importar.", ...resumen }, { status: 400 });
  const validas = filas.filter((f) => f.datos && f.errores.length === 0);
  if (validas.length === 0) return NextResponse.json({ error: "No hay filas válidas para importar.", ...resumen }, { status: 400 });
  const r = await aplicarImportacionNV(
    validas.map((f) => ({ id: f.id, slug: f.slug, datos: f.datos! })),
    acceso.session.userId
  );
  await auditarNV({
    entidad: "NvNegocio",
    entidadId: "importacion",
    accion: "CREA",
    usuarioId: acceso.session.userId,
    detalle: `${acceso.session.nombre} importó negocios verdes desde CSV (${archivo.name}): ${r.creados} nuevos sin publicar, ${r.actualizados} actualizados${conError.length ? `, ${conError.length} filas con error omitidas` : ""}`,
  });
  return NextResponse.json({ ...resumen, ...r, omitidas: conError.length });
}
