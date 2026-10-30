import { db } from "@/lib/db";
import { asignarRolBase } from "@/lib/perfiles";
import { registrarAuditoria } from "@/lib/auditoria";
import { consultaDirectorioDisponible, consultarDirectorioPorDocumento } from "@/lib/directorio-activo";
import { crearUsuarioDeDominio, sincronizarContratistaConDominio } from "@/lib/directorio-usuarios";
import { variantesDocumento } from "@/lib/datos-persona";
import { vincularPerfilConUsuario } from "@/lib/contratacion";

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
  const existente = await db.usuario.findFirst({ where: { cedulaONit: { in: variantesDocumento(c.identificacion) } }, select: { id: true, email: true, cuentaTemporal: true, directorioActivo: true } });
  if (existente) {
    const perfil = await db.contratista.findUniqueOrThrow({ where: { id: c.id } });
    if (!(await vincularPerfilConUsuario(perfil, existente.id))) {
      return { ok: false, mensaje: "Ya existe un usuario con ese número de documento, pero no puede vincularse como contratista: tiene otro rol en GECON, está inactivo o ya está vinculado a otro contratista." };
    }
    await registrarAuditoria({
      tipo: "USUARIO_ACTUALIZADO",
      descripcion: `${actor.nombre} vinculó desde GECON al contratista ${c.nombreORazonSocial} con el usuario existente ${existente.email}.`,
      usuarioId: actor.id,
    });
    return existente.directorioActivo && !existente.cuentaTemporal
      ? { ok: true, modo: "dominio", usuarioId: existente.id, usuarioRed: existente.email }
      : { ok: true, modo: "temporal", usuarioId: existente.id };
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
      const sincronizado = await sincronizarContratistaConDominio(c.id);
      const vinculado = sincronizado.vinculado ? await db.contratista.findUnique({ where: { id: c.id }, select: { usuarioId: true } }) : null;
      if (vinculado?.usuarioId && sincronizado.usuarioRed) {
        return { ok: true, modo: "dominio", usuarioId: vinculado.usuarioId, usuarioRed: sincronizado.usuarioRed };
      }
      return { ok: false, mensaje: sincronizado.mensaje };
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
