import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeGestionarNV } from "@/lib/negocios-verdes-permisos";
import { catalogosFormularioNV, negocioParaEditar } from "@/lib/negocios-verdes-admin";
import { FormNegocioNV } from "@/components/negocios-verdes/FormNegocioNV";
import { VinculosNegocioNV } from "@/components/negocios-verdes/VinculosNegocioNV";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditarNegocioNV({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string }> }) {
  const { id } = await params;
  const { creado } = await searchParams;
  const session = await verificarSesion();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  const [negocio, catalogos] = await Promise.all([negocioParaEditar(id).catch(() => null), catalogosFormularioNV()]);
  if (!negocio || !permisos) notFound();
  const editable = puedeGestionarNV(permisos, "ACTUALIZAR");
  const [vinculos, personas] = await Promise.all([
    db.nvNegocioPersona.findMany({ where: { negocioId: id }, orderBy: [{ vigenteHasta: { sort: "desc", nulls: "first" } }, { vigenteDesde: "desc" }], include: { persona: { select: { nombres: true, apellidos: true } } } }),
    editable ? db.nvPersona.findMany({ where: { activo: true }, orderBy: { nombres: "asc" }, select: { id: true, nombres: true, apellidos: true, tipo: true } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <Link prefetch={false} href="/negocios-verdes/admin/negocios" className="text-sm font-medium text-nv-vivo hover:underline">
        ← Negocios
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[26px] font-normal">{negocio.nombre}</h2>
        {negocio.activo && (
          <Link prefetch={false} href={`/negocios-verdes/negocio/${encodeURIComponent(negocio.slug)}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-nv-primario hover:underline">
            Ver ficha pública <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {creado && <p className="rounded-[8px] bg-nv-claro px-3 py-2 text-sm text-nv-oscuro">Negocio creado. Ya puede subir su portada, galería y productos.</p>}
      {editable ? (
        <FormNegocioNV negocio={negocio} catalogos={catalogos} puedeEliminar={puedeGestionarNV(permisos, "ELIMINAR")} />
      ) : (
        <p className="text-sm text-nv-texto2">Su perfil solo permite consultar.</p>
      )}
      <VinculosNegocioNV
        negocioId={negocio.id}
        editable={editable}
        personas={personas.map((p) => ({ id: p.id, tipo: p.tipo, nombre: `${p.nombres} ${p.apellidos ?? ""}`.trim() }))}
        vinculos={vinculos.map((v) => ({
          id: v.id,
          tipo: v.tipo,
          persona: `${v.persona.nombres} ${v.persona.apellidos ?? ""}`.trim(),
          nit: v.nit,
          naturalezaJuridica: v.naturalezaJuridica,
          nota: v.nota,
          desde: v.vigenteDesde.toISOString(),
          hasta: v.vigenteHasta?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
