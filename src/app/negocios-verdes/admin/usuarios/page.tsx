import Link from "next/link";
import { notFound } from "next/navigation";
import { MoreVertical, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { accedePanelNV, puedeConfigurarNV, puedeGestionarNV } from "@/lib/negocios-verdes-permisos";
import { claseBotonFlotanteNV } from "@/components/negocios-verdes/admin/ListaNegociosNV";

export const dynamic = "force-dynamic";

/**
 * Usuarios con acceso al administrador de Negocios Verdes. Las cuentas son las del SIC: se crean,
 * activan y configuran (perfil y módulos) en la gestión de usuarios del SIC.
 */
export default async function UsuariosNegociosVerdes() {
  const session = await verificarSesion();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  if (!session || !permisos || !puedeConfigurarNV(permisos)) notFound();
  const candidatos = await db.usuario.findMany({
    where: { OR: [{ rol: "ADMIN" }, { modulosAcceso: { has: "NEGOCIOS_VERDES" } }] },
    select: { id: true, email: true, nombre: true, activo: true },
    orderBy: { email: "asc" },
  });
  const filas = (
    await Promise.all(
      candidatos.map(async (u) => {
        const p = await obtenerPermisosUsuario(u.id);
        if (u.activo && !accedePanelNV(p)) return null;
        const rol = p.esAdmin ? "Súper administrador" : puedeConfigurarNV(p) ? "Administrador" : puedeGestionarNV(p, "ACTUALIZAR") ? "Editor" : u.activo ? "Consulta" : "Sin acceso (cuenta inactiva)";
        return { ...u, rol, super: p.esAdmin };
      })
    )
  ).filter((x) => x !== null);

  return (
    <div className="pb-20">
      <p className="mb-4 text-[13px] text-nv-texto2">Las cuentas son las mismas del SIC. Para crear una, activarla o cambiar su perfil, use la gestión de usuarios del SIC (módulo «Negocios Verdes» y permisos de gestión o configuración).</p>
      <ul className="space-y-3">
        {filas.map((u) => (
          <li key={u.id} className="flex items-center gap-4 rounded-[12px] border border-nv-borde bg-white px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px]">
                {u.email}
                {u.id === session.userId && <span className="ml-1.5 text-xs text-nv-texto2">(tú)</span>}
              </p>
              <p className="truncate text-xs text-nv-texto2">{u.nombre}</p>
              <span className={`mt-1 inline-block rounded-[6px] px-2 py-0.5 text-xs ${u.super ? "bg-nv-claro text-nv-primario" : "bg-black/[0.06] text-nv-texto2"}`}>{u.rol}</span>
            </div>
            <span role="switch" aria-checked={u.activo} aria-label={u.activo ? "Cuenta activa" : "Cuenta inactiva"} title={u.activo ? "Cuenta activa" : "Cuenta inactiva"} className={`relative h-8 w-[52px] flex-none rounded-full border-2 opacity-80 ${u.activo ? "border-nv-vivo bg-nv-vivo" : "border-nv-texto2/50 bg-nv-borde/60"}`}>
              <span className={`absolute top-1/2 -translate-y-1/2 rounded-full ${u.activo ? "left-[22px] h-6 w-6 bg-white" : "left-1.5 h-4 w-4 bg-nv-texto2/70"}`} />
            </span>
            {permisos.esAdmin ? (
              <Link prefetch={false} href={`/usuarios/${u.id}`} aria-label={`Gestionar a ${u.email} en el SIC`} title="Gestionar en el SIC" className="rounded-full p-1.5 hover:bg-black/5">
                <MoreVertical className="h-5 w-5" />
              </Link>
            ) : (
              <span className="w-8" />
            )}
          </li>
        ))}
        {filas.length === 0 && <li className="py-10 text-center text-sm text-nv-texto2">Nadie tiene acceso todavía.</li>}
      </ul>
      {permisos.esAdmin && (
        <Link prefetch={false} href="/usuarios?nuevo=1#nuevo-usuario" className={claseBotonFlotanteNV}>
          <UserPlus className="h-5 w-5" aria-hidden /> Nuevo usuario
        </Link>
      )}
    </div>
  );
}
