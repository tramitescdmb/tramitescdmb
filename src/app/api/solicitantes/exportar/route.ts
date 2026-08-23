import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { regimenTributarioLabel } from "@/lib/regimen-tributario";

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Exporta el registro de solicitantes a CSV — para llevarlo a Excel o migrarlo a otro sistema. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede descargar este listado." }, { status: 403 });
  }

  const busqueda = req.nextUrl.searchParams.get("q")?.trim();

  const solicitantes = await db.solicitante.findMany({
    where: busqueda
      ? {
          OR: [
            { identificacion: { contains: busqueda, mode: "insensitive" } },
            { nombre: { contains: busqueda, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { nombre: "asc" },
    include: { _count: { select: { expedientes: true } } },
  });

  const encabezados = [
    "Identificación",
    "Tipo",
    "Nombre o razón social",
    "Régimen tributario",
    "Gran contribuyente",
    "Correo",
    "Teléfono",
    "Municipio",
    "Dirección",
    "Nro. de expedientes",
    "Registrado desde",
  ];

  const filas = solicitantes.map((s) =>
    [
      s.identificacion,
      s.tipo === "JURIDICA" ? "Persona jurídica" : "Persona natural",
      s.nombre,
      regimenTributarioLabel(s.regimenTributario),
      s.granContribuyente ? "Sí" : "No",
      s.email,
      s.telefono,
      s.municipio,
      s.direccion,
      s._count.expedientes,
      s.createdAt.toISOString().slice(0, 10),
    ]
      .map(celda)
      .join(",")
  );

  // BOM al inicio (U+FEFF) para que Excel detecte UTF-8 y no dañe las tildes/eñes.
  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [encabezados.map(celda).join(","), ...filas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="solicitantes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
