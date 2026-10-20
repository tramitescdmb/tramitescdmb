import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck, ListOrdered } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { CabeceraTablero } from "@/components/tablero";
import { obtenerPerfil } from "@/lib/perfiles";
import { ETIQUETA_MODULO_PERFIL } from "@/lib/perfiles-catalogo";
import { MatrizPerfil } from "@/components/admin/MatrizPerfil";

export default async function RolDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Roles" quien="administrador del sistema" volverHref="/" volverLabel="Ir al inicio" />;

  const { id } = await params;
  const perfil = await obtenerPerfil(id);
  if (!perfil) notFound();

  return (
    <div className="space-y-4">
      <CabeceraTablero
        icon={ShieldCheck}
        titulo={perfil.nombre}
        descripcion={ETIQUETA_MODULO_PERFIL[perfil.modulo]}
        acciones={
          <Link href="/admin/roles" className="inline-flex items-center gap-1.5 rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
            <ListOrdered className="h-4 w-4" aria-hidden />
            Todos los roles
          </Link>
        }
      />
      <MatrizPerfil
        id={perfil.id}
        nombreInicial={perfil.nombre}
        descripcionInicial={perfil.descripcion ?? ""}
        moduloPerfil={perfil.modulo}
        matrizInicial={perfil.matriz}
        eliminable={!perfil.claveOrigen}
      />
    </div>
  );
}
