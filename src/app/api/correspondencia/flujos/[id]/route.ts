import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import type { AsignacionPaso, TipoComunicacion, TipoPasoFlujo } from "@prisma/client";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";
import {
  actualizarFlujo,
  cambiarEstadoFlujo,
  eliminarFlujo,
  agregarPaso,
  actualizarPaso,
  eliminarPaso,
  moverPaso,
  agregarTransicion,
  eliminarTransicion,
  duplicarFlujo,
  guardarDependenciasOperadoras,
  puedeAdministrarFlujos,
} from "@/lib/flujos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

const TIPOS: TipoComunicacion[] = ["RECIBIDA", "ENVIADA", "INTERNA"];
const TIPOS_PASO: TipoPasoFlujo[] = ["TAREA", "REVISION", "DECISION", "FIN"];
const ASIGNACIONES: AsignacionPaso[] = [
  "DEPENDENCIA_COMUNICACION",
  "DEPENDENCIA_FIJA",
  "CARGO",
  "RADICADOR",
  "RESPONSABLE_PASO_ANTERIOR",
  "MANUAL",
];

/**
 * Todas las operaciones sobre un flujo, sus pasos y sus transiciones, por `accion`:
 * editar | activar | desactivar | eliminar | agregar-paso | editar-paso | eliminar-paso
 * | mover-paso | agregar-transicion | eliminar-transicion. Solo administrador de archivo.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const detalle = new URL(`/correspondencia/admin/flujos/${id}`, req.url);
  const lista = new URL("/correspondencia/admin/flujos", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujos(permisos)) {
    await registrarAccesoDenegadoAccion("Administrar flujos de trabajo", id, session, await headers());
    detalle.searchParams.set("error", "No tiene permiso para administrar flujos de trabajo.");
    return NextResponse.redirect(detalle, { status: 303 });
  }

  const form = await req.formData();
  const accion = String(form.get("accion") || "");
  const num = (v: FormDataEntryValue | null) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  try {
    switch (accion) {
      case "editar": {
        const aplicaARaw = String(form.get("aplicaA") || "");
        await actualizarFlujo(id, {
          nombre: String(form.get("nombre") || ""),
          descripcion: String(form.get("descripcion") || ""),
          aplicaA: TIPOS.includes(aplicaARaw as TipoComunicacion) ? (aplicaARaw as TipoComunicacion) : null,
        });
        detalle.searchParams.set("ok", "Flujo actualizado.");
        return NextResponse.redirect(detalle, { status: 303 });
      }
      case "activar":
      case "desactivar": {
        await cambiarEstadoFlujo(id, accion === "activar");
        detalle.searchParams.set("ok", accion === "activar" ? "Flujo activado." : "Flujo desactivado.");
        return NextResponse.redirect(detalle, { status: 303 });
      }
      case "eliminar": {
        await eliminarFlujo(id);
        lista.searchParams.set("ok", "Flujo eliminado.");
        return NextResponse.redirect(lista, { status: 303 });
      }
      case "duplicar": {
        const copia = await duplicarFlujo(id, session.userId);
        return NextResponse.redirect(new URL(`/correspondencia/admin/flujos/${copia.id}?ok=Copia+creada+(queda+inactiva)`, req.url), { status: 303 });
      }
      case "accesos": {
        await guardarDependenciasOperadoras(id, form.getAll("dependenciaId").map(String));
        detalle.searchParams.set("ok", "Acceso al flujo actualizado.");
        return NextResponse.redirect(detalle, { status: 303 });
      }
      case "agregar-paso": {
        const tipoRaw = String(form.get("tipo") || "TAREA");
        await agregarPaso(id, {
          nombre: String(form.get("nombre") || ""),
          tipo: TIPOS_PASO.includes(tipoRaw as TipoPasoFlujo) ? (tipoRaw as TipoPasoFlujo) : "TAREA",
        });
        detalle.searchParams.set("ok", "Paso agregado.");
        return NextResponse.redirect(detalle, { status: 303 });
      }
      case "editar-paso": {
        const tipoRaw = String(form.get("tipo") || "");
        const asigRaw = String(form.get("asignacion") || "");
        await actualizarPaso(String(form.get("pasoId") || ""), {
          nombre: String(form.get("nombre") || ""),
          instrucciones: String(form.get("instrucciones") || ""),
          tipo: TIPOS_PASO.includes(tipoRaw as TipoPasoFlujo) ? (tipoRaw as TipoPasoFlujo) : undefined,
          asignacion: ASIGNACIONES.includes(asigRaw as AsignacionPaso) ? (asigRaw as AsignacionPaso) : undefined,
          dependenciaId: String(form.get("dependenciaId") || ""),
          cargoClave: String(form.get("cargoClave") || ""),
          slaDiasHabiles: num(form.get("slaDiasHabiles")),
        });
        detalle.searchParams.set("ok", "Paso actualizado.");
        return NextResponse.redirect(detalle, { status: 303 });
      }
      case "eliminar-paso": {
        await eliminarPaso(String(form.get("pasoId") || ""));
        detalle.searchParams.set("ok", "Paso eliminado.");
        return NextResponse.redirect(detalle, { status: 303 });
      }
      case "mover-paso": {
        await moverPaso(String(form.get("pasoId") || ""), String(form.get("direccion") || "abajo") === "arriba" ? "arriba" : "abajo");
        return NextResponse.redirect(detalle, { status: 303 });
      }
      case "agregar-transicion": {
        await agregarTransicion(
          String(form.get("desdePasoId") || ""),
          String(form.get("haciaPasoId") || ""),
          String(form.get("etiqueta") || ""),
        );
        detalle.searchParams.set("ok", "Transición agregada.");
        return NextResponse.redirect(detalle, { status: 303 });
      }
      case "eliminar-transicion": {
        await eliminarTransicion(String(form.get("transicionId") || ""));
        detalle.searchParams.set("ok", "Transición eliminada.");
        return NextResponse.redirect(detalle, { status: 303 });
      }
      default:
        detalle.searchParams.set("error", "Acción no reconocida.");
        return NextResponse.redirect(detalle, { status: 303 });
    }
  } catch (err) {
    detalle.searchParams.set("error", err instanceof Error ? err.message : "No se pudo completar la acción.");
    return NextResponse.redirect(detalle, { status: 303 });
  }
}
