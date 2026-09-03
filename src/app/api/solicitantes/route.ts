import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { obtenerPermisosUsuario, puedeAccederSolicitantes } from "@/lib/permisos";

/**
 * Crea un Solicitante directamente (sin pasar por un expediente) — para darlo de alta antes de que
 * llegue su primer trámite. Cualquier funcionario con acceso a al menos un trámite puede crear uno,
 * igual que ya podía hacerlo de forma implícita al radicar (ver el upsert en POST /api/expedientes)
 * — no tiene sentido restringir esto a ADMIN si radicar ya crea el mismo registro sin esa
 * restricción. Sí exige `puedeAccederSolicitantes` (mismo candado que la pantalla /solicitantes/nuevo)
 * para que un funcionario sin ningún trámite asignado no pueda usar la API directo.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSolicitantes(permisos)) {
    return NextResponse.json({ error: "No tiene acceso a ningún trámite." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const identificacion = String(body.identificacion || "").trim();
  const esJuridica = body.tipo === "JURIDICA";
  const nombres = String(body.nombres || "").trim();
  const apellidos = String(body.apellidos || "").trim();
  const razonSocial = String(body.razonSocial || "").trim();
  const municipio = String(body.municipio || "").trim();

  if (!identificacion) {
    return NextResponse.json({ error: "La identificación es obligatoria." }, { status: 400 });
  }
  if (esJuridica ? !razonSocial : !nombres || !apellidos) {
    return NextResponse.json(
      { error: esJuridica ? "La razón social es obligatoria." : "Los nombres y apellidos son obligatorios." },
      { status: 400 }
    );
  }
  if (!municipio) {
    return NextResponse.json({ error: "El municipio es obligatorio." }, { status: 400 });
  }

  const existente = await db.solicitante.findUnique({ where: { identificacion } });
  if (existente) {
    return NextResponse.json(
      { error: "Ya existe un solicitante con esta identificación.", id: existente.id },
      { status: 409 }
    );
  }

  const creado = await db.solicitante.create({
    data: {
      tipo: esJuridica ? "JURIDICA" : "NATURAL",
      identificacion,
      nombres: nombres || null,
      apellidos: apellidos || null,
      razonSocial: razonSocial || null,
      regimenTributario: body.regimenTributario || null,
      granContribuyente: Boolean(body.granContribuyente),
      email: String(body.email || "").trim() || null,
      telefono: String(body.telefono || "").trim() || null,
      direccion: String(body.direccion || "").trim() || null,
      municipio,
    },
  });

  return NextResponse.json({ id: creado.id }, { status: 201 });
}
