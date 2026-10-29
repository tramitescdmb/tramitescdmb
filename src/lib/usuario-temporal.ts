import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { validarPoliticaPassword } from "@/lib/password-policy";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { asignarRolBase } from "@/lib/perfiles";
import { registrarAuditoria } from "@/lib/auditoria";
import { consultaDirectorioDisponible, consultarDirectorioPorDocumento } from "@/lib/directorio-activo";
import { crearUsuarioDeDominio } from "@/lib/directorio-usuarios";

const GRUPOS = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "#$%&*+-=?@"];

export function generarPasswordProvisional(longitud = 14): string {
  const todos = GRUPOS.join("");
  const caracteres = GRUPOS.map((g) => g[randomInt(g.length)]!);
  while (caracteres.length < longitud) caracteres.push(todos[randomInt(todos.length)]!);
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j]!, caracteres[i]!];
  }
  return caracteres.join("");
}

export type ResultadoUsuarioContratista =
  | { ok: true; modo: "dominio"; usuarioId: string; usuarioRed: string }
  | { ok: true; modo: "temporal"; usuarioId: string; correo: string; password: string }
  | { ok: false; mensaje: string };

async function vincularComoContratista(contratistaId: string, usuarioId: string) {
  await db.$transaction([
    db.contratista.update({ where: { id: contratistaId }, data: { usuarioId } }),
    db.usuario.update({ where: { id: usuarioId }, data: { rolesContratacion: ["CONTRATISTA"], modulosAcceso: ["GECON"] } }),
  ]);
  await asignarRolBase(usuarioId, "GECON:CONTRATISTA");
}

export async function crearUsuarioParaContratista(contratistaId: string, actor: { id: string; nombre: string }): Promise<ResultadoUsuarioContratista> {
  const c = await db.contratista.findUnique({
    where: { id: contratistaId },
    select: { id: true, usuarioId: true, tipoPersona: true, identificacion: true, nombres: true, apellidos: true, nombreORazonSocial: true, contactoEmail: true, contactoCelular: true, contactoTelefono: true, direccion: true },
  });
  if (!c) return { ok: false, mensaje: "El contratista no existe." };
  if (c.usuarioId) return { ok: false, mensaje: "El contratista ya tiene usuario en la plataforma." };
  if (c.tipoPersona !== "NATURAL") return { ok: false, mensaje: "Solo se crea usuario para personas naturales; la persona jurídica firma por su representante legal." };
  if (await db.usuario.findFirst({ where: { cedulaONit: c.identificacion }, select: { id: true } })) {
    return { ok: false, mensaje: "Ya existe un usuario con ese número de documento; se vinculará solo al pasar el contrato a Contractual." };
  }

  if (consultaDirectorioDisponible()) {
    const r = await consultarDirectorioPorDocumento(c.identificacion);
    if (r.ok && r.perfil.usuarioRed) {
      const creado = await crearUsuarioDeDominio(r.perfil, c.identificacion, ["GECON"]);
      if (creado) {
        await vincularComoContratista(c.id, creado.id);
        await registrarAuditoria({
          tipo: "USUARIO_CREADO",
          descripcion: `${actor.nombre} creó desde GECON el usuario del contratista ${c.nombreORazonSocial} con su usuario de red ${creado.email} (directorio activo).`,
          usuarioId: actor.id,
        });
        return { ok: true, modo: "dominio", usuarioId: creado.id, usuarioRed: creado.email };
      }
    }
  }

  const correo = c.contactoEmail?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return { ok: false, mensaje: "Registre primero un correo válido del contratista: con él ingresa a la cuenta temporal." };
  }
  if (await db.usuario.findUnique({ where: { email: correo }, select: { id: true } })) {
    return { ok: false, mensaje: `El correo ${correo} ya lo usa otra cuenta de la plataforma.` };
  }
  if (!c.nombres?.trim() || !c.apellidos?.trim()) return { ok: false, mensaje: "Registre los nombres y apellidos del contratista." };

  const politica = await getConfiguracionSitio();
  let password = generarPasswordProvisional();
  for (let i = 0; i < 5 && validarPoliticaPassword(password, politica); i++) password = generarPasswordProvisional(Math.max(14, politica.passwordLongitudMinima ?? 14));

  const usuario = await db.usuario.create({
    data: {
      email: correo,
      nombre: `${c.nombres.trim()} ${c.apellidos.trim()}`,
      nombres: c.nombres.trim(),
      apellidos: c.apellidos.trim(),
      cedulaONit: c.identificacion,
      correoNotificacion: correo,
      celular: c.contactoCelular,
      telefono: c.contactoTelefono,
      direccion: c.direccion,
      passwordHash: await hashPassword(password),
      passwordCambiadaEn: new Date(),
      cuentaTemporal: true,
      modulosAcceso: ["GECON"],
    },
    select: { id: true },
  });
  await vincularComoContratista(c.id, usuario.id);
  await registrarAuditoria({
    tipo: "USUARIO_CREADO",
    descripcion: `${actor.nombre} creó desde GECON una cuenta temporal para el contratista ${c.nombreORazonSocial} (${correo}); pasará al directorio activo cuando su cédula exista en el dominio.`,
    usuarioId: actor.id,
  });
  return { ok: true, modo: "temporal", usuarioId: usuario.id, correo, password };
}
