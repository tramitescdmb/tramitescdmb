import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

const ETIQUETAS_ESTADO_CUENTA: Record<string, string> = {
  HABILITADA: "Habilitada",
  DESHABILITADA: "Deshabilitada",
  BLOQUEADA: "Bloqueada",
  SUSPENDIDA: "Suspendida",
};

const ETIQUETAS_ROL_CORRESPONDENCIA: Record<string, string> = {
  OPERADOR_VENTANILLA: "Operador de ventanilla",
  FUNCIONARIO_DEPENDENCIA: "Funcionario de dependencia",
  JEFE_DEPENDENCIA: "Jefe de dependencia",
  ADMIN_ARCHIVO: "Administrador de archivo",
};

const ETIQUETAS_SECCION: Record<string, string> = {
  VITAL_BASE: "VITAL: Solicitudes y Recientes",
  VITAL_DASHBOARD: "VITAL: Dashboard",
  SINCA_BASE: "SINCA 1.0: Solicitudes",
  SINCA_DASHBOARD: "SINCA 1.0: Dashboard",
  SINCA_MINERIA: "SINCA 1.0: Minería de datos",
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede descargar este listado." }, { status: 403 });
  }

  const usuarios = await db.usuario.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      cargoAsignaciones: { select: { encargo: true, cargo: { select: { nombre: true } } } },
      tramitesAcceso: { select: { nivel: true, tramiteTipo: { select: { codigo: true } } } },
      seccionesAcceso: { select: { seccion: true } },
    },
  });

  const encabezados = [
    "Nombre",
    "Tipo de persona",
    "Documento",
    "Correo",
    "Correo de notificación",
    "Celular",
    "Teléfono",
    "Dirección",
    "Departamento",
    "Ciudad",
    "Directorio activo",
    "Rol",
    "Cargo(s)",
    "Estado",
    "Rol SGDEA (correspondencia)",
    "Trámites — Editar",
    "Trámites — Ver",
    "VITAL / SINCA 1.0",
    "Creado desde",
  ];

  const filas = usuarios.map((u) => {
    const esAdmin = u.rol === "ADMIN";
    const editar = u.tramitesAcceso.filter((a) => a.nivel === "EDITAR").map((a) => a.tramiteTipo.codigo);
    const ver = u.tramitesAcceso.filter((a) => a.nivel === "VER").map((a) => a.tramiteTipo.codigo);
    const secciones = u.seccionesAcceso.map((s) => ETIQUETAS_SECCION[s.seccion] ?? s.seccion);
    return [
      u.nombre,
      u.tipoPersona === "JURIDICA" ? "Jurídica" : "Natural",
      u.cedulaONit ? `${u.tipoIdentificacionFirma === "NIT" ? "NIT" : "C.C."} ${u.cedulaONit}` : "",
      u.email,
      u.correoNotificacion,
      u.celular,
      u.telefono,
      u.direccion,
      u.departamento,
      u.ciudad,
      u.directorioActivo ? "Sí" : "No",
      esAdmin ? "Administrador" : "Funcionario",
      u.cargoAsignaciones.map((uc) => (uc.encargo ? `${uc.cargo.nombre} (E)` : uc.cargo.nombre)).join("; "),
      ETIQUETAS_ESTADO_CUENTA[u.estadoCuenta] ?? u.estadoCuenta,
      esAdmin ? "Acceso total" : u.rolCorrespondencia ? (ETIQUETAS_ROL_CORRESPONDENCIA[u.rolCorrespondencia] ?? u.rolCorrespondencia) : "Sin acceso",
      esAdmin ? "Todos" : editar.join("; "),
      esAdmin ? "Todos" : ver.join("; "),
      esAdmin ? "Acceso total" : secciones.join("; "),
      u.createdAt.toISOString().slice(0, 10),
    ]
      .map(celda)
      .join(";");
  });

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [encabezados.map(celda).join(";"), ...filas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="usuarios-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
