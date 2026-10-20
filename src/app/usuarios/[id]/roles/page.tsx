import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { db } from "@/lib/db";
import { obtenerPerfilesDeUsuario } from "@/lib/perfiles-usuario";
import { PerfilesUsuario } from "@/components/usuarios/PerfilesUsuario";

export default async function RolesUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");
  const { id } = await params;
  const [usuario, datos] = await Promise.all([
    db.usuario.findUnique({ where: { id }, select: { id: true, nombre: true, email: true, rol: true } }),
    obtenerPerfilesDeUsuario(id),
  ]);
  if (!usuario || !datos) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href={`/usuarios/${usuario.id}`} className="inline-flex items-center gap-1 text-sm text-cdmb-700 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {usuario.nombre}
      </Link>
      <header className="rounded-md border border-stone-200 bg-white px-5 py-4">
        <h1 className="text-xl font-semibold text-stone-900">Roles</h1>
        <p className="text-sm text-stone-500">
          {usuario.nombre} · {usuario.email}
        </p>
      </header>
      {usuario.rol === "ADMIN" && (
        <p className="rounded-md border border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-800">Administrador del sistema: acceso total.</p>
      )}
      <PerfilesUsuario
        usuarioId={usuario.id}
        perfiles={datos.perfiles.filter((p) => p.modulo !== "GENERAL")}
        asignadosIniciales={datos.asignados}
        excepcionesIniciales={datos.excepciones}
      />
    </div>
  );
}
