import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, esContratistaGecon } from "@/lib/permisos";
import { construirWhereExpedienteContractual, ETIQUETA_ETAPA, ETIQUETA_MODALIDAD, type FiltrosContratacion } from "@/lib/contratacion";
import { ETIQUETA_TIPO_CONTRATO, type TipoContrato } from "@/lib/tipo-contrato";
import { csvContratos, xlsxContratos, type FilaExportContrato } from "@/lib/contratacion-exportar";
import { registrarAuditoria } from "@/lib/auditoria";

const TAMANO_LOTE = 500;
const TOPE_REGISTROS = 20_000;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) return NextResponse.json({ error: "No tiene acceso a GECON." }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const filtros: FiltrosContratacion = {
    q: sp.get("q") || undefined,
    etapa: sp.get("etapa") || undefined,
    dependenciaId: sp.get("dependenciaId") || undefined,
    vigencia: sp.get("vigencia") || undefined,
  };
  const formato = sp.get("formato") === "csv" ? "csv" : "xlsx";
  const where = construirWhereExpedienteContractual(filtros, permisos);
  const soloContractuales = esContratistaGecon(permisos);

  const filas: FilaExportContrato[] = [];
  for (let skip = 0; ; skip += TAMANO_LOTE) {
    const lote = await db.expedienteContractual.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: TAMANO_LOTE,
      select: {
        numero: true,
        codigoProceso: true,
        numeroProcesoSecop: true,
        numeroContrato: true,
        objeto: true,
        modalidadSeleccion: true,
        tipoContrato: true,
        valor: true,
        etapaActual: true,
        cerrado: true,
        fechaSuscripcion: true,
        fechaInicio: true,
        fechaFinEstimada: true,
        supervisorSecopNombre: true,
        dependenciaSolicitante: { select: { nombre: true } },
        contratista: { select: { nombreORazonSocial: true, identificacion: true } },
        supervisores: { select: { usuario: { select: { nombre: true } } } },
        _count: { select: { documentos: soloContractuales ? { where: { etapa: { not: "PRECONTRACTUAL" } } } : true } },
      },
    });
    for (const e of lote) {
      const pendiente = !e.cerrado && e.etapaActual === "CONTRACTUAL" && !e.fechaInicio;
      filas.push({
        codigoProceso: e.codigoProceso,
        numero: e.numero,
        numeroProcesoSecop: e.numeroProcesoSecop,
        numeroContrato: e.numeroContrato,
        objeto: e.objeto,
        modalidad: ETIQUETA_MODALIDAD[e.modalidadSeleccion],
        tipoContrato: ETIQUETA_TIPO_CONTRATO[e.tipoContrato as TipoContrato] ?? e.tipoContrato,
        dependencia: e.dependenciaSolicitante.nombre,
        contratista: e.contratista?.nombreORazonSocial ?? null,
        identificacionContratista: e.contratista?.identificacion ?? null,
        supervisor: e.supervisores.length
          ? e.supervisores.map((s) => s.usuario.nombre).join(", ")
          : e.supervisorSecopNombre
            ? `${e.supervisorSecopNombre} (SECOP II, sin usuario)`
            : null,
        valor: e.valor !== null ? Number(e.valor) : null,
        etapa: pendiente ? "Pendiente de inicio" : e.cerrado ? "Cerrado" : ETIQUETA_ETAPA[e.etapaActual],
        documentos: e._count.documentos,
        fechaSuscripcion: e.fechaSuscripcion,
        fechaInicio: e.fechaInicio,
        fechaTerminacion: e.fechaFinEstimada,
      });
    }
    if (lote.length < TAMANO_LOTE || filas.length >= TOPE_REGISTROS) break;
  }

  const clausulas: string[] = [];
  if (filtros.q) clausulas.push(`búsqueda "${filtros.q}"`);
  if (filtros.etapa) clausulas.push(`etapa ${filtros.etapa === "TERMINADOS" ? "Terminados" : (ETIQUETA_ETAPA as Record<string, string>)[filtros.etapa] ?? filtros.etapa}`);
  if (filtros.dependenciaId) {
    const dep = await db.dependencia.findUnique({ where: { id: filtros.dependenciaId }, select: { nombre: true } });
    clausulas.push(`dependencia ${dep?.nombre ?? filtros.dependenciaId}`);
  }
  if (filtros.vigencia) clausulas.push(`vigencia ${filtros.vigencia}`);
  const filtrosTexto = clausulas.join("; ");

  await registrarAuditoria({
    tipo: "EXPEDIENTES_EXPORTADOS",
    descripcion: `Exportó ${filas.length} expediente(s) contractual(es) de GECON en ${formato.toUpperCase()}. Filtros: ${filtrosTexto || "ninguno"}.`,
    usuarioId: session.userId,
  });

  const fechaArchivo = new Date().toISOString().slice(0, 10);
  if (formato === "csv") {
    return new NextResponse(csvContratos(filas, filtrosTexto), {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="expedientes-contractuales_${fechaArchivo}.csv"`,
      },
    });
  }
  const buffer = await xlsxContratos(filas, filtrosTexto);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="expedientes-contractuales_${fechaArchivo}.xlsx"`,
    },
  });
}
