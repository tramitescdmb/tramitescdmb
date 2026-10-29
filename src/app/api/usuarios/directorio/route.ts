import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { buscarEnDirectorio, consultarDirectorioPorDocumento, type PerfilDirectorio } from "@/lib/directorio-activo";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo un administrador puede consultar el directorio activo." }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("q") ?? req.nextUrl.searchParams.get("documento") ?? "").trim();

  let perfiles: PerfilDirectorio[];
  if (/^\d[\d.\s]*$/.test(q)) {
    const r = await consultarDirectorioPorDocumento(q);
    if (!r.ok) return NextResponse.json({ ok: false, mensaje: r.mensaje, noDisponible: r.noDisponible ?? false });
    perfiles = [r.perfil];
  } else {
    const r = await buscarEnDirectorio(q);
    if (!r.ok) return NextResponse.json({ ok: false, mensaje: r.mensaje });
    perfiles = r.perfiles;
  }
  if (perfiles.length === 0) return NextResponse.json({ ok: false, mensaje: `No hay coincidencias para «${q}» en el directorio activo.` });

  const documentos = perfiles.map((p) => p.documento).filter((d): d is string => Boolean(d));
  const redes = perfiles.map((p) => p.usuarioRed?.toLowerCase()).filter((d): d is string => Boolean(d));
  const existentes = await db.usuario.findMany({
    where: { OR: [{ cedulaONit: { in: documentos } }, { email: { in: redes } }] },
    select: { id: true, nombre: true, email: true, cedulaONit: true, cuentaTemporal: true },
  });
  return NextResponse.json({
    ok: true,
    perfiles: perfiles.map((p) => {
      const existente = existentes.find((e) => (p.documento && e.cedulaONit === p.documento) || (p.usuarioRed && e.email === p.usuarioRed.toLowerCase()));
      return { ...p, existente: existente ? { id: existente.id, nombre: existente.nombre, cuentaTemporal: existente.cuentaTemporal } : null };
    }),
  });
}
