import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { construirWhereBitacora, ETIQUETA_ACCION_BITACORA, ACCIONES_BITACORA } from "@/lib/correspondencia-bitacora";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { interpretarUserAgent } from "@/lib/user-agent";
import type { AccionAuditoriaDoc } from "@prisma/client";

const LIMITE_MAXIMO = 5000;

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

function escaparXml(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Exporta la bitácora inalterable (con los mismos filtros que la pantalla) a CSV o XML — MoReq 1.23
 * ("historial exportable"). Con más de LIMITE_MAXIMO filas coincidentes, exporta las más recientes hasta
 * ese tope y lo dice en el propio archivo — la bitácora crece indefinidamente, no tendría sentido
 * exportarla sin límite. */
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

  const encabezados = ["Secuencia", "Fecha/hora", "Acción", "Entidad", "Entidad ID", "Usuario", "IP", "Navegador", "Dispositivo", "Detalle", "Hash"];
  const filasCsv = filas.map((f) => {
    const ua = interpretarUserAgent(f.userAgent);
    return [
      f.secuencia,
      f.createdAt.toISOString(),
      ETIQUETA_ACCION_BITACORA[f.accion] ?? f.accion,
      f.entidad,
      f.entidadId,
      f.usuario?.nombre ?? "",
      f.ip ?? "",
      ua.navegador,
      ua.dispositivo,
      f.detalle ?? "",
      f.hash,
    ]
      .map(celda)
      .join(";");
  });

  const formato = sp.get("formato") === "xml" ? "xml" : "csv";
  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "AuditoriaDoc",
    entidadId: "bitacora-completa",
    accion: "EXPORTA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Exportó la bitácora a ${formato.toUpperCase()} (${filasCsv.length} de ${total} filas coincidentes${filtros.accion ? `, acción=${filtros.accion}` : ""}${filtros.entidad ? `, entidad=${filtros.entidad}` : ""})`,
  }).catch((err) => console.error("No se pudo registrar en la bitácora la exportación de la propia bitácora:", err));

  const fecha = new Date().toISOString().slice(0, 10);

  if (formato === "xml") {
    const filasXml = filas
      .map(
        (f) => `  <fila secuencia="${f.secuencia}">
    <fechaHora>${f.createdAt.toISOString()}</fechaHora>
    <accion>${escaparXml(ETIQUETA_ACCION_BITACORA[f.accion] ?? f.accion)}</accion>
    <entidad>${escaparXml(f.entidad)}</entidad>
    <entidadId>${escaparXml(f.entidadId)}</entidadId>
    <usuario>${escaparXml(f.usuario?.nombre)}</usuario>
    <ip>${escaparXml(f.ip)}</ip>
    <navegador>${escaparXml(interpretarUserAgent(f.userAgent).navegador)}</navegador>
    <dispositivo>${escaparXml(interpretarUserAgent(f.userAgent).dispositivo)}</dispositivo>
    <detalle>${escaparXml(f.detalle)}</detalle>
    <hash>${escaparXml(f.hash)}</hash>
  </fila>`
      )
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bitacora total="${total}" exportadas="${filas.length}"${total > LIMITE_MAXIMO ? ` aviso="Mostrando las ${LIMITE_MAXIMO} más recientes de ${total} filas que coinciden con el filtro."` : ""}>
${filasXml}
</bitacora>
`;
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="bitacora-${fecha}.xml"`,
      },
    });
  }

  const BOM = String.fromCharCode(0xfeff);
  const aviso = total > LIMITE_MAXIMO ? [`"Mostrando las ${LIMITE_MAXIMO} más recientes de ${total} filas que coinciden con el filtro."`] : [];
  const csv = BOM + [...aviso, encabezados.map(celda).join(";"), ...filasCsv].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bitacora-${fecha}.csv"`,
    },
  });
}
