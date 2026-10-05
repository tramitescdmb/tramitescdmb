import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verificarSesion as getSession,
  obtenerPermisosUsuario,
  puedeGestionarExpedienteCompleto,
  puedeGestionarEtapasContratacion,
} from "@/lib/permisos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { esNivelAccesoValido } from "@/lib/archivo-central";
import { cambiarNivelAccesoContrato, reabrirExpedienteContractual } from "@/lib/contratacion";

const ACCIONES = new Set(["nivel-acceso", "reabrir"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const volver = new URL(`/contratacion/expedientes/${id}`, req.url);
  volver.hash = "gestion-documental";
  const responder = (clave: "ok" | "error", mensaje: string) => {
    volver.searchParams.set(clave, mensaje);
    return NextResponse.redirect(volver, { status: 303 });
  };

  const form = await req.formData();
  const accion = String(form.get("accion") || "");
  if (!ACCIONES.has(accion)) return responder("error", "Acción no válida.");

  const expediente = await db.expedienteContractual.findUnique({ where: { id }, select: { numero: true, eliminado: true } });
  if (!expediente || expediente.eliminado) return responder("error", "El expediente no existe.");

  const permisos = await obtenerPermisosUsuario(session.userId);
  const autorizado = accion === "reabrir" ? puedeGestionarEtapasContratacion(permisos) : puedeGestionarExpedienteCompleto(permisos, { id });
  if (!autorizado) {
    await registrarAccesoDenegadoAccion(`gestión documental (${accion}) del expediente contractual`, id, session, req.headers);
    return responder(
      "error",
      accion === "reabrir"
        ? "Solo el Jefe de Contratación o un Administrador puede reabrir un expediente cerrado."
        : "No tiene permiso para gestionar este expediente."
    );
  }

  try {
    if (accion === "nivel-acceso") {
      const nivel = form.get("nivelAcceso");
      if (!esNivelAccesoValido(nivel)) return responder("error", "Nivel de acceso no válido.");
      await cambiarNivelAccesoContrato(id, nivel, String(form.get("fundamento") || ""), session.userId);
      return responder("ok", "Nivel de acceso actualizado.");
    }
    await reabrirExpedienteContractual(id, String(form.get("motivo") || ""), session.userId);
    return responder("ok", `${expediente.numero} fue reabierto.`);
  } catch (err) {
    return responder("error", err instanceof Error ? err.message : "No se pudo completar la acción.");
  }
}
