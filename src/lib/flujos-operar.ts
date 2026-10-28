import { db } from "@/lib/db";
import {
  avanzarInstancia,
  cancelarInstancia,
  iniciarInstanciaEnObjeto,
  reasignarPasoManual,
  type AmbitoExpedienteFlujo,
  type ContextoOperador,
  type UsuarioFlujo,
} from "@/lib/flujos";

const CAMPO: Record<AmbitoExpedienteFlujo, "expedienteDocumentalId" | "expedienteContractualId" | "expedienteTramiteId"> = {
  EXPEDIENTE: "expedienteDocumentalId",
  CONTRATO: "expedienteContractualId",
  TRAMITE: "expedienteTramiteId",
};

export async function operarFlujoDeObjeto({
  ambito,
  objetoId,
  form,
  usuario,
  puedeIniciarOCancelar,
  ip,
}: {
  ambito: AmbitoExpedienteFlujo;
  objetoId: string;
  form: FormData;
  usuario: UsuarioFlujo;
  puedeIniciarOCancelar: boolean;
  ip: string | null;
}): Promise<{ ok: string } | { error: string }> {
  const accion = String(form.get("accion") || "");
  const instanciaId = String(form.get("instanciaId") || "");
  if ((accion === "iniciar" || accion === "cancelar") && !puedeIniciarOCancelar) return { error: "No tiene permiso para esta acción del flujo de trabajo." };
  if (accion === "reasignar" && !usuario.esAdministrador) return { error: "Solo el administrador del módulo reasigna pasos." };
  if (instanciaId && !(await db.instanciaFlujo.findFirst({ where: { id: instanciaId, [CAMPO[ambito]]: objetoId }, select: { id: true } }))) {
    return { error: "El flujo no corresponde a este expediente." };
  }
  const ctx: ContextoOperador = { esAdministrador: usuario.esAdministrador, dependenciaId: usuario.dependenciaId };
  try {
    if (accion === "iniciar") {
      await iniciarInstanciaEnObjeto(ambito, objetoId, String(form.get("flujoId") || ""), usuario.usuarioId, ip, ctx);
      return { ok: "Flujo iniciado." };
    }
    if (accion === "avanzar") {
      await avanzarInstancia(
        instanciaId,
        String(form.get("transicionId") || ""),
        usuario,
        String(form.get("comentario") || "") || null,
        ip,
        usuario.esAdministrador ? ctx : undefined,
        String(form.get("asignarAId") || "") || null,
      );
      return { ok: "Paso completado." };
    }
    if (accion === "cancelar") {
      await cancelarInstancia(instanciaId, usuario.usuarioId, String(form.get("motivo") || ""), ip, ctx);
      return { ok: "Flujo cancelado." };
    }
    if (accion === "reasignar") {
      await reasignarPasoManual(instanciaId, String(form.get("asignarAId") || ""), usuario.usuarioId, ip);
      return { ok: "Paso reasignado." };
    }
    return { error: "Acción no reconocida." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo completar la acción." };
  }
}
