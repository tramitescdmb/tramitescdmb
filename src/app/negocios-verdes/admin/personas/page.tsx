import { db } from "@/lib/db";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeGestionarNV } from "@/lib/negocios-verdes-permisos";
import { PersonasNV } from "@/components/negocios-verdes/PersonasNV";

export const dynamic = "force-dynamic";

export default async function PersonasNegociosVerdes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const session = await verificarSesion();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  const personas = await db.nvPersona.findMany({
    orderBy: [{ tipo: "asc" }, { nombres: "asc" }],
    include: { negocios: { where: { vigenteHasta: null }, select: { negocio: { select: { id: true, nombre: true } } } } },
  });
  return (
    <PersonasNV
      busquedaInicial={typeof q === "string" ? q.slice(0, 120) : ""}
      personas={personas.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        nombres: p.nombres,
        apellidos: p.apellidos ?? "",
        tipoDocumento: p.tipoDocumento ?? "",
        documento: p.documento ?? "",
        telefono: p.telefono ?? "",
        correo: p.correo ?? "",
        cargo: p.cargo ?? "",
        direccion: p.direccion ?? "",
        municipio: p.municipio ?? "",
        naturalezaJuridica: p.naturalezaJuridica ?? "",
        activo: p.activo,
        negocios: p.negocios.map((n) => n.negocio),
      }))}
      puedeCrear={Boolean(permisos && puedeGestionarNV(permisos, "CREAR"))}
      puedeEditar={Boolean(permisos && puedeGestionarNV(permisos, "ACTUALIZAR"))}
      puedeEliminar={Boolean(permisos && puedeGestionarNV(permisos, "ELIMINAR"))}
    />
  );
}
