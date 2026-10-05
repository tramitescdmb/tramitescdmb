import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederTramite } from "@/lib/permisos";
import { construirWhereExpedientes } from "@/lib/expedientes";
import { csvExpedientes, xlsxExpedientes, type FilaExportExpediente } from "@/lib/expedientes-exportar";
import { resolverPeriodo } from "@/lib/periodo-dashboard";
import { registrarAuditoria } from "@/lib/auditoria";

const TAMANO_LOTE = 1000;
const TOPE_REGISTROS = 50_000;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const sp = req.nextUrl.searchParams;
  const estado = sp.get("estado") || undefined;
  const q = sp.get("q") || undefined;
  const tramite = sp.get("tramite") || undefined;
  const municipio = sp.get("municipio") || undefined;
  const asignados = sp.get("asignados") || undefined;
  const desde = sp.get("desde") || undefined;
  const hasta = sp.get("hasta") || undefined;
  const formato = sp.get("formato") === "csv" ? "csv" : "xlsx";

  const { rango, etiqueta: etiquetaPeriodo } = resolverPeriodo({ desde, hasta });
  const tramiteIdsPermitidos = !permisos.esAdmin ? Array.from(permisos.tramites.keys()) : null;
  if (tramite && !puedeAccederTramite(permisos, tramite)) {
    return NextResponse.json({ error: "No tiene acceso a ese trámite." }, { status: 403 });
  }

  const soloMios = asignados === "mi";
  const where = construirWhereExpedientes({
    tramiteIdsPermitidos,
    estado,
    tramite,
    municipio,
    rango,
    busqueda: q,
    soloMios,
    usuarioId: session.userId,
    cargos: session.cargos,
  });

  const filas: FilaExportExpediente[] = [];
  let skip = 0;
  for (;;) {
    const lote = await db.expediente.findMany({
      where,
      orderBy: { fechaUltimoMovimiento: "desc" },
      skip,
      take: TAMANO_LOTE,
      select: {
        numero: true,
        estado: true,
        archivado: true,
        municipio: true,
        solicitanteNombre: true,
        solicitanteIdentificacion: true,
        fechaRadicacion: true,
        fechaUltimoMovimiento: true,
        tramiteTipo: { select: { codigo: true, nombre: true } },
      },
    });
    for (const e of lote) {
      filas.push({
        numero: e.numero,
        tramiteCodigo: e.tramiteTipo.codigo,
        tramiteNombre: e.tramiteTipo.nombre,
        solicitanteNombre: e.solicitanteNombre,
        solicitanteIdentificacion: e.solicitanteIdentificacion,
        municipio: e.municipio,
        estado: e.estado,
        archivado: e.archivado,
        fechaRadicacion: e.fechaRadicacion,
        fechaUltimoMovimiento: e.fechaUltimoMovimiento,
      });
    }
    if (lote.length < TAMANO_LOTE || filas.length >= TOPE_REGISTROS) break;
    skip += TAMANO_LOTE;
  }

  const clausulas: string[] = [];
  if (tramite) {
    const t = await db.tramiteTipo.findUnique({ where: { id: tramite }, select: { codigo: true, nombre: true } });
    clausulas.push(`trámite ${t ? `${t.codigo} — ${t.nombre}` : tramite}`);
  }
  if (municipio) clausulas.push(`municipio ${municipio}`);
  if (estado) clausulas.push(`estado "${estado.replaceAll("_", " ")}"`);
  if (rango) clausulas.push(`radicados entre ${etiquetaPeriodo}`);
  if (soloMios) clausulas.push("asignados al usuario");
  if (q) clausulas.push(`búsqueda "${q}"`);
  const filtrosTexto = clausulas.join("; ");

  await registrarAuditoria({
    tipo: "EXPEDIENTES_EXPORTADOS",
    descripcion: `Exportó ${filas.length} expediente(s) en ${formato.toUpperCase()}. Filtros: ${filtrosTexto || "ninguno"}.`,
    usuarioId: session.userId,
  });

  const fechaArchivo = new Date().toISOString().slice(0, 10);
  if (formato === "csv") {
    return new NextResponse(csvExpedientes(filas, filtrosTexto), {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="expedientes_${fechaArchivo}.csv"`,
      },
    });
  }
  const buffer = await xlsxExpedientes(filas, filtrosTexto);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="expedientes_${fechaArchivo}.xlsx"`,
    },
  });
}
