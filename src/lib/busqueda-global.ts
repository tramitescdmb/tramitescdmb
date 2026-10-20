import { db } from "@/lib/db";
import {
  puedeAccederContratacion,
  puedeAccederCorrespondencia,
  puedeAccederSolicitantes,
  type PermisosUsuario,
} from "@/lib/permisos";
import { construirWhereExpedientes } from "@/lib/expedientes";
import { construirWhereExpedienteContractual } from "@/lib/contratacion";
import { construirWhereCorrespondencia } from "@/lib/correspondencia-data";

export type ResultadoBusqueda = { href: string; titulo: string; detalle?: string };
export type GrupoBusqueda = { modulo: string; titulo: string; verTodos: string; resultados: ResultadoBusqueda[] };

const POR_GRUPO = 5;

export async function buscarGlobal(consulta: string, permisos: PermisosUsuario): Promise<GrupoBusqueda[]> {
  const q = consulta.trim();
  if (q.length < 2) return [];
  const qs = encodeURIComponent(q);

  const tareas: Promise<GrupoBusqueda | null>[] = [];

  if (permisos.modulos.has("TRAMITES")) {
    tareas.push(
      db.expediente
        .findMany({
          where: construirWhereExpedientes({ tramiteIdsPermitidos: permisos.esAdmin ? null : Array.from(permisos.tramites.keys()), busqueda: q, rango: null }),
          orderBy: { fechaUltimoMovimiento: "desc" },
          take: POR_GRUPO,
          select: { id: true, numero: true, solicitanteNombre: true, tramiteTipo: { select: { nombre: true } } },
        })
        .then((filas) => ({
          modulo: "TRAMITES",
          titulo: "Expedientes de trámite",
          verTodos: `/expedientes?q=${qs}`,
          resultados: filas.map((e) => ({ href: `/expedientes/${e.id}`, titulo: e.numero, detalle: [e.solicitanteNombre, e.tramiteTipo.nombre].filter(Boolean).join(" · ") })),
        }))
    );
  }

  if (puedeAccederSolicitantes(permisos)) {
    tareas.push(
      db.solicitante
        .findMany({
          where: {
            OR: [
              { identificacion: { contains: q, mode: "insensitive" } },
              { nombres: { contains: q, mode: "insensitive" } },
              { apellidos: { contains: q, mode: "insensitive" } },
              { razonSocial: { contains: q, mode: "insensitive" } },
            ],
          },
          take: POR_GRUPO,
          select: { id: true, identificacion: true, nombres: true, apellidos: true, razonSocial: true },
        })
        .then((filas) => ({
          modulo: "SOLICITANTES",
          titulo: "Solicitantes",
          verTodos: `/solicitantes?q=${qs}`,
          resultados: filas.map((s) => ({
            href: `/solicitantes/${s.id}`,
            titulo: s.razonSocial || [s.nombres, s.apellidos].filter(Boolean).join(" ") || s.identificacion,
            detalle: s.identificacion,
          })),
        }))
    );
  }

  if (puedeAccederContratacion(permisos)) {
    tareas.push(
      db.expedienteContractual
        .findMany({
          where: construirWhereExpedienteContractual({ q }, permisos),
          orderBy: { createdAt: "desc" },
          take: POR_GRUPO,
          select: { id: true, numero: true, numeroContrato: true, objeto: true, contratista: { select: { nombreORazonSocial: true } } },
        })
        .then((filas) => ({
          modulo: "GECON",
          titulo: "Contratos (GECON)",
          verTodos: `/contratacion/expedientes?q=${qs}`,
          resultados: filas.map((c) => ({
            href: `/contratacion/expedientes/${c.id}`,
            titulo: c.numeroContrato ? `${c.numero} · Contrato ${c.numeroContrato}` : c.numero,
            detalle: [c.contratista?.nombreORazonSocial, c.objeto].filter(Boolean).join(" · "),
          })),
        }))
    );
  }

  if (puedeAccederCorrespondencia(permisos)) {
    tareas.push(
      db.comunicacion
        .findMany({
          where: construirWhereCorrespondencia({ q }),
          orderBy: { fechaRadicacion: "desc" },
          take: POR_GRUPO,
          select: { id: true, radicado: true, asunto: true, terceroNombre: true },
        })
        .then((filas) => ({
          modulo: "SGDEA",
          titulo: "Radicados (SGDEA)",
          verTodos: `/correspondencia?q=${qs}`,
          resultados: filas.map((c) => ({ href: `/correspondencia/${c.id}`, titulo: c.radicado, detalle: [c.terceroNombre, c.asunto].filter(Boolean).join(" · ") })),
        }))
    );
  }

  const grupos = await Promise.all(tareas);
  return grupos.filter((g): g is GrupoBusqueda => g !== null && g.resultados.length > 0);
}
