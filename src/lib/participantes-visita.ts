import type { CalidadFirma, RolFirmante, RolParticipanteVisita } from "@prisma/client";

export const ROLES_PARTICIPANTE: RolParticipanteVisita[] = ["ELABORA", "REVISA_TECNICO", "REVISA_JURIDICO", "VISTO_BUENO", "APRUEBA"];

export const ETIQUETA_ROL_PARTICIPANTE: Record<RolParticipanteVisita, string> = {
  ELABORA: "Elabora (realiza la visita)",
  REVISA_TECNICO: "Revisa aspectos técnicos",
  REVISA_JURIDICO: "Revisa aspectos jurídicos",
  VISTO_BUENO: "Visto bueno de la coordinación",
  APRUEBA: "Aprueba (firma principal)",
};

export const TITULO_BLOQUE_FIRMA: Record<RolParticipanteVisita, string> = {
  ELABORA: "Elaboró",
  REVISA_TECNICO: "Revisó aspectos técnicos",
  REVISA_JURIDICO: "Revisó aspectos jurídicos",
  VISTO_BUENO: "Visto bueno de la coordinación",
  APRUEBA: "Aprobó",
};

export function esRolParticipante(v: unknown): v is RolParticipanteVisita {
  return typeof v === "string" && (ROLES_PARTICIPANTE as string[]).includes(v);
}

export const MAX_FIRMAS_CONCEPTO = 4;

export type ParticipanteEntrada = { usuarioId: string; rol: RolParticipanteVisita };

export function validarParticipantes(
  lista: ParticipanteEntrada[],
  opciones: { permitidos: Set<string>; contratistas: Set<string>; nombres: Map<string, string> }
): string | null {
  if (lista.length === 0) return "Indique al menos una persona que elabora el concepto.";
  if (new Set(lista.map((p) => p.usuarioId)).size !== lista.length) return "Una misma persona no puede tener dos roles en la visita.";
  if (!lista.some((p) => p.rol === "ELABORA")) return "Debe haber al menos una persona con el rol «Elabora».";
  if (lista.filter((p) => p.rol === "APRUEBA").length > 1) return "Solo una persona puede aprobar el concepto.";
  if (lista.filter((p) => p.rol !== "VISTO_BUENO").length > MAX_FIRMAS_CONCEPTO) return `Máximo ${MAX_FIRMAS_CONCEPTO} personas firman el concepto (sin contar los vistos buenos).`;
  for (const p of lista) {
    const nombre = opciones.nombres.get(p.usuarioId) ?? "Una de las personas";
    if (!opciones.permitidos.has(p.usuarioId)) return `${nombre} no existe o está inactiva.`;
    if (p.rol === "APRUEBA" && opciones.contratistas.has(p.usuarioId)) return `${nombre} es contratista: no puede aprobar (firma principal) el concepto.`;
  }
  return null;
}

export type FirmanteConcepto = { usuarioId: string; rol: RolFirmante; calidad: CalidadFirma | null };

export function firmantesDeParticipantes(lista: ParticipanteEntrada[], contratistas: Set<string>): FirmanteConcepto[] {
  const hayAprobador = lista.some((p) => p.rol === "APRUEBA");
  return lista.map((p) => {
    switch (p.rol) {
      case "APRUEBA":
        return { usuarioId: p.usuarioId, rol: "FIRMA", calidad: "PRINCIPAL" };
      case "ELABORA":
        return { usuarioId: p.usuarioId, rol: "FIRMA", calidad: hayAprobador || contratistas.has(p.usuarioId) ? "PROYECTO" : "PRINCIPAL" };
      case "REVISA_TECNICO":
      case "REVISA_JURIDICO":
        return { usuarioId: p.usuarioId, rol: "FIRMA", calidad: "REVISO" };
      case "VISTO_BUENO":
        return { usuarioId: p.usuarioId, rol: "VISTO_BUENO", calidad: null };
    }
  });
}

export function participantesEfectivos<T extends { usuarioId: string; rol: RolParticipanteVisita }>(guardados: T[], profesionalId: string): ParticipanteEntrada[] {
  return guardados.length > 0 ? guardados.map((p) => ({ usuarioId: p.usuarioId, rol: p.rol })) : [{ usuarioId: profesionalId, rol: "ELABORA" }];
}
