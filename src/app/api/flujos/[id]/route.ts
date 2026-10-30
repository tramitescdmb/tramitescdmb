import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import type { AccionVencimientoPaso, AsignacionPaso, TipoPasoFlujo } from "@prisma/client";

const ACCIONES_VENCIMIENTO: AccionVencimientoPaso[] = ["NINGUNA", "AVISAR", "AVANZAR"];
const PESTANA_DE_ACCION: Record<string, string> = {
  editar: "datos",
  accesos: "datos",
  "agregar-paso": "pasos",
  "editar-paso": "pasos",
  "eliminar-paso": "pasos",
  "mover-paso": "pasos",
  "agregar-transicion": "pasos",
  "eliminar-transicion": "pasos",
};
import { db } from "@/lib/db";
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
} from "@/lib/flujos";
import {
  aplicaAFormulario,
  ASIGNACIONES_DE_MODULO,
  moduloDeAmbito,
  puedeAdministrarFlujosModulo,
  RUTA_FLUJOS,
  TIPOS_PASO_DE_MODULO,
} from "@/lib/flujos-modulos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const flujoActual = await db.flujoTrabajo.findUnique({ where: { id }, select: { ambito: true } });
  if (!flujoActual) return NextResponse.json({ error: "El flujo no existe." }, { status: 404 });
  const modulo = moduloDeAmbito(flujoActual.ambito);
  const TIPOS_PASO: TipoPasoFlujo[] = TIPOS_PASO_DE_MODULO[modulo];
  const ASIGNACIONES: AsignacionPaso[] = ASIGNACIONES_DE_MODULO[modulo];
  const detalle = new URL(`${RUTA_FLUJOS[modulo]}/${id}`, req.url);
  const lista = new URL(RUTA_FLUJOS[modulo], req.url);
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujosModulo(permisos, modulo)) {
    await registrarAccesoDenegadoAccion("Administrar flujos de trabajo", id, session, await headers());
    detalle.searchParams.set("error", "No tiene permiso para administrar flujos de trabajo.");
    return NextResponse.redirect(detalle, { status: 303 });
  }

  const form = await req.formData();
  const accion = String(form.get("accion") || "");
  const pestana = PESTANA_DE_ACCION[accion];
  if (pestana) detalle.searchParams.set("pestana", pestana);
  const num =(v: FormDataEntryValue | null) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  try {
    switch (accion) {
      case "editar": {
        await actualizarFlujo(id, {
          nombre: String(form.get("nombre") || ""),
          descripcion: String(form.get("descripcion") || ""),
          ...aplicaAFormulario(String(form.get("aplicaA") || ""), modulo),
          inicioAutomatico: form.get("inicioAutomatico") === "on",
        });
        detalle.searchParams.set("ok", "Flujo actualizado.");
        return NextResponse.redirect(detalle, { status: 303 });
      }
      case "activar":
      case "desactivar": {
        await cambiarEstadoFlujo(id, accion === "activar");
        detalle.searchParams.set("ok", accion === "activar" ? "Flujo activado como versión vigente; las demás versiones quedaron inactivas." : "Flujo desactivado.");
        return NextResponse.redirect(detalle, { status: 303 });
      }
      case "eliminar": {
        await eliminarFlujo(id);
        lista.searchParams.set("ok", "Flujo eliminado.");
        return NextResponse.redirect(lista, { status: 303 });
      }
      case "nueva-version": {
        const version = await duplicarFlujo(id, session.userId, true);
        return NextResponse.redirect(
          new URL(`${RUTA_FLUJOS[modulo]}/${version.id}?ok=${encodeURIComponent(`Versión ${version.version} creada (queda inactiva hasta que la active)`)}`, req.url),
          { status: 303 },
        );
      }
      case "duplicar": {
        const copia = await duplicarFlujo(id, session.userId);
        return NextResponse.redirect(new URL(`${RUTA_FLUJOS[modulo]}/${copia.id}?ok=Copia+creada+(queda+inactiva)`, req.url), { status: 303 });
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
          alVencer: ACCIONES_VENCIMIENTO.includes(String(form.get("alVencer")) as AccionVencimientoPaso) ? (String(form.get("alVencer")) as AccionVencimientoPaso) : undefined,
          salidaVencimiento: String(form.get("salidaVencimiento") || ""),
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
