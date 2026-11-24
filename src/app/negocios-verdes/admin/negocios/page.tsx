import { db } from "@/lib/db";
import { urlImagenNV } from "@/lib/negocios-verdes";
import { revisionDatosNV } from "@/lib/negocios-verdes-admin";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeGestionarNV } from "@/lib/negocios-verdes-permisos";
import { ListaNegociosNV } from "@/components/negocios-verdes/admin/ListaNegociosNV";

export const dynamic = "force-dynamic";

/** Listado de negocios del administrador (los más recientes primero, como en la plataforma anterior). */
export default async function NegociosAdminNV() {
  const session = await verificarSesion();
  const [negocios, categorias, permisos, revision] = await Promise.all([
    db.nvNegocio.findMany({
      select: {
        id: true,
        nombre: true,
        municipio: true,
        activo: true,
        destacado: true,
        latitud: true,
        longitud: true,
        fichaTecnica: true,
        fotoPortadaRuta: true,
        emprendimientoVerde: true,
        selloMarca: true,
        avalado: true,
        categoriaId: true,
        categoria: { select: { nombre: true } },
      },
      orderBy: [{ creadoEn: "desc" }, { nombre: "asc" }],
    }),
    db.nvCategoria.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true } }),
    session ? obtenerPermisosUsuario(session.userId) : null,
    revisionDatosNV(),
  ]);
  return (
    <ListaNegociosNV
      negocios={negocios.map((n) => {
        const novedad = (n.fichaTecnica as Record<string, unknown> | null)?.novedad;
        return {
          id: n.id,
          nombre: n.nombre,
          municipio: n.municipio,
          categoria: n.categoria.nombre,
          categoriaId: n.categoriaId,
          activo: n.activo,
          destacado: n.destacado,
          conUbicacion: n.latitud !== null && n.longitud !== null,
          estado: typeof novedad === "string" && novedad.trim() ? novedad.trim() : null,
          fotoUrl: urlImagenNV(n.fotoPortadaRuta),
          emprendimientoVerde: n.emprendimientoVerde,
          selloMarca: n.selloMarca,
          avalado: n.avalado,
        };
      })}
      categorias={categorias}
      puedeCrear={Boolean(permisos && puedeGestionarNV(permisos, "CREAR"))}
      puedeEditar={Boolean(permisos && puedeGestionarNV(permisos, "ACTUALIZAR"))}
      puedeEliminar={Boolean(permisos && puedeGestionarNV(permisos, "ELIMINAR"))}
      porCorregir={revision.filter((f) => f.problemas.some((p) => p.grave)).length}
    />
  );
}
