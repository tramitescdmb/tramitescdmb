import { db } from "@/lib/db";
import { cargoDelFirmante, esContratista } from "@/lib/jerarquia-firma";
import { ROLES_PARTICIPANTE, TITULO_BLOQUE_FIRMA, participantesEfectivos, type ParticipanteEntrada } from "@/lib/participantes-visita";
import type { FirmanteDocumento } from "@/components/formatos/DocumentoFormato";

const SELECT_PERSONA = {
  id: true,
  nombre: true,
  denominacionEmpleo: true,
  denominacionComplemento: true,
  denominacionEncargo: true,
  sexo: true,
  rolesContratacion: true,
  contratista: { select: { id: true } },
} as const;

export async function equipoDeVisita(visitaId: string, profesionalId: string) {
  const guardados = await db.participanteVisita.findMany({ where: { visitaId }, select: { usuarioId: true, rol: true }, orderBy: { createdAt: "asc" } });
  const lista = participantesEfectivos(guardados, profesionalId);
  const personas = await db.usuario.findMany({ where: { id: { in: lista.map((p) => p.usuarioId) } }, select: SELECT_PERSONA });
  const porId = new Map(personas.map((p) => [p.id, p]));
  const contratistas = new Set(personas.filter((p) => p.contratista || esContratista(p)).map((p) => p.id));
  return { lista, porId, contratistas };
}

export function firmantesParaDocumento(
  lista: ParticipanteEntrada[],
  porId: Map<string, { nombre: string; denominacionEmpleo: string | null; denominacionComplemento: string | null; denominacionEncargo: boolean; sexo: string | null; rolesContratacion: string[] }>
): FirmanteDocumento[] {
  const orden = (r: ParticipanteEntrada["rol"]) => ROLES_PARTICIPANTE.indexOf(r);
  return [...lista]
    .sort((a, b) => orden(a.rol) - orden(b.rol))
    .map((p) => {
      const persona = porId.get(p.usuarioId);
      return {
        titulo: TITULO_BLOQUE_FIRMA[p.rol],
        nombre: persona?.nombre ?? "",
        cargo: persona ? cargoDelFirmante(persona, "TRAMITES") : "",
        oficina: p.rol === "VISTO_BUENO",
      };
    });
}
