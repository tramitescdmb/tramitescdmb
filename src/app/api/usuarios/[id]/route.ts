import { NextRequest, NextResponse } from "next/server";
import type { NivelAccesoTramite, SeccionSoloLectura, RolCorrespondencia, RolContratacion, EstadoCuenta } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { hashPassword } from "@/lib/password";
import { validarPoliticaPassword, passwordEnHistorial, registrarHistorialPassword } from "@/lib/password-policy";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { registrarAuditoria } from "@/lib/auditoria";
import { esClaveDenominacion, esSexo, admiteEncargo } from "@/lib/denominacion-empleo";
import { sincronizarContratistaDeUsuario } from "@/lib/contratacion";
import { leerDatosPersona, TIPOS_IDENTIFICACION_USUARIO } from "@/lib/datos-persona";
import { dataUsuarioDesdePersona, errorPersonaUsuario } from "@/lib/usuarios-persona";

const NIVELES_VALIDOS: NivelAccesoTramite[] = ["VER", "EDITAR"];
const SECCIONES_VALIDAS: SeccionSoloLectura[] = ["VITAL_BASE", "VITAL_DASHBOARD", "SINCA_BASE", "SINCA_DASHBOARD", "SINCA_MINERIA"];
const ROLES_CORRESPONDENCIA_VALIDOS: RolCorrespondencia[] = [
  "OPERADOR_VENTANILLA",
  "FUNCIONARIO_DEPENDENCIA",
  "JEFE_DEPENDENCIA",
  "ADMIN_ARCHIVO",
];
const ROLES_CONTRATACION_VALIDOS: RolContratacion[] = [
  "ADMINISTRADOR_CONTRATACION",
  "JEFE_CONTRATACION",
  "FUNCIONARIO_CONTRATACION",
  "JEFE_DEPENDENCIA",
  "SUPERVISOR_INTERVENTOR",
  "CONTRATISTA",
];
const ESTADOS_CUENTA_VALIDOS: EstadoCuenta[] = ["HABILITADA", "DESHABILITADA", "BLOQUEADA", "SUSPENDIDA"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede hacer esto." }, { status: 403 });
  }

  const usuario = await db.usuario.findUnique({ where: { id } });
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const rol = body.rol === "ADMIN" || body.rol === "FUNCIONARIO" ? body.rol : usuario.rol;
  const persona = body.persona ? leerDatosPersona(body.persona, TIPOS_IDENTIFICACION_USUARIO) : null;
  if (persona) {
    const errorPersona = errorPersonaUsuario(persona);
    if (errorPersona) return NextResponse.json({ error: errorPersona }, { status: 400 });
  }
  const denominacionEmpleo: string | null | undefined = "denominacionEmpleo" in body
    ? (esClaveDenominacion(body.denominacionEmpleo) ? body.denominacionEmpleo : null)
    : undefined;
  const denominacionComplemento: string | null | undefined = "denominacionComplemento" in body
    ? (typeof body.denominacionComplemento === "string" && body.denominacionComplemento.trim()
        ? body.denominacionComplemento.trim().slice(0, 120)
        : null)
    : undefined;
  const denominacionEncargo: boolean | undefined = "denominacionEncargo" in body ? Boolean(body.denominacionEncargo) : undefined;
  const sexo: string | null | undefined = "sexo" in body
    ? (esSexo(body.sexo) ? body.sexo : null)
    : undefined;
  const accesoFirma: boolean | undefined = "accesoFirma" in body ? Boolean(body.accesoFirma) : undefined;
  const cargoIds: string[] | undefined = Array.isArray(body.cargoIds)
    ? body.cargoIds.filter((v: unknown): v is string => typeof v === "string")
    : undefined;
  const accesoTramites: { tramiteTipoId: string; nivel: NivelAccesoTramite }[] | undefined = Array.isArray(body.accesoTramites)
    ? body.accesoTramites.filter(
        (a: unknown): a is { tramiteTipoId: string; nivel: NivelAccesoTramite } =>
          typeof a === "object" &&
          a !== null &&
          typeof (a as { tramiteTipoId?: unknown }).tramiteTipoId === "string" &&
          NIVELES_VALIDOS.includes((a as { nivel?: unknown }).nivel as NivelAccesoTramite)
      )
    : undefined;
  const secciones: SeccionSoloLectura[] | undefined = Array.isArray(body.secciones)
    ? body.secciones.filter((s: unknown): s is SeccionSoloLectura => SECCIONES_VALIDAS.includes(s as SeccionSoloLectura))
    : undefined;
  const password = typeof body.password === "string" && body.password ? body.password : undefined;
  const estadoCuenta: EstadoCuenta | undefined = ESTADOS_CUENTA_VALIDOS.includes(body.estadoCuenta)
    ? body.estadoCuenta
    : undefined;

  const dependenciaId: string | null | undefined = "dependenciaId" in body
    ? (typeof body.dependenciaId === "string" && body.dependenciaId ? body.dependenciaId : null)
    : undefined;
  const rolCorrespondencia: RolCorrespondencia | null | undefined = "rolCorrespondencia" in body
    ? (ROLES_CORRESPONDENCIA_VALIDOS.includes(body.rolCorrespondencia) ? body.rolCorrespondencia : null)
    : undefined;
  const rolCorrespondenciaVigenteHasta: Date | null | undefined = "rolCorrespondenciaVigenteHasta" in body
    ? (typeof body.rolCorrespondenciaVigenteHasta === "string" && body.rolCorrespondenciaVigenteHasta ? new Date(body.rolCorrespondenciaVigenteHasta) : null)
    : undefined;

  const rolesContratacion: RolContratacion[] | undefined = Array.isArray(body.rolesContratacion)
    ? [...new Set<RolContratacion>(body.rolesContratacion.filter((r: unknown): r is RolContratacion => ROLES_CONTRATACION_VALIDOS.includes(r as RolContratacion)))]
    : undefined;
  const esContratista = rolesContratacion?.includes("CONTRATISTA") ?? false;
  const rolContratacionVigenteHasta: Date | null | undefined = "rolContratacionVigenteHasta" in body
    ? (typeof body.rolContratacionVigenteHasta === "string" && body.rolContratacionVigenteHasta ? new Date(body.rolContratacionVigenteHasta) : null)
    : undefined;

  if (esContratista && rolesContratacion!.length > 1) {
    return NextResponse.json({ error: "El rol Contratista no se combina con otros roles de contratación." }, { status: 400 });
  }

  if (dependenciaId) {
    const dep = await db.dependencia.findUnique({ where: { id: dependenciaId }, select: { id: true } });
    if (!dep) return NextResponse.json({ error: "La dependencia seleccionada no existe." }, { status: 400 });
  }

  const config = await getConfiguracionSitio();
  if (password) {
    const errorPassword = validarPoliticaPassword(password, config);
    if (errorPassword) return NextResponse.json({ error: errorPassword }, { status: 400 });
    if (usuario.directorioActivo) {
      return NextResponse.json(
        { error: "Este usuario ingresa por Directorio Activo; no tiene contraseña local que cambiar." },
        { status: 400 }
      );
    }
    if (await passwordEnHistorial(usuario.id, usuario.passwordHash, password, config.passwordHistorialCantidad)) {
      return NextResponse.json(
        { error: `Ya usó esa contraseña antes. Elija una distinta a las últimas ${config.passwordHistorialCantidad}.` },
        { status: 400 }
      );
    }
  }

  if (cargoIds && cargoIds.length > 0) {
    const encontrados = await db.cargo.count({ where: { id: { in: cargoIds } } });
    if (encontrados !== cargoIds.length) {
      return NextResponse.json({ error: "Alguno de los cargos seleccionados no existe." }, { status: 400 });
    }
  }

  const passwordHash = password ? await hashPassword(password) : undefined;
  if (passwordHash) {
    await registrarHistorialPassword(usuario.id, usuario.passwordHash, config.passwordHistorialCantidad);
  }

  // La denominación efectiva tras este PATCH (puede venir solo una de las dos partes) decide si
  // el encargo (E) sigue teniendo sentido — nunca lo dejamos en true para una denominación que no
  // lo admite (p. ej. si el cliente cambia a CONTRATISTA sin tocar denominacionEncargo).
  const denominacionEmpleoEfectiva = denominacionEmpleo !== undefined ? denominacionEmpleo : usuario.denominacionEmpleo;
  const denominacionEncargoFinal: boolean | undefined =
    denominacionEmpleo !== undefined || denominacionEncargo !== undefined
      ? admiteEncargo(denominacionEmpleoEfectiva) && (denominacionEncargo ?? usuario.denominacionEncargo)
      : undefined;

  const huboCambioDeCargo =
    (denominacionEmpleo !== undefined && denominacionEmpleo !== usuario.denominacionEmpleo) ||
    (denominacionComplemento !== undefined && denominacionComplemento !== usuario.denominacionComplemento) ||
    (denominacionEncargoFinal !== undefined && denominacionEncargoFinal !== usuario.denominacionEncargo);
  if (huboCambioDeCargo) {
    // Guarda el cargo que regía HASTA este momento (igual que registrarHistorialPassword con la
    // contraseña anterior) — las firmas ya hechas no dependen de esto, cada una congeló su propio
    // cargoAlFirmar; esta tabla es solo para consulta/auditoría del historial laboral.
    await db.historialCargo.create({
      data: {
        usuarioId: usuario.id,
        denominacionEmpleo: usuario.denominacionEmpleo,
        denominacionComplemento: usuario.denominacionComplemento,
        denominacionEncargo: usuario.denominacionEncargo,
        cambiadoPorId: session.userId,
      },
    });
  }

  await db.$transaction([
    db.usuario.update({
      where: { id },
      data: {
        rol,
        ...(persona ? dataUsuarioDesdePersona(persona) : {}),
        ...(denominacionEmpleo !== undefined ? { denominacionEmpleo } : {}),
        ...(denominacionComplemento !== undefined ? { denominacionComplemento } : {}),
        ...(denominacionEncargoFinal !== undefined ? { denominacionEncargo: denominacionEncargoFinal } : {}),
        ...(sexo !== undefined ? { sexo } : {}),
        ...(accesoFirma !== undefined ? { accesoFirma } : {}),
        ...(cargoIds ? { cargos: { set: cargoIds.map((cargoId) => ({ id: cargoId })) } } : {}),
        ...(passwordHash ? { passwordHash, passwordCambiadaEn: new Date() } : {}),
        ...(dependenciaId !== undefined ? { dependenciaId } : {}),
        ...(rolCorrespondencia !== undefined ? { rolCorrespondencia } : {}),
        ...(rolCorrespondenciaVigenteHasta !== undefined ? { rolCorrespondenciaVigenteHasta } : {}),
        ...(rolesContratacion !== undefined ? { rolesContratacion } : {}),
        ...(rolContratacionVigenteHasta !== undefined ? { rolContratacionVigenteHasta } : {}),
        ...(estadoCuenta ? { estadoCuenta, activo: estadoCuenta === "HABILITADA" } : {}),
      },
    }),
    ...(accesoTramites
      ? [
          db.usuarioTramiteAcceso.deleteMany({ where: { usuarioId: id } }),
          db.usuarioTramiteAcceso.createMany({
            data: accesoTramites.map((a) => ({ usuarioId: id, tramiteTipoId: a.tramiteTipoId, nivel: a.nivel })),
          }),
        ]
      : []),
    ...(secciones
      ? [
          db.usuarioSeccionAcceso.deleteMany({ where: { usuarioId: id } }),
          db.usuarioSeccionAcceso.createMany({ data: secciones.map((seccion) => ({ usuarioId: id, seccion })) }),
        ]
      : []),
  ]);

  if (persona) await sincronizarContratistaDeUsuario(id);

  await registrarAuditoria({
    tipo: "USUARIO_ACTUALIZADO",
    descripcion: `${session.nombre} actualizó a "${usuario.nombre}" (${usuario.email}): rol ${rol}${
      estadoCuenta ? `, estado ${estadoCuenta}` : ""
    }${accesoTramites ? `, ${accesoTramites.length} trámite(s) con acceso` : ""}${
      secciones ? `, ${secciones.length} sección(es) de VITAL/SINCA` : ""
    }${passwordHash ? ", contraseña restablecida" : ""}.`,
    usuarioId: session.userId,
  });

  return NextResponse.json({ ok: true });
}
