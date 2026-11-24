import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleUser, KeyRound } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeConfigurarNV, puedeGestionarNV } from "@/lib/negocios-verdes-permisos";

export const dynamic = "force-dynamic";

/** «Mi cuenta» del administrador: la cuenta es la del SIC; la contraseña se cambia en Mi cuenta del SIC. */
export default async function CuentaNegociosVerdes() {
  const session = await verificarSesion();
  if (!session) redirect("/login");
  const [u, p] = await Promise.all([db.usuario.findUnique({ where: { id: session.userId }, select: { nombre: true, email: true, directorioActivo: true } }), obtenerPermisosUsuario(session.userId)]);
  if (!u) redirect("/login");
  const rol = p.esAdmin ? "Súper administrador" : puedeConfigurarNV(p) ? "Administrador" : puedeGestionarNV(p, "ACTUALIZAR") ? "Editor" : "Consulta";
  return (
    <div className="max-w-xl space-y-4">
      <section className="flex items-center gap-4 rounded-[12px] border border-nv-borde bg-white p-5">
        <CircleUser className="h-12 w-12 flex-none text-nv-primario" aria-hidden />
        <div className="min-w-0">
          <p className="text-[17px] font-medium">{u.nombre}</p>
          <p className="truncate text-sm text-nv-texto2">{u.email}</p>
          <span className="mt-1 inline-block rounded-[6px] bg-nv-claro px-2 py-0.5 text-xs text-nv-primario">{rol}</span>
        </div>
      </section>
      <section className="rounded-[12px] border border-nv-borde bg-white p-5">
        <h2 className="text-[15px] font-medium">Contraseña</h2>
        <p className="mt-1 text-[13px] text-nv-texto2">
          {u.directorioActivo ? "Su cuenta ingresa con el directorio activo de la CDMB: la contraseña es la del correo institucional." : "Entra con la misma cuenta del SIC. La contraseña y los datos de la cuenta se cambian en «Mi cuenta» del SIC."}
        </p>
        {!u.directorioActivo && (
          <Link prefetch={false} href="/mi-cuenta" className="mt-3 inline-flex items-center gap-2 rounded-[8px] bg-nv-primario px-5 py-2 text-sm font-semibold text-white hover:bg-nv-oscuro">
            <KeyRound className="h-4 w-4" aria-hidden /> Cambiar contraseña
          </Link>
        )}
      </section>
    </div>
  );
}
