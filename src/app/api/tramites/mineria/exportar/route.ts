import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederTramite } from "@/lib/permisos";
import { calcularMineriaTramites, filasDeDimension, DIMENSIONES_TABLA, type DimensionTabla } from "@/lib/tramites-mineria";
import { xlsxTablaDinamica } from "@/lib/tramites-mineria-exportar";
import { resolverPeriodo } from "@/lib/periodo-dashboard";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const sp = req.nextUrl.searchParams;
  const estado = sp.get("estado") || undefined;
  const municipio = sp.get("municipio") || undefined;
  const desde = sp.get("desde") || undefined;
  const hasta = sp.get("hasta") || undefined;
  const tramites = sp.get("tramite")?.split(",").filter(Boolean);
  const dimension: DimensionTabla = (["tipo", "estado", "municipio", "mes"] as const).includes(sp.get("agrupar") as DimensionTabla)
    ? (sp.get("agrupar") as DimensionTabla)
    : "tipo";

  const { rango, etiqueta: etiquetaPeriodo } = resolverPeriodo({ desde, hasta });
  const tramiteIdsPermitidos = !permisos.esAdmin ? Array.from(permisos.tramites.keys()) : null;
  if (tramites) {
    for (const t of tramites) {
      if (!puedeAccederTramite(permisos, t)) return NextResponse.json({ error: "No tiene acceso a ese trámite." }, { status: 403 });
    }
  }

  const m = await calcularMineriaTramites({ tramiteIdsPermitidos, estado, municipio, rango, tramites });

  const clausulas: string[] = [];
  if (tramites && tramites.length > 0) clausulas.push(`${tramites.length} trámite(s) seleccionado(s)`);
  if (municipio) clausulas.push(`municipio ${municipio}`);
  if (estado) clausulas.push(`estado "${estado.replaceAll("_", " ")}"`);
  if (rango) clausulas.push(`radicados entre ${etiquetaPeriodo}`);
  const filtrosTexto = clausulas.join("; ");

  const buffer = await xlsxTablaDinamica(filasDeDimension(m, dimension), DIMENSIONES_TABLA[dimension].columna, filtrosTexto);
  const fechaArchivo = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mineria_tramites_${dimension}_${fechaArchivo}.xlsx"`,
    },
  });
}
