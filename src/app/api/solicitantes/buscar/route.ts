import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSolicitantes } from "@/lib/permisos";
import { buscarSolicitantePorDocumento } from "@/lib/solicitante-db";

async function sugerenciaSinca(identificacion: string) {
  const digitos = identificacion.replace(/\D/g, "");
  if (digitos.length < 9) return null;
  const base = digitos.slice(0, 9);
  const filas = await db.sincaResolucion.findMany({
    where: { solicitanteNit: { in: [base, digitos, ...Array.from({ length: 10 }, (_, i) => `${base}${i}`)] }, representanteLegal: { not: null } },
    orderBy: [{ fechaResolucion: { sort: "desc", nulls: "last" } }, { nroSolicitud: "desc" }],
    select: { solicitanteNombre: true, representanteLegal: true, idRepresentante: true },
    take: 5,
  });
  const fila = filas.find((f) => !/^z{3}error/i.test(f.solicitanteNombre ?? ""));
  if (!fila?.representanteLegal?.trim()) return null;
  return {
    razonSocial: fila.solicitanteNombre?.trim() || null,
    representanteLegal: fila.representanteLegal.trim(),
    representanteIdentificacion: fila.idRepresentante?.trim() || null,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSolicitantes(permisos)) {
    return NextResponse.json({ error: "No tiene acceso a ningún trámite." }, { status: 403 });
  }

  const identificacion = req.nextUrl.searchParams.get("identificacion")?.trim();
  if (!identificacion) return NextResponse.json({ error: "Falta la identificación." }, { status: 400 });

  const solicitante = await buscarSolicitantePorDocumento(identificacion);
  if (!solicitante) {
    const sugerencia = await sugerenciaSinca(identificacion);
    return NextResponse.json({ error: "No encontrado", sugerencia }, { status: 404 });
  }
  const sugerencia = solicitante.tipo === "JURIDICA" && !solicitante.representanteLegal ? await sugerenciaSinca(identificacion) : null;
  return NextResponse.json({ ...solicitante, sugerencia });
}
