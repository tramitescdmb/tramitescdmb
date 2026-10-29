import { db } from "@/lib/db";
import { asignarRolBase } from "@/lib/perfiles";
import { registrarAuditoria } from "@/lib/auditoria";
import { consultaDirectorioDisponible, consultarDirectorioPorDocumento } from "@/lib/directorio-activo";
import { crearUsuarioDeDominio } from "@/lib/directorio-usuarios";

const SIN_CONTRASENA_LOCAL = "directorio-activo:sin-contrasena-local";

export type ResultadoUsuarioContratista =
  | { ok: true; modo: "dominio"; usuarioId: string; usuarioRed: string }
  | { ok: true; modo: "temporal"; usuarioId: string }
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

  if (!c.nombres?.trim() || !c.apellidos?.trim()) return { ok: false, mensaje: "Registre los nombres y apellidos del contratista." };
  const correo = c.contactoEmail?.trim().toLowerCase() || null;
  const identificador = `temporal.${c.identificacion.replace(/\D/g, "")}`;
  if (await db.usuario.findUnique({ where: { email: identificador }, select: { id: true } })) {
    return { ok: false, mensaje: "Ya existe una cuenta temporal con ese número de documento." };
  }

  const usuario = await db.usuario.create({
    data: {
      email: identificador,
      nombre: `${c.nombres.trim()} ${c.apellidos.trim()}`,
      nombres: c.nombres.trim(),
      apellidos: c.apellidos.trim(),
      cedulaONit: c.identificacion,
      correoNotificacion: correo,
      celular: c.contactoCelular,
      telefono: c.contactoTelefono,
      direccion: c.direccion,
      passwordHash: SIN_CONTRASENA_LOCAL,
      cuentaTemporal: true,
      modulosAcceso: ["GECON"],
    },
    select: { id: true },
  });
  await vincularComoContratista(c.id, usuario.id);
  await registrarAuditoria({
    tipo: "USUARIO_CREADO",
    descripcion: `${actor.nombre} creó desde GECON una cuenta temporal para el contratista ${c.nombreORazonSocial} (C.C. ${c.identificacion}); se actualizará con su usuario de red cuando sistemas cree sus credenciales en el dominio.`,
    usuarioId: actor.id,
  });
  return { ok: true, modo: "temporal", usuarioId: usuario.id };
}
