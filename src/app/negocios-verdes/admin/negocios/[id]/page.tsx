import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeGestionarNV } from "@/lib/negocios-verdes-permisos";
import { catalogosFormularioNV, negocioParaEditar } from "@/lib/negocios-verdes-admin";
import { FormNegocioNV } from "@/components/negocios-verdes/FormNegocioNV";

export const dynamic = "force-dynamic";

export default async function EditarNegocioNV({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string }> }) {
  const { id } = await params;
  const { creado } = await searchParams;
  const session = await verificarSesion();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  const [negocio, catalogos] = await Promise.all([negocioParaEditar(id).catch(() => null), catalogosFormularioNV()]);
  if (!negocio || !permisos) notFound();
  const editable = puedeGestionarNV(permisos, "ACTUALIZAR");

  return (
    <div className="space-y-4">
      <Link prefetch={false} href="/negocios-verdes/admin" className="text-sm font-medium text-emerald-700 hover:underline">
        ← Negocios
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-stone-900">{negocio.nombre}</h2>
        {negocio.activo && (
          <Link prefetch={false} href={`/negocios-verdes/negocio/${encodeURIComponent(negocio.slug)}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline">
            Ver ficha pública <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {creado && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Negocio creado. Ya puede subir su portada, galería y productos.</p>}
      {editable ? (
        <FormNegocioNV negocio={negocio} catalogos={catalogos} puedeEliminar={puedeGestionarNV(permisos, "ELIMINAR")} />
      ) : (
        <p className="text-sm text-stone-600">Su perfil solo permite consultar.</p>
      )}
    </div>
  );
}
