import { db } from "@/lib/db";
import type { PermisosUsuario } from "@/lib/permisos";
import { listarBuzon } from "@/lib/solicitudes-firma";
import { hoyColombia } from "@/lib/contratacion-panel";
import { CODIGOS_FORMATO_POR_PERIODOS, calcularPeriodosInforme, etiquetaRangoPeriodo } from "@/lib/periodos-informe";

const MS_DIA = 24 * 60 * 60 * 1000;

export type EstadoPeriodo = "radicado" | "pendiente" | "en-curso" | "futuro";

export type ContratoLanding = {
  id: string;
  numero: string;
  numeroContrato: string | null;
  objeto: string;
  etapa: "PRECONTRACTUAL" | "CONTRACTUAL" | "POSTCONTRACTUAL";
  relacion: "CONTRATISTA" | "SUPERVISOR";
  contratista: string | null;
  inicio: Date | null;
  fin: Date | null;
  avance: number | null;
  diasRestantes: number | null;
  periodos: { clave: string; numero: number; rango: string; estado: EstadoPeriodo; diasDeRetraso: number; link: string }[];
  firmas: { id: string; documento: string; rol: string; puedeActuar: boolean }[];
  siguiente: { texto: string; detalle: string; link: string; urgente: boolean } | null;
};

export async function obtenerContratosLanding(userId: string, permisos: PermisosUsuario): Promise<ContratoLanding[]> {
  const supervisa = [...permisos.supervisaExpedientes];
  if (!permisos.contratistaId && supervisa.length === 0) return [];
  const hoy = hoyColombia();

  const [expedientes, buzon] = await Promise.all([
    db.expedienteContractual.findMany({
      where: {
        eliminado: false,
        cerrado: false,
        OR: [
          ...(permisos.contratistaId ? [{ contratistaId: permisos.contratistaId, etapaActual: { not: "PRECONTRACTUAL" as const } }] : []),
          ...(supervisa.length ? [{ id: { in: supervisa } }] : []),
        ],
      },
      orderBy: [{ fechaFinEstimada: "asc" }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        numero: true,
        numeroContrato: true,
        objeto: true,
        etapaActual: true,
        contratistaId: true,
        fechaInicio: true,
        fechaFinEstimada: true,
        contratista: { select: { nombreORazonSocial: true } },
        documentos: {
          where: { periodoMes: { not: null }, requisito: { codigoFormato: { in: CODIGOS_FORMATO_POR_PERIODOS } } },
          select: { periodoMes: true },
        },
      },
    }),
    listarBuzon(userId, "documentoContrato"),
  ]);

  return expedientes.map((e) => {
    const base = `/contratacion/expedientes/${e.id}`;
    const radicados = new Set(e.documentos.map((d) => d.periodoMes!));
    const periodos = calcularPeriodosInforme(e.fechaInicio, e.fechaFinEstimada).map((p, i) => {
      const estado: EstadoPeriodo = radicados.has(p.clave) ? "radicado" : p.radicaDesde <= hoy ? "pendiente" : p.desde <= hoy ? "en-curso" : "futuro";
      return {
        clave: p.clave,
        numero: i + 1,
        rango: etiquetaRangoPeriodo(p),
        estado,
        diasDeRetraso: estado === "pendiente" ? Math.floor((hoy.getTime() - p.radicaDesde.getTime()) / MS_DIA) : 0,
        link: `${base}?periodo=${p.clave}#periodo-${p.clave}`,
      };
    });

    let avance: number | null = null;
    let diasRestantes: number | null = null;
    if (e.fechaInicio && e.fechaFinEstimada) {
      const total = Math.max(1, e.fechaFinEstimada.getTime() - e.fechaInicio.getTime());
      avance = Math.min(100, Math.max(0, Math.round(((hoy.getTime() - e.fechaInicio.getTime()) / total) * 100)));
      diasRestantes = Math.ceil((e.fechaFinEstimada.getTime() - hoy.getTime()) / MS_DIA);
    }

    const firmas = buzon
      .filter((s) => s.documentoContrato?.expedienteId === e.id)
      .map((s) => ({ id: s.id, documento: s.documentoContrato?.nombre ?? "Documento", rol: s.rol, puedeActuar: s.puedeActuar }));

    const firmaLista = firmas.find((f) => f.puedeActuar);
    const pendiente = periodos.find((p) => p.estado === "pendiente");
    const siguiente = firmaLista
      ? {
          texto: firmaLista.rol === "VISTO_BUENO" ? "Dar visto bueno" : "Firmar documento",
          detalle: firmaLista.documento,
          link: `/contratacion/firmar/${firmaLista.id}`,
          urgente: true,
        }
      : pendiente
        ? {
            texto: `Radicar informe N.° ${pendiente.numero}`,
            detalle: pendiente.diasDeRetraso > 0 ? `${pendiente.rango} · ${pendiente.diasDeRetraso} día(s) de retraso` : pendiente.rango,
            link: pendiente.link,
            urgente: true,
          }
        : null;

    return {
      id: e.id,
      numero: e.numero,
      numeroContrato: e.numeroContrato,
      objeto: e.objeto,
      etapa: e.etapaActual,
      relacion: permisos.contratistaId && e.contratistaId === permisos.contratistaId ? "CONTRATISTA" : "SUPERVISOR",
      contratista: e.contratista?.nombreORazonSocial ?? null,
      inicio: e.fechaInicio,
      fin: e.fechaFinEstimada,
      avance,
      diasRestantes,
      periodos,
      firmas,
      siguiente,
    };
  });
}
