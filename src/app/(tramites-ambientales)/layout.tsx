import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Leaf } from "lucide-react";
import { TramitesTabs } from "@/components/TramitesTabs";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSolicitantes } from "@/lib/permisos";

/**
 * Sección "Trámites ambientales": el panel, el catálogo de trámites, los
 * expedientes y los solicitantes — la operación diaria de la CDMB. Es un route
 * group (no cambia las URLs: `/`, `/tramites`, `/expedientes`, `/solicitantes`),
 * solo agrega la cabecera y las pestañas comunes. El Rol de acceso restringe
 * a CUÁLES trámites concretos se puede entrar (ver `/tramites`, `/expedientes`
 * y sus páginas de detalle) — Panel/Catálogo/Expedientes siguen visibles
 * (muestran contenido vacío si no hay acceso a nada); "Solicitantes" sí se
 * oculta del todo porque es un registro compartido entre TODOS los trámites,
 * no filtrado uno por uno (ver puedeAccederSolicitantes).
 *
 * El redirect si no hay sesión es obligatorio aquí (no solo defensivo): con
 * verificarSesion(), "sin sesión" también pasa a significar "cuenta
 * desactivada mientras la cookie seguía viva" — sin este corte, ese caso
 * caería en las páginas hijas, que asumen sesión presente y no restringen
 * nada cuando no la hay.
 */
export default async function TramitesAmbientalesLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  const mostrarSolicitantes = puedeAccederSolicitantes(permisos);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
          <Leaf className="h-4 w-4" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold text-stone-900">Trámites ambientales 2.0</h1>
      </div>

      <TramitesTabs mostrarSolicitantes={mostrarSolicitantes} />

      {children}
    </div>
  );
}
