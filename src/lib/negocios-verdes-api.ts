import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeConfigurarNV, puedeGestionarNV } from "@/lib/negocios-verdes-permisos";
import { datosPeticion, registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import type { AccionAuditoriaDoc } from "@/generated/prisma/client";

type Requisito = "CREAR" | "ACTUALIZAR" | "ELIMINAR" | "CONFIGURAR";

/** Sesión y permiso para una acción del panel de Negocios Verdes. Devuelve la respuesta de error si no procede. */
export async function exigirPermisoNV(requisito: Requisito) {
  const session = await verificarSesion();
  if (!session) return { error: NextResponse.json({ error: "Sesión vencida. Vuelva a ingresar." }, { status: 401 }) } as const;
  const permisos = await obtenerPermisosUsuario(session.userId);
  const ok = requisito === "CONFIGURAR" ? puedeConfigurarNV(permisos) : puedeGestionarNV(permisos, requisito);
  if (!ok) return { error: NextResponse.json({ error: "Su perfil no permite esta acción en Negocios Verdes." }, { status: 403 }) } as const;
  return { session, permisos } as const;
}

export async function auditarNV(datos: { entidad: string; entidadId: string; accion: AccionAuditoriaDoc; usuarioId: string; detalle: string }) {
  const { ip, userAgent } = datosPeticion(await headers());
  await registrarAuditoriaDoc({ ...datos, ip, userAgent });
}
