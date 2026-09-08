import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { construirWhereBitacora, ETIQUETA_ACCION_BITACORA, ACCIONES_BITACORA } from "@/lib/correspondencia-bitacora";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import type { AccionAuditoriaDoc } from "@prisma/client";

const LIMITE_MAXIMO = 5000;

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Exporta la bitácora inalterable (con los mismos filtros que la pantalla) a CSV — MoReq 1.23 ("historial
 * exportable"). Con más de LIMITE_MAXIMO filas coincidentes, exporta las más recientes hasta ese tope y lo
 * dice en el propio archivo — la bitácora crece indefinidamente, no tendría sentido exportarla sin límite. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para administrar el archivo." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const accionRaw = sp.get("accion");
  const accion = ACCIONES_BITACORA.includes(accionRaw as AccionAuditoriaDoc) ? (accionRaw as AccionAuditoriaDoc) : undefined;
  const filtros = { accion, entidad: sp.get("entidad") || undefined, desde: sp.get("desde") || undefined, hasta: sp.get("hasta") || undefined };
  const where = construirWhereBitacora(filtros);

  const [total, filas] = await Promise.all([
    db.auditoriaDoc.count({ where }),
    db.auditoriaDoc.findMany({
      where,
      orderBy: { secuencia: "desc" },
      take: LIMITE_MAXIMO,
      include: { usuario: { select: { nombre: true } } },
    }),
  ]);

  const encabezados = ["Secuencia", "Fecha/hora", "Acción", "Entidad", "Entidad ID", "Usuario", "IP", "Detalle", "Hash"];
  const filasCsv = filas.map((f) =>
    [
      f.secuencia,
      f.createdAt.toISOString(),
      ETIQUETA_ACCION_BITACORA[f.accion] ?? f.accion,
      f.entidad,
      f.entidadId,
      f.usuario?.nombre ?? "",
      f.ip ?? "",
      f.detalle ?? "",
      f.hash,
    ]
      .map(celda)
      .join(";")
  );

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "AuditoriaDoc",
    entidadId: "bitacora-completa",
    accion: "EXPORTA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Exportó la bitácora a CSV (${filasCsv.length} de ${total} filas coincidentes${filtros.accion ? `, acción=${filtros.accion}` : ""}${filtros.entidad ? `, entidad=${filtros.entidad}` : ""})`,
  }).catch((err) => console.error("No se pudo registrar en la bitácora la exportación de la propia bitácora:", err));

  const BOM = String.fromCharCode(0xfeff);
  const aviso = total > LIMITE_MAXIMO ? [`"Mostrando las ${LIMITE_MAXIMO} más recientes de ${total} filas que coinciden con el filtro."`] : [];
  const csv = BOM + [...aviso, encabezados.map(celda).join(";"), ...filasCsv].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bitacora-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
