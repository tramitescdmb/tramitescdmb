import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerRegistroContratistas } from "@/lib/permisos";
import { regimenTributarioLabel } from "@/lib/regimen-tributario";

function celda(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeVerRegistroContratistas(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para descargar este listado." }, { status: 403 });
  }

  const busqueda = req.nextUrl.searchParams.get("q")?.trim();
  const where = busqueda
    ? {
        OR: [
          { identificacion: { contains: busqueda, mode: "insensitive" as const } },
          { nombreORazonSocial: { contains: busqueda, mode: "insensitive" as const } },
        ],
      }
    : {};

  const contratistas = await db.contratista.findMany({
    where,
    orderBy: { nombreORazonSocial: "asc" },
    include: { _count: { select: { expedientes: true } } },
  });

  const encabezados = [
    "Identificación",
    "Tipo",
    "Nombres",
    "Apellidos",
    "Razón social",
    "Régimen tributario",
    "Gran contribuyente",
    "Correo",
    "Teléfono",
    "Departamento",
    "Ciudad",
    "Dirección",
    "Nro. de expedientes",
    "Registrado desde",
  ];

  const filas = contratistas.map((c) =>
    [
      c.identificacion,
      c.tipoPersona === "JURIDICA" ? "Persona jurídica" : "Persona natural",
      c.nombres,
      c.apellidos,
      c.tipoPersona === "JURIDICA" ? c.nombreORazonSocial : null,
      regimenTributarioLabel(c.regimenTributario),
      c.granContribuyente ? "Sí" : "No",
      c.contactoEmail,
      c.contactoTelefono,
      c.departamento,
      c.ciudad,
      c.direccion,
      c._count.expedientes,
      c.createdAt.toISOString().slice(0, 10),
    ]
      .map(celda)
      .join(";")
  );

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [encabezados.map(celda).join(";"), ...filas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contratistas-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
