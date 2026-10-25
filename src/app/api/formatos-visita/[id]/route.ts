import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sesionEditorFormatos, textoLimpio } from "@/lib/formatos-visita-api";
import { tramitesEnUso } from "@/lib/formatos-visita-db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await sesionEditorFormatos();
  if (s instanceof NextResponse) return s;
  const formato = await db.formatoVisita.findUnique({ where: { id } });
  if (!formato) return NextResponse.json({ error: "Formato no encontrado." }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const codigo = textoLimpio(body.codigo, 40).toUpperCase();
  const nombre = textoLimpio(body.nombre, 150);
  const titulo = textoLimpio(body.titulo, 200).toUpperCase();
  if (!codigo || !nombre || !titulo) return NextResponse.json({ error: "Indique el código, el nombre y el título del formato." }, { status: 400 });
  if (codigo !== formato.codigo && (await db.formatoVisita.findUnique({ where: { codigo } }))) {
    return NextResponse.json({ error: `Ya existe un formato con el código ${codigo}.` }, { status: 409 });
  }

  const activo = body.activo !== false;
  const codigosValidos = new Set((await db.tramiteTipo.findMany({ select: { codigo: true } })).map((t) => t.codigo));
  const tramites = Array.isArray(body.tramites) ? [...new Set(body.tramites.map(String).filter((c) => codigosValidos.has(c)))] : formato.tramites;
  if (activo) {
    const otros = await db.formatoVisita.findMany({ select: { id: true, tramites: true, activo: true, nombre: true } });
    const enUso = tramitesEnUso(otros, id);
    const choque = tramites.find((t) => enUso.has(t));
    if (choque) {
      const otro = otros.find((o) => o.id === enUso.get(choque));
      return NextResponse.json({ error: `El trámite ${choque} ya usa el formato «${otro?.nombre}». Retírelo de ese formato primero.` }, { status: 409 });
    }
  }

  const porDefecto = activo && body.porDefecto === true;
  await db.$transaction([
    ...(porDefecto ? [db.formatoVisita.updateMany({ where: { porDefecto: true, NOT: { id } }, data: { porDefecto: false } })] : []),
    db.formatoVisita.update({
      where: { id },
      data: {
        codigo,
        nombre,
        titulo,
        versionDocumento: textoLimpio(body.versionDocumento, 20) || "1",
        fechaDocumento: textoLimpio(body.fechaDocumento, 20) || null,
        tramites,
        activo,
        porDefecto,
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
