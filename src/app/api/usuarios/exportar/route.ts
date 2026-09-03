import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

const ETIQUETAS_SECCION: Record<string, string> = {
  VITAL_BASE: "VITAL: Solicitudes y Recientes",
  VITAL_DASHBOARD: "VITAL: Dashboard",
  SINCA_BASE: "SINCA 1.0: Solicitudes",
  SINCA_DASHBOARD: "SINCA 1.0: Dashboard",
  SINCA_MINERIA: "SINCA 1.0: Minería de datos",
};

/** Exporta el listado de usuarios (cargos, rol, trámites y secciones con acceso) a CSV. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede descargar este listado." }, { status: 403 });
  }

  const usuarios = await db.usuario.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      cargos: { select: { nombre: true } },
      tramitesAcceso: { select: { nivel: true, tramiteTipo: { select: { codigo: true } } } },
      seccionesAcceso: { select: { seccion: true } },
    },
  });

  const encabezados = [
    "Nombre",
    "Correo",
    "Directorio activo",
    "Rol",
    "Cargo(s)",
    "Estado",
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
      u.email,
      u.directorioActivo ? "Sí" : "No",
      esAdmin ? "Administrador" : "Funcionario",
      u.cargos.map((c) => c.nombre).join("; "),
      u.activo ? "Activo" : "Inactivo",
      esAdmin ? "Todos" : editar.join("; "),
      esAdmin ? "Todos" : ver.join("; "),
      esAdmin ? "Acceso total" : secciones.join("; "),
      u.createdAt.toISOString().slice(0, 10),
    ]
      .map(celda)
      .join(";");
  });

  // BOM al inicio (U+FEFF) para que Excel detecte UTF-8 y no dañe las tildes/eñes.
  // Separador ";" (no ",") porque Excel en configuración regional en español
  // usa la coma como separador decimal y espera punto y coma en el CSV.
  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [encabezados.map(celda).join(";"), ...filas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="usuarios-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
