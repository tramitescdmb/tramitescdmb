import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarTramite } from "@/lib/permisos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { esNivelAccesoValido } from "@/lib/archivo-central";
import {
  cambiarNivelAccesoTramite,
  cerrarExpedienteTramite,
  reabrirExpedienteTramite,
  reclasificarTrdTramite,
} from "@/lib/gestion-documental-tramites";

const ACCIONES = new Set(["trd", "nivel-acceso", "cerrar", "reabrir"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const volver = new URL(`/expedientes/${id}`, req.url);
  volver.hash = "gestion-documental";
  const responder = (clave: "ok" | "error", mensaje: string) => {
    volver.searchParams.set(clave, mensaje);
    return NextResponse.redirect(volver, { status: 303 });
  };

  const form = await req.formData();
  const accion = String(form.get("accion") || req.nextUrl.searchParams.get("accion") || "");
  if (!ACCIONES.has(accion)) return responder("error", "Acción no válida.");

  const expediente = await db.expediente.findUnique({ where: { id }, select: { numero: true, tramiteTipoId: true } });
  if (!expediente) return responder("error", "El expediente no existe.");

  const permisos = await obtenerPermisosUsuario(session.userId);
  const autorizado = accion === "reabrir" ? permisos.esAdmin : puedeEditarTramite(permisos, expediente.tramiteTipoId);
  if (!autorizado) {
    await registrarAccesoDenegadoAccion(`gestión documental (${accion}) del expediente de trámite`, id, session, req.headers);
    return responder(
      "error",
      accion === "reabrir" ? "Solo un administrador puede reabrir un expediente cerrado." : "No tiene permiso de edición sobre este trámite."
    );
  }

  try {
    if (accion === "trd") {
      const subserieId = String(form.get("subserieId") || "");
      if (!subserieId) return responder("error", "Elija la dependencia, la serie y la subserie.");
      const nueva = await reclasificarTrdTramite(id, subserieId, String(form.get("motivo") || ""), session.userId);
      return responder("ok", `Clasificación TRD actualizada: ${nueva.etiqueta}.`);
    }
    if (accion === "nivel-acceso") {
      const nivel = form.get("nivelAcceso");
      if (!esNivelAccesoValido(nivel)) return responder("error", "Nivel de acceso no válido.");
      await cambiarNivelAccesoTramite(id, nivel, String(form.get("fundamento") || ""), session.userId);
      return responder("ok", "Nivel de acceso actualizado.");
    }
    if (accion === "cerrar") {
      await cerrarExpedienteTramite(id, session.userId);
      return responder("ok", `${expediente.numero} quedó cerrado y archivado en el SGDEA.`);
    }
    await reabrirExpedienteTramite(id, String(form.get("motivo") || ""), session.userId);
    return responder("ok", `${expediente.numero} fue reabierto.`);
  } catch (err) {
    return responder("error", err instanceof Error ? err.message : "No se pudo completar la acción.");
  }
}
