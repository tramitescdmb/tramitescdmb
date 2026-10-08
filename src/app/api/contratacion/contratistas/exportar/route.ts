import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerRegistroContratistas } from "@/lib/permisos";
import { regimenTributarioLabel } from "@/lib/regimen-tributario";
import { vigenciaDeExpediente } from "@/lib/contratacion";
import { filtroContratistas } from "@/lib/contratistas-registro";

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

  const sp = req.nextUrl.searchParams;
  const estado = sp.get("estado");
  const where = filtroContratistas({
    busqueda: sp.get("q")?.trim() ?? "",
    vigencia: Number(sp.get("vigencia")) || null,
    estado: estado === "activo" || estado === "inactivo" ? estado : "",
  });

  const contratistas = await db.contratista.findMany({
    where,
    orderBy: { nombreORazonSocial: "asc" },
    include: {
      expedientes: { where: { eliminado: false }, select: { numero: true, fechaInicio: true, createdAt: true, etapaActual: true, cerrado: true } },
    },
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
    "Celular",
    "Teléfono",
    "Departamento",
    "Ciudad",
    "Dirección",
    "Contratos por vigencia",
    "Contrato activo",
    "Registrado desde",
  ];

  const filas = contratistas.map((c) => {
    const porVigencia = new Map<number, number>();
    for (const e of c.expedientes) {
      const v = vigenciaDeExpediente(e.fechaInicio, e.createdAt);
      porVigencia.set(v, (porVigencia.get(v) ?? 0) + 1);
    }
    const activos = c.expedientes.filter((e) => !e.cerrado && e.etapaActual === "CONTRACTUAL").map((e) => e.numero);
    return [
      c.identificacion,
      c.tipoPersona === "JURIDICA" ? "Persona jurídica" : "Persona natural",
      c.nombres,
      c.apellidos,
      c.tipoPersona === "JURIDICA" ? c.nombreORazonSocial : null,
      regimenTributarioLabel(c.regimenTributario),
      c.granContribuyente ? "Sí" : "No",
      c.contactoEmail,
      c.contactoCelular,
      c.contactoTelefono,
      c.departamento,
      c.ciudad,
      c.direccion,
      Array.from(porVigencia.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([v, n]) => `${v}: ${n}`)
        .join("; "),
      activos.length > 0 ? activos.join("; ") : "No",
      c.createdAt.toISOString().slice(0, 10),
    ]
      .map(celda)
      .join(";");
  });

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [encabezados.map(celda).join(";"), ...filas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contratistas-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
