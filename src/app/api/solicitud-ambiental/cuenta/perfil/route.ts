import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { origenPermitido } from "@/lib/cuenta-ciudadana";
import { cuentaEnSesion, vincularAutomaticamente } from "@/lib/cuenta-ciudadana-db";
import { normalizarIdentificacion } from "@/lib/solicitud-ambiental";

/**
 * Completa o corrige los datos de la cuenta ciudadana. La cédula o el NIT se fija una sola vez: de
 * ella depende qué solicitudes puede vincular la cuenta, así que no se cambia desde aquí.
 */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req.headers)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 403 });
  const cuenta = await cuentaEnSesion();
  if (!cuenta) return NextResponse.json({ error: "Su sesión terminó. Ingrese de nuevo." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const tipo = body?.tipo === "JURIDICA" ? "JURIDICA" : "NATURAL";
  const nombre = typeof body?.nombre === "string" ? body.nombre.trim().replace(/\s+/g, " ").slice(0, 200) : "";
  const telefono = typeof body?.telefono === "string" ? body.telefono.trim().slice(0, 40) : "";
  const identificacionTexto = typeof body?.identificacion === "string" ? body.identificacion.trim() : "";

  if (nombre.length < 3) return NextResponse.json({ error: tipo === "JURIDICA" ? "Escriba la razón social." : "Escriba su nombre completo." }, { status: 400 });
  if (telefono && !/^[0-9+()\-\s]{7,40}$/.test(telefono)) return NextResponse.json({ error: "El teléfono no es válido." }, { status: 400 });

  let identificacion = cuenta.identificacion;
  if (!identificacion) {
    if (!/^[0-9.\-\s]{5,20}$/.test(identificacionTexto)) {
      return NextResponse.json({ error: tipo === "JURIDICA" ? "Escriba el NIT solo con números (puede incluir el dígito de verificación con guion)." : "Escriba la cédula solo con números." }, { status: 400 });
    }
    identificacion = normalizarIdentificacion(identificacionTexto);
    if (identificacion.length < 5) return NextResponse.json({ error: "La cédula o el NIT no es válido." }, { status: 400 });
  }
  if (!cuenta.completa && body?.aceptaTratamiento !== true) {
    return NextResponse.json({ error: "Debe aceptar la autorización de tratamiento de datos personales." }, { status: 400 });
  }

  await db.cuentaCiudadana.update({
    where: { id: cuenta.id },
    data: {
      nombre,
      telefono: telefono || null,
      ...(cuenta.identificacion ? {} : { identificacion, tipo }),
      ...(cuenta.completa ? {} : { aceptaTratamientoEn: new Date() }),
    },
  });
  const vinculadas = await vincularAutomaticamente(cuenta.id);
  return NextResponse.json({ ok: true, vinculadas });
}
