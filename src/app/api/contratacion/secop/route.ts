import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeCrearExpedienteContractual } from "@/lib/permisos";
import { buscarContratosSecop } from "@/lib/secop-datos";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeCrearExpedienteContractual(await obtenerPermisosUsuario(session.userId))) {
    return NextResponse.json({ error: "No tiene permiso para consultar SECOP II desde GECON." }, { status: 403 });
  }
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  try {
    const contratos = await buscarContratosSecop(ref);
    const documentos = [...new Set(contratos.map((c) => c.contratista.documento).filter((d): d is string => Boolean(d)))];
    const [usuarios, existentes] = await Promise.all([
      documentos.length
        ? db.usuario.findMany({ where: { cedulaONit: { in: documentos }, activo: true }, select: { id: true, nombre: true, email: true, cedulaONit: true } })
        : Promise.resolve([]),
      db.expedienteContractual.findMany({
        where: {
          eliminado: false,
          OR: [
            { numeroContrato: { in: contratos.map((c) => c.numeroContrato).filter((v): v is string => Boolean(v)) } },
            { numeroProcesoSecop: { in: contratos.map((c) => c.numeroProcesoSecop).filter((v): v is string => Boolean(v)) } },
          ],
        },
        select: { id: true, numero: true, codigoProceso: true, numeroContrato: true, numeroProcesoSecop: true },
      }),
    ]);
    return NextResponse.json({
      contratos: contratos.map((c) => ({
        ...c,
        usuario: usuarios.find((u) => u.cedulaONit === c.contratista.documento) ?? null,
        expedienteExistente: existentes.find((e) => (c.numeroContrato && e.numeroContrato === c.numeroContrato) || (c.numeroProcesoSecop && e.numeroProcesoSecop === c.numeroProcesoSecop)) ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo consultar SECOP II." }, { status: 502 });
  }
}
