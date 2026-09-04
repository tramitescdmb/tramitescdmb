import { NextRequest, NextResponse } from "next/server";
import { sincaConfigurado } from "@/lib/sinca";
import { obtenerSnapshotNit } from "@/lib/sinca-nit-stats";
import { procesarFiltrosNit, filtrarYOrdenarEntidadesNit, contarVinculadas, type FiltrosBrutosNit } from "@/lib/sinca-nit";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

const LIMITE_MAXIMO = 5000; // tope de protección si alguien pide "todos" con una base enorme

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Exporta el registro de NIT/terceros (con los mismos filtros de la pantalla) a CSV — una fila por tercero. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSeccion(permisos, "SINCA_BASE")) {
    return NextResponse.json({ error: "No tiene acceso a SINCA 1.0." }, { status: 403 });
  }
  if (!sincaConfigurado()) return NextResponse.json({ error: "SINCA 1.0 no está configurado." }, { status: 503 });

  const sp = req.nextUrl.searchParams;
  const filtrosBrutos: FiltrosBrutosNit = {
    q: sp.get("q") ?? undefined,
    municipio: sp.get("municipio") ?? undefined,
    tipo: sp.get("tipo") ?? undefined,
    regimen: sp.get("regimen") ?? undefined,
    vinculadas: sp.get("vinculadas") ?? undefined,
    orden: sp.get("orden") ?? undefined,
    dir: sp.get("dir") ?? undefined,
  };
  const filtrosPeriodo: FiltrosPeriodo = { desde: sp.get("desde") ?? undefined, hasta: sp.get("hasta") ?? undefined };
  const { rango } = resolverPeriodo(filtrosPeriodo);
  const f = procesarFiltrosNit(filtrosBrutos);

  let entidades;
  try {
    const snapshot = await obtenerSnapshotNit();
    entidades = filtrarYOrdenarEntidadesNit(snapshot.entidades, f, rango);
  } catch {
    return NextResponse.json({ error: "No se pudo consultar el registro de NIT de SINCA 1.0." }, { status: 502 });
  }
  entidades = entidades.slice(0, LIMITE_MAXIMO);

  const encabezados = [
    "NIT / Cédula",
    "Tipo",
    "Nombre / razón social",
    "Régimen tributario",
    "Gran contribuyente",
    "Autorretenedor",
    "Municipio",
    "Departamento",
    "Dirección",
    "Teléfono",
    "Celular",
    "Correo",
    "Total de solicitudes vinculadas",
    "Con detalle disponible en esta plataforma",
    "Actualizado en SINCA 1.0",
    "Actualizado por",
  ];

  const filasCsv = entidades.map((e) =>
    [
      e.identificacion,
      e.tipoLabel,
      e.nombre,
      e.regimen,
      e.granContribuyente,
      e.autorretenedor,
      e.municipio,
      e.departamento,
      e.direccion,
      e.telefono,
      e.celular,
      e.correo,
      e.vinculaciones.length,
      contarVinculadas(e),
      e.actualizado,
      e.actualizadoPor,
    ]
      .map(celda)
      .join(";")
  );

  // Separador ";" (no ",") porque Excel en configuración regional en español
  // usa la coma como separador decimal y espera punto y coma en el CSV.
  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [encabezados.map(celda).join(";"), ...filasCsv].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sinca1-nits-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
