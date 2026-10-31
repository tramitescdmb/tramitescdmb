import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { cifrarSecreto } from "@/lib/cifrado-config";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMINIO = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function texto(form: FormData, campo: string) {
  return String(form.get(campo) ?? "").trim();
}

function fecha(valor: string): Date | null | "invalida" {
  if (!valor) return null;
  const d = new Date(`${valor}T23:59:59-05:00`);
  return Number.isNaN(d.getTime()) ? "invalida" : d;
}

function datosCuenta(form: FormData): { error: string } | { nombre: string; tenantId: string; clientId: string; remitente: string } {
  const nombre = texto(form, "nombre");
  const tenantId = texto(form, "tenantId").toLowerCase();
  const clientId = texto(form, "clientId").toLowerCase();
  const remitente = texto(form, "remitente").toLowerCase();
  if (!nombre) return { error: "Indique un nombre para la cuenta." };
  if (!GUID.test(tenantId) && !DOMINIO.test(tenantId)) return { error: "El identificador del directorio (tenant) debe ser un GUID o un dominio del tenant." };
  if (!GUID.test(clientId)) return { error: "El identificador de la aplicación (cliente) debe ser un GUID." };
  if (!CORREO.test(remitente)) return { error: "El buzón remitente no es un correo válido." };
  return { nombre, tenantId, clientId, remitente };
}

function datosClave(form: FormData): { error: string } | { cifrado: string; final: string; vence: Date | null; descripcion: string | null } {
  const secreto = texto(form, "secreto");
  if (secreto.length < 8) return { error: "Pegue el valor del secreto de cliente (no el identificador del secreto)." };
  if (GUID.test(secreto)) return { error: "Eso parece el identificador del secreto; se necesita su valor, que Microsoft muestra una sola vez al crearlo." };
  const vence = fecha(texto(form, "vence"));
  if (vence === "invalida") return { error: "La fecha de vencimiento no es válida." };
  return { cifrado: cifrarSecreto(secreto), final: secreto.slice(-4), vence, descripcion: texto(form, "descripcion") || null };
}

export async function POST(req: NextRequest) {
  const volver = new URL("/admin/correo", req.url);
  const salir = (tipo: "ok" | "error", mensaje: string) => {
    volver.searchParams.set(tipo, mensaje);
    return NextResponse.redirect(volver, { status: 303 });
  };
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return salir("error", "Solo el administrador del sistema configura el correo.");

  const form = await req.formData();
  const accion = texto(form, "accion");
  const cuentaId = texto(form, "cuentaId");
  const claveId = texto(form, "claveId");
  const auditar = (descripcion: string) => registrarAuditoria({ tipo: "CONFIGURACION_ACTUALIZADA", descripcion: `${session.nombre} ${descripcion}`, usuarioId: session.userId });

  if (accion === "crear") {
    const cuenta = datosCuenta(form);
    if ("error" in cuenta) return salir("error", cuenta.error);
    const clave = datosClave(form);
    if ("error" in clave) return salir("error", clave.error);
    const hayPredeterminada = (await db.cuentaCorreo.count({ where: { predeterminada: true } })) > 0;
    await db.cuentaCorreo.create({ data: { ...cuenta, predeterminada: !hayPredeterminada, creadoPorId: session.userId, claves: { create: clave } } });
    await auditar(`registró la cuenta de correo «${cuenta.nombre}» (${cuenta.remitente}).`);
    return salir("ok", `Cuenta «${cuenta.nombre}» registrada.`);
  }

  const cuenta = cuentaId ? await db.cuentaCorreo.findUnique({ where: { id: cuentaId } }) : null;
  if (!cuenta) return salir("error", "La cuenta de correo no existe.");

  if (accion === "editar") {
    const datos = datosCuenta(form);
    if ("error" in datos) return salir("error", datos.error);
    await db.cuentaCorreo.update({ where: { id: cuenta.id }, data: datos });
    await auditar(`actualizó la cuenta de correo «${datos.nombre}» (${datos.remitente}).`);
    return salir("ok", "Cuenta actualizada.");
  }

  if (accion === "predeterminar") {
    await db.$transaction([
      db.cuentaCorreo.updateMany({ where: { predeterminada: true }, data: { predeterminada: false } }),
      db.cuentaCorreo.update({ where: { id: cuenta.id }, data: { predeterminada: true, activa: true } }),
    ]);
    await auditar(`dejó «${cuenta.nombre}» como cuenta de correo predeterminada.`);
    return salir("ok", `«${cuenta.nombre}» es ahora la cuenta predeterminada.`);
  }

  if (accion === "activar" || accion === "desactivar") {
    const activa = accion === "activar";
    await db.cuentaCorreo.update({ where: { id: cuenta.id }, data: { activa, ...(activa ? {} : { predeterminada: false }) } });
    await auditar(`${activa ? "activó" : "desactivó"} la cuenta de correo «${cuenta.nombre}».`);
    return salir("ok", `Cuenta ${activa ? "activada" : "desactivada"}.`);
  }

  if (accion === "eliminar") {
    await db.cuentaCorreo.delete({ where: { id: cuenta.id } });
    await auditar(`eliminó la cuenta de correo «${cuenta.nombre}» (${cuenta.remitente}).`);
    return salir("ok", "Cuenta eliminada.");
  }

  if (accion === "agregar_clave") {
    const clave = datosClave(form);
    if ("error" in clave) return salir("error", clave.error);
    await db.claveCorreo.create({ data: { ...clave, cuentaId: cuenta.id } });
    await auditar(`agregó una clave (…${clave.final}) a la cuenta de correo «${cuenta.nombre}».`);
    return salir("ok", "Clave agregada.");
  }

  const clave = claveId ? await db.claveCorreo.findFirst({ where: { id: claveId, cuentaId: cuenta.id } }) : null;
  if (!clave) return salir("error", "La clave no existe.");

  if (accion === "activar_clave" || accion === "desactivar_clave") {
    const activa = accion === "activar_clave";
    await db.claveCorreo.update({ where: { id: clave.id }, data: { activa } });
    await auditar(`${activa ? "activó" : "desactivó"} la clave …${clave.final} de la cuenta de correo «${cuenta.nombre}».`);
    return salir("ok", `Clave ${activa ? "activada" : "desactivada"}.`);
  }

  if (accion === "eliminar_clave") {
    await db.claveCorreo.delete({ where: { id: clave.id } });
    await auditar(`eliminó la clave …${clave.final} de la cuenta de correo «${cuenta.nombre}».`);
    return salir("ok", "Clave eliminada.");
  }

  return salir("error", "Acción no reconocida.");
}
