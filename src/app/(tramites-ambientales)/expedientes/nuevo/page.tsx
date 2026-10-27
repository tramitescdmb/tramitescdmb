import { FilePlus2 } from "lucide-react";
import { getCatalogoTramites } from "@/lib/tramites-data";
import { categoriaTramite, todosLosSuitNumeros, CATEGORIAS_ORDEN } from "@/lib/tramite-categoria";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarTramite } from "@/lib/permisos";
import { CabeceraTablero } from "@/components/tablero";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { SelectorTramiteNuevo, type OpcionTramiteNuevo } from "@/components/SelectorTramiteNuevo";
import { redirect } from "next/navigation";

export default async function NuevoExpedienteSelectorPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [permisos, catalogo] = await Promise.all([obtenerPermisosUsuario(session.userId), getCatalogoTramites()]);
  const tramites = catalogo.filter((t) => puedeEditarTramite(permisos, t.id));
  if (tramites.length === 0) {
    return <AccesoRestringido titulo="Nuevo expediente" quien="con permiso de edición en algún trámite" volverHref="/expedientes" volverLabel="Volver a Expedientes" />;
  }

  const orden = new Map(CATEGORIAS_ORDEN.map((c, i) => [c.id, i]));
  const opciones: OpcionTramiteNuevo[] = tramites
    .flatMap((t) => {
      const categoria = categoriaTramite(t.nombre, t.codigo, todosLosSuitNumeros(t));
      const porFlujo = t.flujos.length >= 2 && t.flujos.every((f) => f.suitNumero);
      if (porFlujo) {
        return t.flujos.map((f) => ({
          clave: f.id,
          href: `/tramites/${t.slug}/nuevo?flujo=${encodeURIComponent(f.codigo)}`,
          nombre: f.nombre,
          codigo: t.codigo,
          suits: f.suitNumero ? [f.suitNumero] : [],
          categoria: categoria.etiqueta,
          ordenCategoria: orden.get(categoria.id) ?? 99,
        }));
      }
      return [
        {
          clave: t.id,
          href: `/tramites/${t.slug}/nuevo`,
          nombre: t.nombre,
          codigo: t.codigo,
          suits: todosLosSuitNumeros(t),
          categoria: categoria.etiqueta,
          ordenCategoria: orden.get(categoria.id) ?? 99,
        },
      ];
    })
    .sort((a, b) => a.ordenCategoria - b.ordenCategoria || a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <CabeceraTablero icon={FilePlus2} titulo="Nuevo expediente" contador={opciones.length} descripcion="Seleccione el trámite para radicar la solicitud." />
      <SelectorTramiteNuevo opciones={opciones} />
    </div>
  );
}
