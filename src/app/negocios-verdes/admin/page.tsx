import { db } from "@/lib/db";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeGestionarNV } from "@/lib/negocios-verdes-permisos";
import type { FilaTableroNV } from "@/lib/negocios-verdes-tablero";
import { TableroNV } from "@/components/negocios-verdes/admin/TableroNV";

export const dynamic = "force-dynamic";

/** «Panel» del administrador: las cifras y gráficas de la plataforma anterior. */
export default async function PanelNegociosVerdes() {
  const session = await verificarSesion();
  const [filas, config, permisos] = await Promise.all([
    db.nvNegocio.findMany({
      select: {
        id: true,
        nombre: true,
        municipio: true,
        activo: true,
        fichaTecnica: true,
        fotoPortadaRuta: true,
        emprendimientoVerde: true,
        selloMarca: true,
        avalado: true,
        categoria: { select: { nombre: true, slug: true, activo: true } },
        puntajes: { select: { anio: true, puntaje: true } },
      },
      orderBy: { nombre: "asc" },
    }),
    getConfiguracionSitio(),
    session ? obtenerPermisosUsuario(session.userId) : null,
  ]);
  const datos: FilaTableroNV[] = filas.map((n) => {
    const novedad = (n.fichaTecnica as Record<string, unknown> | null)?.novedad;
    return {
      id: n.id,
      nombre: n.nombre,
      municipio: n.municipio,
      activo: n.activo,
      estado: typeof novedad === "string" && novedad.trim() ? novedad.trim().toUpperCase() : null,
      conFoto: Boolean(n.fotoPortadaRuta),
      categoria: n.categoria.nombre,
      pendiente: n.categoria.slug === "pendiente-clasificar" || !n.categoria.activo,
      emprendimientoVerde: n.emprendimientoVerde,
      selloMarca: n.selloMarca,
      avalado: n.avalado,
      puntajes: Object.fromEntries(n.puntajes.map((p) => [p.anio, Number(p.puntaje)])),
    };
  });
  return (
    <>
      {!config.negociosVerdesSitioPublico && (
        <p className="mb-4 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          El sitio público está apagado: la ciudadanía ve «Sitio en preparación». Se enciende en Administración → Módulos, casilla «Negocios Verdes — Sitio público».
        </p>
      )}
      <TableroNV filas={datos} puedeCrear={Boolean(permisos && puedeGestionarNV(permisos, "CREAR"))} />
    </>
  );
}
