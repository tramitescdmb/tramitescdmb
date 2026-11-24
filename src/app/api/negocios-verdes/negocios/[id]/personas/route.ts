import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditarNV, exigirPermisoNV } from "@/lib/negocios-verdes-api";
import { TIPOS_PERSONA, esTipoPersona, type TipoPersonaNV } from "@/lib/negocios-verdes-catalogo";
import { NATURALEZAS } from "@/lib/negocios-verdes-ficha";

type Params = { params: Promise<{ id: string }> };
const txt = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/**
 * Vincula una persona al negocio. Solo hay un vínculo vigente por tipo: el anterior se cierra
 * (queda en el historial con su fecha de fin).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const acceso = await exigirPermisoNV("ACTUALIZAR");
  if ("error" in acceso) return acceso.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const persona = typeof b.personaId === "string" ? await db.nvPersona.findUnique({ where: { id: b.personaId } }) : null;
  const negocio = await db.nvNegocio.findUnique({ where: { id }, select: { nombre: true } });
  if (!persona || !negocio) return NextResponse.json({ error: "No se encontró la persona o el negocio." }, { status: 404 });
  const tipo: TipoPersonaNV = esTipoPersona(b.tipo) ? b.tipo : persona.tipo;
  const naturaleza = txt(b.naturalezaJuridica);
  if (naturaleza && !(NATURALEZAS as readonly string[]).includes(naturaleza)) return NextResponse.json({ error: "Naturaleza jurídica no válida." }, { status: 400 });
  const ahora = new Date();
  await db.$transaction([
    db.nvNegocioPersona.updateMany({ where: { negocioId: id, tipo, vigenteHasta: null }, data: { vigenteHasta: ahora } }),
    db.nvNegocioPersona.create({
      data: { negocioId: id, personaId: persona.id, tipo, nit: tipo === "REPRESENTANTE" ? txt(b.nit, 30) : null, naturalezaJuridica: tipo === "REPRESENTANTE" ? naturaleza : null, nota: txt(b.nota, 1000), vigenteDesde: ahora, asignadoPorId: acceso.session.userId },
    }),
  ]);
  await auditarNV({ entidad: "NvNegocio", entidadId: id, accion: "MODIFICA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} asignó a ${persona.nombres} ${persona.apellidos ?? ""} como ${TIPOS_PERSONA[tipo]} de «${negocio.nombre}»` });
  return NextResponse.json({ ok: true });
}

/** Termina un vínculo vigente (no se borra: queda en el historial). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const acceso = await exigirPermisoNV("ACTUALIZAR");
  if ("error" in acceso) return acceso.error;
  const { id } = await params;
  const vinculoId = req.nextUrl.searchParams.get("vinculo") ?? "";
  const v = await db.nvNegocioPersona.findFirst({ where: { id: vinculoId, negocioId: id, vigenteHasta: null }, include: { persona: true, negocio: { select: { nombre: true } } } });
  if (!v) return NextResponse.json({ error: "El vínculo ya no está vigente." }, { status: 404 });
  await db.nvNegocioPersona.update({ where: { id: v.id }, data: { vigenteHasta: new Date() } });
  await auditarNV({ entidad: "NvNegocio", entidadId: id, accion: "MODIFICA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} terminó el vínculo de ${v.persona.nombres} ${v.persona.apellidos ?? ""} (${TIPOS_PERSONA[v.tipo]}) con «${v.negocio.nombre}»` });
  return NextResponse.json({ ok: true });
}
